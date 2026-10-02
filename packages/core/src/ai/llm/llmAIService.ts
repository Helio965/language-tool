/**
 * Implementação do AIService para modelos de linguagem reais, independente do provedor.
 * O modelo identifica e explica; as regras determinísticas e a política de correção
 * continuam valendo (rede de segurança contra respostas incorretas — Risco 2).
 */
import type { ContentCatalog } from '../../content/catalog';
import type { Example, Exercise } from '../../domain/content';
import type { ConversationContext, CorrectionSeverity } from '../../domain/entities';
import { SKILL_TAGS, type SkillTag } from '../../domain/skills';
import { checkGrammar, resolveOverlaps } from '../grammar/checker';
import type { GrammarIssue } from '../grammar/types';
import { policyFor } from '../levelPolicy';
import { MockAIService } from '../mock/mockAIService';
import { ASSISTANT_PERSONA, withAssistantName } from '../persona';
import {
  buildSystemPrompt,
  conversationStartPrompt,
  conversationTaskPrompt,
  correctTaskPrompt,
  exampleTaskPrompt,
  explainTaskPrompt,
} from '../prompts';
import type {
  AIService,
  AssistantReply,
  ConversationStartInput,
  ConversationTurnInput,
  ConversationTurnOutput,
  CorrectInput,
  CorrectOutput,
  ExampleInput,
  ExplainInput,
  GenerateExerciseInput,
} from '../types';
import { emptyConversationContext } from '../types';
import { parseJsonObject, type AIProvider } from './provider';

interface RawIssue {
  span?: unknown;
  replacement?: unknown;
  severity?: unknown;
  skill?: unknown;
  explanation_pt?: unknown;
  explanation_en?: unknown;
}

const SEVERITIES: CorrectionSeverity[] = ['meaning', 'grammar', 'naturalness'];
const MAX_TEXT = 1200;

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim().slice(0, MAX_TEXT) : fallback;
}

/** Converte problemas sugeridos pelo modelo, descartando os que não existem na mensagem. */
export function toGrammarIssues(raw: unknown, message: string): GrammarIssue[] {
  if (!Array.isArray(raw)) return [];
  const issues: GrammarIssue[] = [];
  for (const item of raw.slice(0, 5) as RawIssue[]) {
    const span = text(item.span);
    const replacement = text(item.replacement);
    const start = span ? message.indexOf(span) : -1;
    if (start === -1 || !replacement || replacement === span) continue;
    const severity = SEVERITIES.includes(item.severity as CorrectionSeverity) ? (item.severity as CorrectionSeverity) : 'grammar';
    const skill = SKILL_TAGS.includes(item.skill as SkillTag) ? (item.skill as SkillTag) : 'word_choice';
    issues.push({
      ruleId: `ai:${skill}`,
      skillTag: skill,
      severity,
      start,
      original: span,
      replacement,
      explanation: { pt: text(item.explanation_pt, 'Veja a forma recomendada.'), en: text(item.explanation_en, 'See the suggested form.') },
    });
  }
  return issues;
}

function sanitizeFacts(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {};
  const entries = Object.entries(raw as Record<string, unknown>)
    .filter(([key, value]) => /^[a-z_]{2,20}$/.test(key) && typeof value === 'string' && value.length <= 60)
    .slice(0, 10);
  return Object.fromEntries(entries) as Record<string, string>;
}

export class LLMAIService implements AIService {
  readonly providerName: string;
  private readonly deterministic: MockAIService;

  constructor(
    private readonly provider: AIProvider,
    catalog: ContentCatalog,
    private readonly assistantName: string = ASSISTANT_PERSONA.name,
  ) {
    this.providerName = provider.name;
    this.deterministic = new MockAIService(catalog, assistantName);
  }

