import type {
  ConversationTopic,
  Exercise,
  Lesson,
  PlacementQuestion,
  PublicExercise,
  PublicPlacementQuestion,
  VocabularyEntry,
} from '../domain/content';
import { LESSONS } from './lessons';
import { PLACEMENT_QUESTIONS } from './placement';
import { CONVERSATION_TOPICS, LESSON_PRACTICE_PREFIX } from './topics';
import { VOCABULARY } from './vocabulary';

const VOCABULARY_EXERCISE_PREFIX = 'vocab:';

/**
 * Acesso somente-leitura ao conteúdo pedagógico. No MVP o conteúdo é versionado em código;
 * a interface permite trocar por um CMS ou tabelas administradas no futuro (ator Administrador).
 */
export interface ContentCatalog {
  lessons(): readonly Lesson[];
  lesson(id: string): Lesson | undefined;
  exercise(id: string): { exercise: Exercise; lesson: Lesson | null } | undefined;
  vocabulary(): readonly VocabularyEntry[];
  vocabularyEntry(id: string): VocabularyEntry | undefined;
  placementQuestions(): readonly PlacementQuestion[];
  topics(): readonly ConversationTopic[];
  topic(id: string): ConversationTopic | undefined;
}

/** Exercício de revisão de vocabulário gerado a partir do catálogo (múltipla escolha de tradução). */
export function buildVocabularyExercise(entry: VocabularyEntry, all: readonly VocabularyEntry[]): Exercise {
  const distractors = all
    .filter((other) => other.id !== entry.id && other.partOfSpeech === entry.partOfSpeech)
    .sort((a, b) => Math.abs(a.word.length - entry.word.length) - Math.abs(b.word.length - entry.word.length) || a.id.localeCompare(b.id))
    .slice(0, 3)
    .map((other) => other.translation);
  const options = [entry.translation, ...distractors];
  // Rotação determinística para que a resposta não fique sempre na primeira posição.
  const shift = entry.id.length % options.length;
  const rotated = [...options.slice(shift), ...options.slice(0, shift)];
  const example = entry.examples[0];
  return {
    id: `${VOCABULARY_EXERCISE_PREFIX}${entry.id}`,
    lessonId: null,
    type: 'multiple_choice',
    instruction: 'Escolha a tradução correta.',
    prompt: `O que significa "${entry.word}"?`,
    options: rotated,
    acceptedAnswers: [entry.translation],
    explanation: {
      pt: `"${entry.word}" significa ${entry.translation}.${example ? ` Exemplo: ${example.en} (${example.pt})` : ''}`,
      en: `"${entry.word}": ${entry.meaning}.${example ? ` Example: ${example.en}` : ''}`,
    },
    skillTag: 'vocabulary',
  };
}

function practiceTopic(lesson: Lesson): ConversationTopic {
  return {
    id: `${LESSON_PRACTICE_PREFIX}${lesson.id}`,
    title: `Praticar: ${lesson.title}`,
    titleEn: `Practice: ${lesson.topic}`,
    description: `Conversa curta para usar o que você estudou em "${lesson.title}".`,
    icon: 'graduation-cap',
    areas: ['education'],
    recommendedFrom: lesson.level,
    questions: [
      { id: `${lesson.id}-practice`, low: lesson.practice.question, high: lesson.practice.question, lowPt: lesson.practice.opener.pt },
    ],
  };
}

export function createStaticCatalog(): ContentCatalog {
  const lessonById = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));
  const exerciseById = new Map<string, { exercise: Exercise; lesson: Lesson }>();
  for (const lesson of LESSONS) {
    for (const exercise of lesson.exercises) exerciseById.set(exercise.id, { exercise, lesson });
  }
  const vocabularyById = new Map(VOCABULARY.map((entry) => [entry.id, entry]));
  const topicById = new Map(CONVERSATION_TOPICS.map((topic) => [topic.id, topic]));

  return {
    lessons: () => LESSONS,
    lesson: (id) => lessonById.get(id),
    exercise: (id) => {
      const fromLesson = exerciseById.get(id);
      if (fromLesson) return fromLesson;
      if (id.startsWith(VOCABULARY_EXERCISE_PREFIX)) {
        const entry = vocabularyById.get(id.slice(VOCABULARY_EXERCISE_PREFIX.length));
        if (entry) return { exercise: buildVocabularyExercise(entry, VOCABULARY), lesson: null };
      }
      return undefined;
    },
    vocabulary: () => VOCABULARY,
    vocabularyEntry: (id) => vocabularyById.get(id),
    placementQuestions: () => PLACEMENT_QUESTIONS,
    topics: () => CONVERSATION_TOPICS,
    topic: (id) => {
      if (id.startsWith(LESSON_PRACTICE_PREFIX)) {
        const lesson = lessonById.get(id.slice(LESSON_PRACTICE_PREFIX.length));
        return lesson ? practiceTopic(lesson) : undefined;
      }
      return topicById.get(id);
    },
  };
}

/** Remove o gabarito antes de enviar o exercício ao cliente. */
export function toPublicExercise(exercise: Exercise): PublicExercise {
  const { acceptedAnswers: _answers, explanation: _explanation, requirements: _requirements, ...rest } = exercise;
  return rest;
}

export function toPublicPlacementQuestion(question: PlacementQuestion): PublicPlacementQuestion {
  const { answer: _answer, ...rest } = question;
  return rest;
}
