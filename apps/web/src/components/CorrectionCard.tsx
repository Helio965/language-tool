import { ChevronDown, Lightbulb } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import type { Correction } from '@english-ai/core';
import { cx } from '../utils/cx';
import styles from './CorrectionCard.module.css';

/** Marca os trechos alterados dentro de uma frase. */
function markSpans(text: string, spans: string[], className: string): ReactNode {
  const ranges: Array<[number, number]> = [];
  for (const span of spans) {
    if (!span) continue;
    const index = text.indexOf(span);
    if (index >= 0 && !ranges.some(([start, end]) => index < end && start < index + span.length)) ranges.push([index, index + span.length]);
  }
  if (!ranges.length) return text;
  ranges.sort((a, b) => a[0] - b[0]);
  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], i) => {
    parts.push(text.slice(cursor, start));
    parts.push(
      <mark key={i} className={className}>
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  parts.push(text.slice(cursor));
  return parts;
}

const SEVERITY_LABEL: Record<Correction['severity'], string> = {
  meaning: 'Muda o sentido',
  grammar: 'Gramática',
  naturalness: 'Mais natural',
};

/**
 * Correção pedagógica no formato definido na Especificação (UC07):
 * Sua frase → Forma recomendada → Explicação.
 * Variante "chat": discreta, para não interromper a conversa (RN04).
 */
export function CorrectionCard({ correction, variant = 'learn' }: { correction: Correction; variant?: 'learn' | 'chat' }) {
  const [open, setOpen] = useState(variant === 'learn');
  const explanationId = useId();
  const from = correction.changes.map((change) => change.from);
  const to = correction.changes.map((change) => change.to);
  const explanation = correction.explanation.split('\n').filter(Boolean);

  if (variant === 'chat') {
    return (
      <div className={styles.chat}>
        <div className={styles.chatRow}>
          <span className={styles.chatLabel}>You said</span>
          <span className={styles.original} lang="en">
            {markSpans(correction.original, from, styles.removed ?? '')}
          </span>
        </div>
        <div className={styles.chatRow}>
          <span className={styles.chatLabel}>More natural</span>
          <span className={styles.suggestion} lang="en">
            {markSpans(correction.suggestion, to, 'marker')}
          </span>
        </div>
        <button
          type="button"
          className={styles.why}
          aria-expanded={open}
          aria-controls={explanationId}
          onClick={() => setOpen((value) => !value)}
        >
          Por quê?
          <ChevronDown aria-hidden="true" className={cx(styles.chevron, open && styles.chevronOpen)} />
        </button>
        <div id={explanationId} hidden={!open} className={styles.chatExplanation}>
          {explanation.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {correction.tip && (
            <p className={styles.tip}>
              <Lightbulb aria-hidden="true" /> {correction.tip}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.row}>
        <span className="caption">Sua frase</span>
        <p className={styles.original} lang="en">
          {markSpans(correction.original, from, styles.removed ?? '')}
        </p>
      </div>
      <div className={styles.row}>
        <span className="caption">
          Forma recomendada <span className={styles.severity}>· {SEVERITY_LABEL[correction.severity]}</span>
        </span>
        <p className={styles.suggestion} lang="en">
          {markSpans(correction.suggestion, to, 'marker')}
        </p>
      </div>
      <div className={styles.row}>
        <span className="caption">Explicação</span>
        {explanation.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {correction.tip && (
          <p className={styles.tip}>
            <Lightbulb aria-hidden="true" /> {correction.tip}
          </p>
        )}
      </div>
    </div>
  );
}