  async startConversation(input: ConversationStartInput): Promise<AssistantReply> {
    // Aberturas de aula são conteúdo pedagógico revisado: não precisam de geração.
    if (input.lessonOpener) return this.deterministic.startConversation(input);
    const { learner, topic } = input;
    const first = topic.questions[0];
    const band = policyFor(learner.level).band;
    const raw = await this.provider.complete({
      system: buildSystemPrompt('conversation', learner, this.assistantName),
      messages: [{ role: 'user', content: conversationStartPrompt(topic, first ? (band === 'low' ? first.low : first.high) : null) }],
      maxTokens: 300,
      temperature: 0.7,
    });
    const parsed = parseJsonObject<{ reply?: unknown; translation?: unknown }>(raw);
    const context = emptyConversationContext();
    if (first) context.askedQuestionIds.push(first.id);
    const reply = text(parsed.reply);
    if (!reply) throw new Error('Empty AI reply');
    return { reply, translation: learner.showTranslations ? text(parsed.translation) || null : null, context };
  }

  async conversation({ learner, topic, context, history, userMessage }: ConversationTurnInput): Promise<ConversationTurnOutput> {
    const band = policyFor(learner.level).band;
    const next = topic.questions.find((question) => !context.askedQuestionIds.includes(question.id)) ?? null;
    const system = [
      buildSystemPrompt('conversation', learner, this.assistantName),
      conversationTaskPrompt(topic, context.facts, next ? (band === 'low' ? next.low : next.high) : null),
    ].join('\n\n');
    const raw = await this.provider.complete({
      system,
      messages: [...history.map((turn) => ({ role: turn.role, content: turn.content })), { role: 'user', content: userMessage }],
      maxTokens: 600,
      temperature: 0.7,
    });
    const parsed = parseJsonObject<{ reply?: unknown; translation?: unknown; facts?: unknown; issues?: unknown }>(raw);
    const reply = text(parsed.reply);
    if (!reply) throw new Error('Empty AI reply');
    const updated: ConversationContext = {
      ...context,
      facts: { ...context.facts, ...sanitizeFacts(parsed.facts) },
      askedQuestionIds: next ? [...context.askedQuestionIds, next.id] : [...context.askedQuestionIds],
      turn: context.turn + 1,
    };
    const issues = resolveOverlaps([...checkGrammar(userMessage), ...toGrammarIssues(parsed.issues, userMessage)]);
    return { reply, translation: learner.showTranslations ? text(parsed.translation) || null : null, context: updated, issues };
  }

  async explain({ learner, lesson, style }: ExplainInput): Promise<string> {
    const raw = await this.provider.complete({
      system: buildSystemPrompt('learn', learner, this.assistantName),
      messages: [{ role: 'user', content: explainTaskPrompt(lesson, style, learner.explanationLanguage) }],
      maxTokens: 400,
      temperature: 0.6,
    });
    const result = withAssistantName(raw.trim(), this.assistantName).slice(0, MAX_TEXT);
    if (!result) throw new Error('Empty AI explanation');
    return result;
  }

  async anotherExample({ learner, lesson }: ExampleInput): Promise<Example> {
    const raw = await this.provider.complete({
      system: buildSystemPrompt('learn', learner, this.assistantName),
      messages: [{ role: 'user', content: exampleTaskPrompt(lesson) }],
      maxTokens: 200,
      temperature: 0.8,
    });
    const parsed = parseJsonObject<{ en?: unknown; pt?: unknown; highlight?: unknown }>(raw);
    const en = text(parsed.en);
    if (!en) throw new Error('Empty AI example');
    const highlight = text(parsed.highlight);
    return { en, pt: text(parsed.pt), ...(highlight && en.includes(highlight) ? { highlight } : {}) };
  }

  async correct({ learner, exercise, answer }: CorrectInput): Promise<CorrectOutput> {
    const raw = await this.provider.complete({
      system: buildSystemPrompt('learn', learner, this.assistantName),
      messages: [{ role: 'user', content: correctTaskPrompt(exercise, answer) }],
      maxTokens: 500,
      temperature: 0.2,
    });
    const parsed = parseJsonObject<{ feedback?: unknown; issues?: unknown }>(raw);
    const issues = resolveOverlaps([...checkGrammar(answer), ...toGrammarIssues(parsed.issues, answer)]);
    return { issues, feedback: text(parsed.feedback, issues.length ? 'Veja a forma recomendada.' : 'Muito bem!') };
  }

  /** Exercícios vêm do catálogo revisado: gabaritos gerados por IA não são confiáveis o suficiente para o MVP. */
  async generateExercise(input: GenerateExerciseInput): Promise<Exercise | null> {
    return this.deterministic.generateExercise(input);
  }
}
