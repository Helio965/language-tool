import { ArrowLeft, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { ProgressBar } from './Display';
import styles from './FocusBar.module.css';

/** Barra superior das telas imersivas: sair, título curto, progresso e ação opcional. */
export function FocusBar({
  backTo,
  backLabel = 'Sair',
  icon = 'close',
  title,
  progress,
  progressLabel,
  action,
  onBack,
}: {
  backTo?: string;
  backLabel?: string;
  icon?: 'close' | 'back';
  title?: ReactNode;
  progress?: number;
  progressLabel?: string;
  action?: ReactNode;
  onBack?: () => void;
}) {
  const Icon = icon === 'close' ? X : ArrowLeft;
  return (
    <div className={styles.bar}>
      {backTo ? (
        <Link to={backTo} className={styles.back} aria-label={backLabel} onClick={onBack}>
          <Icon aria-hidden="true" />
        </Link>
      ) : (
        onBack && (
          <button type="button" className={styles.back} aria-label={backLabel} onClick={onBack}>
            <Icon aria-hidden="true" />
          </button>
        )
      )}
      <div className={styles.center}>
        {title && <div className={styles.title}>{title}</div>}
        {progress !== undefined && <ProgressBar value={progress} label={progressLabel ?? 'Progresso'} size="sm" />}
      </div>
      {action ?? <span className={styles.spacer} />}
    </div>
  );
}
