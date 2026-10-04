import { useId } from 'react';
import { ASSISTANT_PERSONA } from '@english-ai/core';
import { cx } from '../utils/cx';
import styles from './Brand.module.css';

/** Símbolo: dois balões de fala sobrepostos (português e inglês) formando uma ponte. */
export function LogoMark({ size = 36 }: { size?: number }) {
  const clip = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <clipPath id={clip}>
          <rect x="4" y="6" width="28" height="22" rx="8" />
        </clipPath>
      </defs>
      <rect x="4" y="6" width="28" height="22" rx="8" fill="var(--learn)" />
      <path d="M10 26v9l8-7z" fill="var(--learn)" />
      <rect x="16" y="16" width="28" height="22" rx="8" fill="var(--talk)" />
      <path d="M38 36v9l-8-7z" fill="var(--talk)" />
      <rect x="16" y="16" width="28" height="22" rx="8" fill="var(--ink)" clipPath={`url(#${clip})`} />
    </svg>
  );
}

export function Logo({ size = 34, inverse }: { size?: number; inverse?: boolean }) {
  return (
    <span className={cx(styles.logo, inverse && styles.inverse)}>
      <LogoMark size={size} />
      <span className={styles.wordmark}>
        English<span className={styles.ai}>AI</span>
      </span>
    </span>
  );
}

/** Avatar da assistente: balão coral com uma centelha (indica IA). */
export function AssistantAvatar({ size = 36, thinking }: { size?: number; thinking?: boolean }) {
  return (
    <span className={cx(styles.avatar, thinking && styles.thinking)} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 40 40" width={size} height={size}>
        <rect x="2" y="3" width="36" height="30" rx="11" fill="var(--talk)" />
        <path d="M10 31v7l7-6z" fill="var(--talk)" />
        <path
          className={styles.spark}
          d="M20 9.5c.9 4.4 2.6 6.1 7 7-4.4.9-6.1 2.6-7 7-.9-4.4-2.6-6.1-7-7 4.4-.9 6.1-2.6 7-7z"
          fill="#fff"
        />
      </svg>
    </span>
  );
}

export function AssistantName() {
  return <>{ASSISTANT_PERSONA.name}</>;
}
