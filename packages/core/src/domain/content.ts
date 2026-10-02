/**
 * Tipos de conteúdo pedagógico (Aula, Exercício, Vocabulário, Nivelamento, Assuntos de conversa).
 * O conteúdo do MVP é próprio do projeto (RN08) e versionado em packages/core/src/content.
 */
import type { Level } from './levels';
import type { InterestArea } from './profile';
import type { SkillTag } from './skills';

/** Texto disponível nos dois idiomas; a camada de adaptação escolhe qual exibir. */
export interface Bilingual {
  pt: string;
  en: string;
}

export interface ExplanationText extends Bilingual {
  /** Dica extra exibida para iniciantes ou na correção detalhada. */
  tip?: Bilingual;
}

export interface Example {
  en: string;
  pt: string;
  /** Trecho a destacar dentro da frase em inglês. */
  highlight?: string;
  note?: string;
}

export interface GrammarTable {
  caption: string;
  headers: string[];
  rows: string[][];
}

export const EXERCISE_TYPES = [
  'multiple_choice',
  'select_word',
  'fill_blank',
  'translate',
  'write',
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  multiple_choice: 'Múltipla escolha',
  select_word: 'Selecione a palavra',
  fill_blank: 'Complete a frase',
  translate: 'Tradução',
  write: 'Escreva sua resposta',
};

/** Requisitos de exercícios abertos (tipo "write"), avaliados por regras + IA. */
export interface WriteRequirement {
  /** Expressão regular (sem barras) que a resposta precisa conter. */
  pattern: string;
  /** Mensagem exibida quando o requisito não é atendido. */
  message: string;
}

export interface Exercise {
  id: string;
  lessonId: string | null;
  type: ExerciseType;
  /** Instrução em português. */
  instruction: string;
  /** Frase ou pergunta. Em fill_blank/select_word, "___" marca a lacuna. */
  prompt: string;
  options?: string[];
  /** Respostas aceitas (comparadas após normalização). A primeira é a forma recomendada. */
  acceptedAnswers: string[];
  explanation: ExplanationText;
  hint?: string;
  skillTag: SkillTag;
  /** Apenas para "write": requisitos mínimos da resposta. */
  requirements?: WriteRequirement[];
  minWords?: number;
}

/** Versão do exercício enviada ao cliente: sem gabarito. */
export type PublicExercise = Omit<Exercise, 'acceptedAnswers' | 'explanation' | 'requirements'>;

export interface Lesson {
  id: string;
  level: Level;
  order: number;
  title: string;
  /** Tópico em inglês (ex.: "Verb to be"). */
  topic: string;
  summary: string;
  estimatedMinutes: number;
  skillTags: SkillTag[];
  objectives: string[];
  explanation: Bilingual[];
  /** Explicações alternativas usadas em "Explicar de outro jeito". */
  alternativeExplanations: Bilingual[];
  table?: GrammarTable;
  examples: Example[];
  /** Exemplos extras usados em "Me dê outro exemplo". */
  extraExamples: Example[];
  vocabularyIds: string[];
  exercises: Exercise[];
  /** Atividade curta de conversação ao final da aula (Análise de requisitos §12, passo 8). */
  practice: { opener: Bilingual; question: string };
  /** Resumo exibido ao concluir. */
  takeaways: string[];
}

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'expression'
  | 'number'
  | 'pronoun'
  | 'preposition';

export const PART_OF_SPEECH_LABELS: Record<PartOfSpeech, string> = {
  noun: 'substantivo',
  verb: 'verbo',
  adjective: 'adjetivo',
  adverb: 'advérbio',
  expression: 'expressão',
  number: 'número',
  pronoun: 'pronome',
  preposition: 'preposição',
};

export interface VocabularyEntry {
  id: string;
  word: string;
  translation: string;
  /** Significado simples em inglês. */
  meaning: string;
  partOfSpeech: PartOfSpeech;
  level: Level;
  topic: string;
  examples: Array<{ en: string; pt: string }>;
  /** Preparado para versões futuras (pronúncia); não usado no MVP. */
  phonetic?: string;
}

export interface PlacementQuestion {
  id: string;
  /** Nível cujo conteúdo a pergunta verifica. */
  stage: Level;
  instruction: string;
  prompt: string;
  /** Texto de apoio (leitura). */
  passage?: string;
  options: string[];
  answer: string;
  skillTag: SkillTag;
}

export type PublicPlacementQuestion = Omit<PlacementQuestion, 'answer'>;

export interface ScriptedQuestion {
  id: string;
  low: string;
  high: string;
  /** Tradução de apoio da versão "low". */
  lowPt: string;
}

export interface ConversationTopic {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  icon: string;
  areas: InterestArea[];
  /** Nível mínimo recomendado (o usuário pode escolher qualquer assunto). */
  recommendedFrom: Level;
  questions: ScriptedQuestion[];
}
