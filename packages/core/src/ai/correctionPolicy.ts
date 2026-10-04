/**
 * Política de correção (RF14, RN04, UC12).
 * Princípio do Modo Conversação: NATURALIDADE > CORREÇÃO EXCESSIVA.
 * A decisão de exibir uma correção é tomada aqui, em código — não depende do modelo de IA.
 */
import type { CorrectionIntensity } from '../domain/entities';
import type { Level } from '../domain/levels';
import type { GrammarIssue } from './grammar/types';

export const CORRECTION_INTENSITY_INFO: Record<CorrectionIntensity, { label: string; description: string }> = {
  light: {
    label: 'Leve',
    description: 'Corrige apenas erros que prejudicam o entendimento. Ideal para ganhar confiança.',
  },
  balanced: {
    label: 'Equilibrada',
    description: 'Corrige erros importantes sem interromper a conversa a todo momento.',
  },
  detailed: {
    label: 'Detalhada',
    description: 'Mostra mais feedback, incluindo dicas de naturalidade e explicações extras.',
  },
};

export interface ConversationCorrectionInput {
  issues: GrammarIssue[];
  intensity: CorrectionIntensity;
  level: Level;
  /** Mensagens do usuário desde a última correção exibida na conversa. */
  turnsSinceInlineCorrection: number;
}

export interface ConversationCorrectionDecision {
  /** Exibidas discretamente junto da mensagem. */
  inline: GrammarIssue[];
  /** Guardadas para o resumo da conversa (não interrompem). */
  deferred: GrammarIssue[];
  /** Não exibidas (ex.: detalhes de escrita no modo leve). */
  ignored: GrammarIssue[];
}

/** Intervalo mínimo entre correções exibidas no modo equilibrado. */
export const BALANCED_MIN_TURNS_BETWEEN_INLINE = 2;

export function decideConversationCorrections(input: ConversationCorrectionInput): ConversationCorrectionDecision {
  const { issues, intensity, level, turnsSinceInlineCorrection } = input;
  const inline: GrammarIssue[] = [];
  const deferred: GrammarIssue[] = [];
  const ignored: GrammarIssue[] = [];
  const beginner = level === 'beginner';

  for (const issue of issues) {
    if (intensity === 'light') {
      if (issue.severity === 'meaning') inline.push(issue);
      else if (issue.severity === 'grammar') deferred.push(issue);
      else ignored.push(issue);
      continue;
    }
    if (intensity === 'balanced') {
      if (issue.severity === 'meaning') inline.push(issue);
      else if (issue.severity === 'grammar') {
        const canInterrupt = turnsSinceInlineCorrection >= BALANCED_MIN_TURNS_BETWEEN_INLINE && inline.length === 0;
        (canInterrupt ? inline : deferred).push(issue);
      } else if (beginner) ignored.push(issue);
      else deferred.push(issue);
      continue;
    }
    // detailed
    if (inline.length < 3) inline.push(issue);
    else deferred.push(issue);
  }
  return { inline, deferred, ignored };
}

/**
 * No Modo Aprender a correção é o objetivo da atividade: todos os erros de sentido e gramática
 * são mostrados; os de naturalidade dependem da intensidade escolhida.
 */
export function selectLearningCorrections(issues: GrammarIssue[], intensity: CorrectionIntensity): GrammarIssue[] {
  return issues.filter((issue) => issue.severity !== 'naturalness' || intensity !== 'light');
}
