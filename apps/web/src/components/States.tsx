import { AlertTriangle, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '../utils/cx';
import { Button } from './Button';
import styles from './States.module.css';

export function LoadingState({ label = 'Carregando…', fullscreen }: { label?: string; fullscreen?: boolean }) {
  return (
    <div className={cx(styles.loading, fullscreen && styles.fullscreen)} role="status" aria-live="polite">
      <span className={styles.dots} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ lines = 3, height }: { lines?: number; height?: number }) {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} style={height ? { height } : undefined} />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  illustration,
  headingLevel = 2,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  illustration?: ReactNode;
  /** 1 quando o estado vazio é o conteúdo principal da página (ex.: 404). */
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <div className={styles.empty}>
      <div className={styles.emptyArt} aria-hidden="true">
        {illustration ?? <EmptyNotebook />}
      </div>
      <Heading className={styles.emptyTitle} {...(headingLevel === 1 ? { 'data-page-title': true, tabIndex: -1 } : {})}>
        {title}
      </Heading>
      {description && <p className={styles.emptyText}>{description}</p>}
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  );
}

/**
 * Erro ao carregar. Só mostre "Tentar de novo" (`onRetry`) quando repetir pode resolver;
 * para outros casos passe `actions` (ex.: voltar à lista). Ver app/QueryErrorState.tsx.
 */
export function ErrorState({
  title = 'Não foi possível carregar',
  message,
  onRetry,
  actions,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.error} role="alert">
      <AlertTriangle aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {(onRetry || actions) && (
        <div className={styles.errorActions}>
          {onRetry && (
            <Button variant="secondary" size="sm" icon={<RotateCcw aria-hidden="true" />} onClick={onRetry}>
              Tentar de novo
            </Button>
          )}
          {actions}
        </div>
      )}
    </div>
  );
}

export function InlineAlert({ tone = 'error', children }: { tone?: 'error' | 'info' | 'success' | 'almost'; children: ReactNode }) {
  return (
    <div className={cx(styles.inline, styles[`inline_${tone}`])} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

function EmptyNotebook() {
  return (
    <svg viewBox="0 0 120 96" width="120" height="96">
      <rect x="14" y="10" width="76" height="72" rx="10" fill="var(--surface)" stroke="var(--line-input)" strokeWidth="2" />
      <path d="M28 32h48M28 44h40M28 56h30" stroke="var(--line)" strokeWidth="5" strokeLinecap="round" />
      <path d="M28 44h22" stroke="var(--marker)" strokeWidth="9" strokeLinecap="round" opacity="0.9" />
      <rect x="62" y="46" width="44" height="30" rx="9" fill="var(--talk)" />
      <path d="M96 74v10l-9-8z" fill="var(--talk)" />
      <circle cx="74" cy="61" r="3" fill="#fff" />
      <circle cx="84" cy="61" r="3" fill="#fff" />
      <circle cx="94" cy="61" r="3" fill="#fff" />
    </svg>
  );
}
