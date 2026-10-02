import type { Correction, CorrectionSeverity } from '../../domain/entities';
import type { Language } from '../levelPolicy';
import { GRAMMAR_RULES } from './rules';
import type { GrammarIssue, GrammarRule } from './types';

export const SEVERITY_WEIGHT: Record<CorrectionSeverity, number> = { meaning: 3, grammar: 2, naturalness: 1 };

function matchCase(original: string, replacement: string): string {
  const first = original.trimStart().charAt(0);
  if (first && first === first.toUpperCase() && first !== first.toLowerCase()) {
    const leading = replacement.length - replacement.trimStart().length;
    return replacement.slice(0, leading) + replacement.charAt(leading).toUpperCase() + replacement.slice(leading + 1);
  }
  return replacement;
}

function capitalizePronounI(text: string): string {
  return text.replace(/(^|\s)i(?=\s|['’]|$)/g, '$1I');
}

function findIssues(text: string, rule: GrammarRule): GrammarIssue[] {
  const issues: GrammarIssue[] = [];
  const pattern = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`);
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    if (match[0].length === 0) {
      pattern.lastIndex += 1;
      continue;
    }
    const raw = rule.replace(match, text);
    if (raw === null) continue;
    const replacement = capitalizePronounI(matchCase(match[0], raw.replace(/\s+/g, ' ')));
    if (replacement === match[0]) continue;
    issues.push({
      ruleId: rule.id,
      skillTag: rule.skillTag,
      severity: rule.severity,
      start: match.index,
      original: match[0],
      replacement,
      explanation: rule.explanation,
      ...(rule.tip ? { tip: rule.tip } : {}),
    });
  }
  return issues;
}

/** Remove sobreposições: mantém o trecho mais longo (mais específico) e, no empate, o mais grave. */
export function resolveOverlaps(issues: GrammarIssue[]): GrammarIssue[] {
  const sorted = [...issues].sort(
    (a, b) =>
      b.original.length - a.original.length ||
      SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] ||
      a.start - b.start,
  );
  const kept: GrammarIssue[] = [];
  for (const issue of sorted) {
    if (issue.start < 0) continue;
    const end = issue.start + issue.original.length;
    const overlaps = kept.some((other) => issue.start < other.start + other.original.length && other.start < end);
    if (!overlaps) kept.push(issue);
  }
  return kept.sort((a, b) => a.start - b.start);
}

/** Verifica o texto e devolve os problemas encontrados, em ordem de aparição. */
export function checkGrammar(text: string, rules: readonly GrammarRule[] = GRAMMAR_RULES): GrammarIssue[] {
  return resolveOverlaps(rules.flatMap((rule) => findIssues(text, rule)));
}

/** Aplica as substituições ao texto original. */
export function applyIssues(text: string, issues: GrammarIssue[]): string {
  return [...issues]
    .filter((issue) => issue.start >= 0 && text.slice(issue.start, issue.start + issue.original.length) === issue.original)
    .sort((a, b) => b.start - a.start)
    .reduce((result, issue) => result.slice(0, issue.start) + issue.replacement + result.slice(issue.start + issue.original.length), text);
}

export function mostSevere(issues: GrammarIssue[]): GrammarIssue | undefined {
  return [...issues].sort((a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity])[0];
}

/**
 * Monta a correção pedagógica no formato exibido ao usuário:
 * "Sua frase / Forma recomendada / Explicação".
 */
export function buildCorrection(text: string, issues: GrammarIssue[], language: Language, includeTip: boolean): Correction | null {
  const main = mostSevere(issues);
  if (!main) return null;
  const uniqueByRule = issues.filter((issue, index) => issues.findIndex((other) => other.ruleId === issue.ruleId) === index);
  const explanation = uniqueByRule.map((issue) => issue.explanation[language]).join('\n');
  const tipSource = includeTip ? uniqueByRule.find((issue) => issue.tip) : undefined;
  return {
    original: text,
    suggestion: applyIssues(text, issues),
    changes: issues.map((issue) => ({ from: issue.original.trim(), to: issue.replacement.trim() })),
    explanation,
    tip: tipSource?.tip ? tipSource.tip[language] : null,
    severity: main.severity,
    skillTag: main.skillTag,
    ruleId: uniqueByRule.map((issue) => issue.ruleId).join('+'),
  };
}
