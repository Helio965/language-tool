import type { Bilingual } from '../../domain/content';
import type { CorrectionSeverity } from '../../domain/entities';
import type { SkillTag } from '../../domain/skills';

/** Um problema encontrado em um trecho do texto do usuário. */
export interface GrammarIssue {
  ruleId: string;
  skillTag: SkillTag;
  severity: CorrectionSeverity;
  /** Posição do trecho no texto original. */
  start: number;
  /** Trecho original exatamente como o usuário escreveu. */
  original: string;
  /** Substituição sugerida para o trecho. */
  replacement: string;
  explanation: Bilingual;
  tip?: Bilingual;
}

export interface GrammarRule {
  id: string;
  skillTag: SkillTag;
  severity: CorrectionSeverity;
  /** Precisa ter a flag "g". */
  pattern: RegExp;
  /** Devolve a substituição do trecho ou null para ignorar (proteção contra falso positivo). */
  replace: (match: RegExpExecArray, text: string) => string | null;
  explanation: Bilingual;
  tip?: Bilingual;
}
