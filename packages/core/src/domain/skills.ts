/**
 * Temas (skills) usados para rastrear desempenho, dificuldades e revisão.
 * Cada exercício e cada regra de correção aponta para um tema.
 */
export const SKILL_TAGS = [
  'greetings',
  'alphabet',
  'to_be',
  'numbers',
  'vocabulary',
  'articles',
  'simple_present',
  'questions_negatives',
  'prepositions',
  'simple_past',
  'future',
  'present_perfect',
  'phrasal_verbs',
  'word_choice',
  'writing_mechanics',
  'reading',
] as const;

export type SkillTag = (typeof SKILL_TAGS)[number];

/** Rótulos curtos exibidos ao usuário (o nome do tema em inglês ajuda a criar familiaridade). */
export const SKILL_LABELS: Record<SkillTag, string> = {
  greetings: 'Greetings — cumprimentos',
  alphabet: 'Alphabet — alfabeto',
  to_be: 'Verb to be',
  numbers: 'Numbers — números',
  vocabulary: 'Vocabulary — vocabulário',
  articles: 'Articles — a / an',
  simple_present: 'Simple Present',
  questions_negatives: 'Questions & negatives',
  prepositions: 'Prepositions — in / on / at',
  simple_past: 'Simple Past',
  future: 'Future — will / going to',
  present_perfect: 'Present Perfect',
  phrasal_verbs: 'Phrasal verbs',
  word_choice: 'Word choice — escolha de palavras',
  writing_mechanics: 'Writing — escrita',
  reading: 'Reading — leitura',
};

/** Aula recomendada para revisar cada tema (quando existir). */
export const SKILL_LESSON: Partial<Record<SkillTag, string>> = {
  greetings: 'greetings',
  alphabet: 'alphabet',
  to_be: 'verb-to-be',
  numbers: 'numbers-age',
  vocabulary: 'colors-objects',
  articles: 'colors-objects',
  simple_present: 'simple-present',
  questions_negatives: 'questions-negatives',
  prepositions: 'prepositions',
  simple_past: 'simple-past',
  future: 'future',
  present_perfect: 'present-perfect',
  phrasal_verbs: 'phrasal-verbs',
};
