/**
 * Níveis pedagógicos ESTIMADOS. Não representam certificação oficial de proficiência
 * (Especificação de Casos de Uso, UC04 — observação).
 */
export const LEVELS = ['beginner', 'basic', 'intermediate', 'advanced'] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = {
  beginner: 'Iniciante',
  basic: 'Básico',
  intermediate: 'Intermediário',
  advanced: 'Avançado',
};

export const LEVEL_DESCRIPTIONS: Record<Level, string> = {
  beginner: 'Primeiros passos: cumprimentos, apresentações, verbo to be e frases simples.',
  basic: 'Rotina e situações práticas: presente, passado, futuro, perguntas e preposições.',
  intermediate: 'Comunicação com mais autonomia: experiências, opiniões e textos mais longos.',
  advanced: 'Foco em naturalidade, vocabulário mais rico e nuances do idioma.',
};

export function levelIndex(level: Level): number {
  return LEVELS.indexOf(level);
}

export function nextLevel(level: Level): Level | null {
  return LEVELS[levelIndex(level) + 1] ?? null;
}

export function isLevel(value: unknown): value is Level {
  return typeof value === 'string' && (LEVELS as readonly string[]).includes(value);
}
