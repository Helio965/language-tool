import type { PlacementQuestion } from '../domain/content';

/**
 * Atividades do nivelamento (UC04). Organizadas em etapas: cada etapa verifica o conteúdo
 * de um nível. O sistema só apresenta a etapa seguinte se o usuário for bem na atual
 * ("apresenta novas atividades conforme necessário").
 */
export const PLACEMENT_QUESTIONS: readonly PlacementQuestion[] = [
  // Etapa 1 — conteúdo Iniciante
  {
    id: 'p1',
    stage: 'beginner',
    instruction: 'Complete a frase.',
    prompt: 'Hello! My name ___ Ana.',
    options: ['is', 'am', 'are', 'be'],
    answer: 'is',
    skillTag: 'to_be',
  },
  {
    id: 'p2',
    stage: 'beginner',
    instruction: 'Escolha a tradução.',
    prompt: 'O que significa "blue"?',
    options: ['vermelho', 'azul', 'verde', 'amarelo'],
    answer: 'azul',
    skillTag: 'vocabulary',
  },
  {
    id: 'p3',
    stage: 'beginner',
    instruction: 'Complete a frase.',
    prompt: 'I ___ a student.',
    options: ['am', 'is', 'are', 'have'],
    answer: 'am',
    skillTag: 'to_be',
  },
  {
    id: 'p4',
    stage: 'beginner',
    instruction: 'Escolha a resposta correta.',
    prompt: 'Como se diz 15 em inglês?',
    options: ['fifty', 'fifteen', 'five', 'fourteen'],
    answer: 'fifteen',
    skillTag: 'numbers',
  },
  // Etapa 2 — conteúdo Básico
  {
    id: 'p5',
    stage: 'basic',
    instruction: 'Complete a frase.',
    prompt: 'She ___ to work by bus.',
    options: ['go', 'goes', 'going', 'is go'],
    answer: 'goes',
    skillTag: 'simple_present',
  },
  {
    id: 'p6',
    stage: 'basic',
    instruction: 'Complete a pergunta.',
    prompt: '___ you like coffee?',
    options: ['Do', 'Does', 'Are', 'Is'],
    answer: 'Do',
    skillTag: 'questions_negatives',
  },
  {
    id: 'p7',
    stage: 'basic',
    instruction: 'Complete a frase.',
    prompt: 'Yesterday I ___ a great movie.',
    options: ['see', 'seen', 'saw', 'seeing'],
    answer: 'saw',
    skillTag: 'simple_past',
  },
  {
    id: 'p8',
    stage: 'basic',
    instruction: 'Complete a frase.',
    prompt: 'The meeting is ___ Monday.',
    options: ['in', 'on', 'at', 'to'],
    answer: 'on',
    skillTag: 'prepositions',
  },
  // Etapa 3 — conteúdo Intermediário
  {
    id: 'p9',
    stage: 'intermediate',
    instruction: 'Complete the sentence.',
    prompt: 'I ___ here since 2019.',
    options: ['live', 'lived', 'have lived', 'am living'],
    answer: 'have lived',
    skillTag: 'present_perfect',
  },
  {
    id: 'p10',
    stage: 'intermediate',
    instruction: 'Complete the sentence.',
    prompt: 'If I ___ more time, I would travel more.',
    options: ['have', 'had', 'will have', 'would have'],
    answer: 'had',
    skillTag: 'word_choice',
  },
  {
    id: 'p11',
    stage: 'intermediate',
    instruction: 'Read and answer.',
    passage:
      'Marta used to work in a bank, but she was never really happy there. Two years ago, she quit her job and opened a small bakery. It is hard work, but she says she has never felt so alive.',
    prompt: 'How does Marta feel about her new job?',
    options: [
      'She finds it hard but very rewarding.',
      'She wants to go back to the bank.',
      'She thinks it is easy and boring.',
      'She has not started it yet.',
    ],
    answer: 'She finds it hard but very rewarding.',
    skillTag: 'reading',
  },
  {
    id: 'p12',
    stage: 'intermediate',
    instruction: 'Complete the sentence.',
    prompt: "I'm really looking forward to ___ you.",
    options: ['meet', 'meeting', 'met', 'be meeting'],
    answer: 'meeting',
    skillTag: 'word_choice',
  },
];

export const PLACEMENT_STAGES = ['beginner', 'basic', 'intermediate'] as const;
/** Acertos mínimos por etapa (de 4) para avançar. */
export const PLACEMENT_PASS_THRESHOLD = 3;
