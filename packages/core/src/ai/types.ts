/**
 * Contrato da camada pedagógica de IA. A aplicação depende apenas desta interface —
 * nunca de um provedor específico (Análise de requisitos, Risco 3 — dependência externa).
 */
import type { Bilingual, ConversationTopic, Example, Exercise, Lesson, ScriptedQuestion } from '../domain/content';
import type { ConversationContext, CorrectionIntensity, MessageRole, ReplyLength } from '../domain/entities';
import type { Level } from '../domain/levels';
import type { Goal, InterestArea } from '../domain/profile';
import type { SkillTag } from '../domain/skills';
import type { GrammarIssue } from './grammar/types';
import type { Language } from './levelPolicy';

/**
 * Contexto mínimo do aluno enviado à IA. Contém apenas o primeiro nome —
 * e-mail, senha e outros dados pessoais nunca fazem parte deste objeto.
 */
export interface LearnerContext {
  firstName: string;
  level: Level;
  goal: Goal | null;
  interestAreas: InterestArea[];
  explanationLanguage: Language;
  correctionIntensity: CorrectionIntensity;
  replyLength: ReplyLength;
  showTranslations: boolean;
  difficulties: SkillTag[];
}

export interface ChatTurn {
  role: MessageRole;
  content: string;
}

export interface ConversationStartInput {
  learner: LearnerContext;
  topic: ConversationTopic;
  /** Abertura definida pela aula quando a conversa nasce de "Praticar isso". */
  lessonOpener?: Bilingual;
}

export interface ConversationTurnInput {
  learner: LearnerContext;
  topic: ConversationTopic;
  context: ConversationContext;
  /** Mensagens recentes (já limitadas e sem dados pessoais). */
  history: ChatTurn[];
  userMessage: string;
}

export interface AssistantReply {
  reply: string;
  /** Tradução de apoio da resposta (níveis iniciais). */
  translation: string | null;
  context: ConversationContext;
}

export interface ConversationTurnOutput extends AssistantReply {
  /** Todos os problemas detectados; a política de correção decide o que exibir. */
  issues: GrammarIssue[];
}

export type ExplainStyle = 'another_way' | 'simpler';

export interface ExplainInput {
  learner: LearnerContext;
  lesson: Lesson;
  style: ExplainStyle;
  /** Quantas vezes o usuário já pediu (permite variar a explicação). */
  attempt: number;
}

export interface ExampleInput {
  learner: LearnerContext;
  lesson: Lesson;
  attempt: number;
}

export interface CorrectInput {
  learner: LearnerContext;
  exercise: Exercise;
  answer: string;
}

export interface CorrectOutput {
  issues: GrammarIssue[];
  /** Comentário curto e encorajador sobre a resposta aberta. */
  feedback: string;
}

export interface GenerateExerciseInput {
  learner: LearnerContext;
  skillTag: SkillTag;
  excludeIds: string[];
}

export interface AIService {
  /** Nome do provedor ativo ("mock", "anthropic"…), exibido de forma discreta na interface. */
  readonly providerName: string;
  startConversation(input: ConversationStartInput): Promise<AssistantReply>;
  conversation(input: ConversationTurnInput): Promise<ConversationTurnOutput>;
  explain(input: ExplainInput): Promise<string>;
  anotherExample(input: ExampleInput): Promise<Example>;
  correct(input: CorrectInput): Promise<CorrectOutput>;
  generateExercise(input: GenerateExerciseInput): Promise<Exercise | null>;
}

export function emptyConversationContext(): ConversationContext {
  return { facts: {}, askedQuestionIds: [], turn: 0, turnsSinceInlineCorrection: 2 };
}

/** Próxima pergunta do roteiro: ainda não feita e sobre algo que o usuário ainda não contou. */
export function nextScriptedQuestion(topic: ConversationTopic, context: ConversationContext): ScriptedQuestion | null {
  return (
    topic.questions.find(
      (question) => !context.askedQuestionIds.includes(question.id) && !(question.asks ?? []).some((fact) => context.facts[fact]),
    ) ?? null
  );
}
