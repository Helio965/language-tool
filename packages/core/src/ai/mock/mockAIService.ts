/**
 * Modo DEMONSTRAÇÃO da IA: respostas determinísticas, sem chamadas externas e sem custo.
 * Garante que o protótipo funcione sem chave de API (prompt do projeto, item 29).
 */
import type { Bilingual, Example, Exercise, ScriptedQuestion } from '../../domain/content';
import type { ConversationContext } from '../../domain/entities';
import type { ContentCatalog } from '../../content/catalog';
import { countWords } from '../../domain/text';
import { applyIssues, checkGrammar } from '../grammar/checker';
import type { GrammarIssue } from '../grammar/types';
import { policyFor } from '../levelPolicy';
import { ASSISTANT_PERSONA, withAssistantName } from '../persona';
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
  LearnerContext,
} from '../types';
import { emptyConversationContext, nextScriptedQuestion } from '../types';
import {
  answerQuestion,
  extractFacts,
  isOffensive,
  isQuestion,
  looksPortuguese,
  toSecondPerson,
  vocabularyQuery,
} from './understanding';

const REACTIONS_LOW: Bilingual[] = [
  { en: 'Nice!', pt: 'Legal!' },
  { en: 'Cool!', pt: 'Que legal!' },
  { en: 'That sounds great!', pt: 'Parece ótimo!' },
  { en: 'Oh, interesting!', pt: 'Ah, interessante!' },
  { en: 'I see.', pt: 'Entendi.' },
];

const REACTIONS_HIGH: Bilingual[] = [
  { en: 'That sounds really interesting.', pt: 'Parece muito interessante.' },
  { en: 'Oh, I love that.', pt: 'Ah, adorei isso.' },
  { en: 'Fair enough!', pt: 'Faz sentido!' },
  { en: 'That makes a lot of sense.', pt: 'Isso faz muito sentido.' },
  { en: 'Nice — thanks for sharing that.', pt: 'Legal — obrigada por compartilhar.' },
];

const FACT_REACTIONS: Record<string, (value: string) => Bilingual> = {
  name: (v) => ({ en: `Nice to meet you, ${v}!`, pt: `Prazer em conhecer você, ${v}!` }),
  age: (v) => ({ en: `${v} — cool!`, pt: `${v} — legal!` }),
  from: (v) => ({ en: `${v}? How nice! I'd love to know more about it.`, pt: `${v}? Que legal! Adoraria saber mais.` }),
  city: (v) => ({ en: `${v} sounds like a great place.`, pt: `${v} parece um ótimo lugar.` }),
  job: (v) => ({ en: `A ${v}? That's interesting!`, pt: `${v}? Interessante!` }),
  likes: (v) => ({ en: `Oh, you like ${v}. Nice!`, pt: `Ah, você gosta de ${v}. Legal!` }),
  food: (v) => ({ en: `${v}? Yum! Great choice.`, pt: `${v}? Hum! Ótima escolha.` }),
};

/** Continuação neutra depois de reformular a frase (evita "Oh, so… Oh, I love that."). */
const RECAST_FOLLOW_UPS: Record<'low' | 'high', Bilingual[]> = {
  low: [
    { en: 'Cool!', pt: 'Que legal!' },
    { en: 'Nice!', pt: 'Legal!' },
    { en: 'Got it!', pt: 'Entendi!' },
  ],
  high: [
    { en: 'Good to know.', pt: 'Bom saber.' },
    { en: 'Got it.', pt: 'Entendi.' },
    { en: 'Nice.', pt: 'Legal.' },
  ],
};

const ELABORATE: Record<'low' | 'high', Bilingual> = {
  low: { en: 'Can you tell me a little more?', pt: 'Você pode me contar um pouco mais?' },
  high: { en: "Tell me more — I'm curious!", pt: 'Me conte mais — fiquei curiosa!' },
};

const WRAP_UP: Record<'low' | 'high', Bilingual> = {
  low: {
    en: "You're doing great! Tell me anything you want, or end the chat to see your feedback.",
    pt: 'Você está indo muito bem! Me conte o que quiser ou encerre a conversa para ver seu feedback.',
  },
  high: {
    en: "This has been a great chat! Feel free to keep going, or wrap up to see your feedback.",
    pt: 'Que ótima conversa! Pode continuar ou encerrar para ver seu feedback.',
  },
};

function pick<T>(list: readonly T[], index: number): T {
  return list[((index % list.length) + list.length) % list.length] as T;
}

function questionText(question: ScriptedQuestion, band: 'low' | 'high'): Bilingual {
  return { en: band === 'low' ? question.low : question.high, pt: question.lowPt };
}

/** Frase corrigida (a que mudou), em 2ª pessoa — usada para reformular sem apontar o erro. */
function recastSentence(original: string, corrected: string): string | null {
  const split = (text: string) => text.split(/(?<=[.!?])\s+/);
  const before = split(original);
  const after = split(corrected);
  const changed = after.find((sentence, index) => sentence !== before[index]);
  if (!changed) return null;
  // "Hi! My name is Bia and I am 25 years old." → usa só a oração que contém a correção.
  const clauses = changed.split(/,?\s+(?:and|but)\s+/i);
  const originalClauses = (before[after.indexOf(changed)] ?? '').split(/,?\s+(?:and|but)\s+/i);
  const clause = clauses.find((part, index) => part !== originalClauses[index]) ?? changed;
  if (countWords(clause) > 12) return null;
  return toSecondPerson(clause.replace(/^[A-Z]/, (letter) => (/^(I|I'm)\b/.test(clause) ? letter : letter.toLowerCase())));
}

function join(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part && part.trim())).join(' ');
}

export class MockAIService implements AIService {
  readonly providerName = 'mock';

  constructor(
    private readonly catalog: ContentCatalog,
    private readonly assistantName: string = ASSISTANT_PERSONA.name,
  ) {}

  async startConversation({ learner, topic, lessonOpener }: ConversationStartInput): Promise<AssistantReply> {
    const policy = policyFor(learner.level);
    const context = emptyConversationContext();
    const first = topic.questions[0];
    if (first) context.askedQuestionIds.push(first.id);

    if (lessonOpener) {
      return {
        reply: withAssistantName(lessonOpener.en, this.assistantName),
        translation: learner.showTranslations ? withAssistantName(lessonOpener.pt, this.assistantName) : null,
        context,
      };
    }

    const question = first ? questionText(first, policy.band) : null;
    const greeting: Bilingual =
      policy.band === 'low'
        ? { en: `Hi, ${learner.firstName}! I'm ${this.assistantName}.`, pt: `Oi, ${learner.firstName}! Eu sou ${this.assistantName}.` }
        : { en: `Hey ${learner.firstName}, ${this.assistantName} here!`, pt: `Oi, ${learner.firstName}, aqui é ${this.assistantName}!` };
    const intro: Bilingual =
      topic.id === 'free'
        ? { en: "Let's chat about anything you like.", pt: 'Vamos conversar sobre o que você quiser.' }
        : { en: `Let's talk about ${topic.titleEn.toLowerCase()}.`, pt: `Vamos falar sobre ${topic.title.toLowerCase()}.` };
    return {
      reply: join([greeting.en, intro.en, question?.en]),
      translation: learner.showTranslations ? join([greeting.pt, intro.pt, question?.pt]) : null,
      context,
    };
  }

  async conversation({ learner, topic, context, userMessage }: ConversationTurnInput): Promise<ConversationTurnOutput> {
    const policy = policyFor(learner.level);
    const band = policy.band;
    const turn = context.turn + 1;
    const facts = extractFacts(userMessage);
    const updated: ConversationContext = {
      ...context,
      facts: { ...context.facts, ...facts },
      askedQuestionIds: [...context.askedQuestionIds],
      turn,
    };
    const current = topic.questions.find((q) => q.id === context.askedQuestionIds.at(-1));

    if (isOffensive(userMessage)) {
      const ask = current ? questionText(current, band) : null;
      return this.reply(
        learner,
        updated,
        [{ en: "Let's keep our chat friendly and respectful. Shall we continue?", pt: 'Vamos manter a conversa gentil e respeitosa. Podemos continuar?' }, ask],
        [],
      );
    }

    if (looksPortuguese(userMessage)) {
      const ask = current ? questionText(current, band) : null;
      return this.reply(
        learner,
        updated,
        [{ en: "No problem! Let's try it in English — even a few words are great.", pt: 'Sem problema! Vamos tentar em inglês — mesmo poucas palavras já são ótimas.' }, ask],
        [],
        true,
      );
    }

    const issues = checkGrammar(userMessage);
    const parts: Array<Bilingual | null> = [];

    const term = vocabularyQuery(userMessage);
    if (term) {
      const entry = this.catalog.vocabulary().find((item) => item.word.toLowerCase() === term);
      parts.push(
        entry
          ? {
              en: `"${entry.word}" means "${entry.meaning}". In Portuguese: ${entry.translation}. Example: ${entry.examples[0]?.en ?? ''}`,
              pt: `"${entry.word}" significa ${entry.translation}. Exemplo: ${entry.examples[0]?.pt ?? ''}`,
            }
          : { en: "Good question! That word isn't in my list yet — can you try describing it?", pt: 'Boa pergunta! Essa palavra ainda não está na minha lista — você pode tentar descrevê-la?' },
      );
    } else if (isQuestion(userMessage)) {
      parts.push(answerQuestion(userMessage, this.assistantName));
    } else {
      parts.push(this.reaction(userMessage, facts, issues, band, turn));
    }

    const shortAnswer = countWords(userMessage) < 3 && !isQuestion(userMessage);
    if (shortAnswer && context.turn % 2 === 0) {
      parts.push(ELABORATE[band]);
    } else {
      const next = nextScriptedQuestion(topic, updated);
      if (next) {
        updated.askedQuestionIds.push(next.id);
        parts.push(questionText(next, band));
      } else {
        parts.push(WRAP_UP[band]);
      }
    }

    return { ...this.reply(learner, updated, parts, issues), issues };
  }

  /** Reação natural; quando há erro, "reformula" a frase corretamente (recast) sem interromper. */
  private reaction(message: string, facts: Record<string, string>, issues: GrammarIssue[], band: 'low' | 'high', turn: number): Bilingual {
    const relevant = issues.filter((issue) => issue.severity !== 'naturalness');
    const recast = relevant.length ? recastSentence(message, applyIssues(message, relevant)) : null;
    const factKey = Object.keys(FACT_REACTIONS).find((key) => facts[key]);
    const factReaction = factKey ? FACT_REACTIONS[factKey]?.(facts[factKey] as string) : null;
    if (recast) {
      // Depois de reformular, só reage ao nome — os demais fatos repetiriam a frase sem correção.
      const follow = factKey === 'name' && factReaction ? factReaction : pick(RECAST_FOLLOW_UPS[band], turn);
      return { en: `Oh, so ${recast}. ${follow.en}`, pt: `Ah, entendi. ${follow.pt}` };
    }
    return factReaction ?? pick(band === 'low' ? REACTIONS_LOW : REACTIONS_HIGH, turn);
  }

  private reply(
    learner: LearnerContext,
    context: ConversationContext,
    parts: Array<Bilingual | null>,
    issues: GrammarIssue[],
    forceTranslation = false,
  ): ConversationTurnOutput {
    const present = parts.filter((part): part is Bilingual => part !== null);
    const limited = learner.replyLength === 'short' ? present.slice(-2) : present;
    return {
      reply: join(limited.map((part) => part.en)),
      translation: learner.showTranslations || forceTranslation ? join(limited.map((part) => part.pt)) : null,
      context,
      issues,
    };
  }

  async explain({ learner, lesson, attempt, style }: ExplainInput): Promise<string> {
    const pool = style === 'simpler' ? lesson.alternativeExplanations.slice(0, 1) : lesson.alternativeExplanations;
    const chosen = pick(pool.length ? pool : lesson.explanation, attempt);
    return chosen[learner.explanationLanguage];
  }

  async anotherExample({ lesson, attempt }: ExampleInput): Promise<Example> {
    const pool = [...lesson.extraExamples, ...lesson.examples];
    return pick(pool, attempt);
  }

  async correct({ learner, exercise, answer }: CorrectInput): Promise<CorrectOutput> {
    const issues = checkGrammar(answer);
    const pt = learner.explanationLanguage === 'pt';
    const words = countWords(answer);
    let feedback: string;
    if (issues.length) {
      feedback = pt ? 'Boa tentativa! Veja um ajuste que deixa a frase correta.' : 'Good try! Here is a small fix.';
    } else if (words >= (exercise.minWords ?? 3) + 4) {
      feedback = pt ? 'Excelente! Frase completa e bem construída.' : 'Excellent! A complete, well-built sentence.';
    } else {
      feedback = pt ? 'Muito bem! Sua frase está correta.' : 'Well done! Your sentence is correct.';
    }
    return { issues, feedback };
  }

  async generateExercise({ skillTag, excludeIds }: GenerateExerciseInput): Promise<Exercise | null> {
    for (const lesson of this.catalog.lessons()) {
      const found = lesson.exercises.find(
        (exercise) => exercise.skillTag === skillTag && exercise.type !== 'write' && !excludeIds.includes(exercise.id),
      );
      if (found) return found;
    }
    return null;
  }
}
