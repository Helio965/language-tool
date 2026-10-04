import { BookOpen, MessagesSquare } from 'lucide-react';
import type { ReactNode } from 'react';
import { LEVEL_LABELS, type Level } from '@english-ai/core';
import { cx } from '../utils/cx';
import styles from './Display.module.css';

export function Card({
  children,
  className,
  tone = 'default',
  as: Tag = 'section',
  ...rest
}: {
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'accent' | 'learn' | 'talk' | 'ink' | 'marker' | 'flat';
  as?: 'section' | 'div' | 'article' | 'aside';
  'aria-labelledby'?: string;
  'aria-label'?: string;
}) {
  return (
    <Tag className={cx(styles.card, styles[`card_${tone}`], className)} {...rest}>
      {children}
    </Tag>
  );
}

export function ProgressBar({
  value,
  label,
  tone = 'accent',
  size = 'md',
  showValue,
}: {
  value: number;
  label: string;
  tone?: 'accent' | 'learn' | 'talk' | 'success' | 'ink';
  size?: 'sm' | 'md';
  showValue?: boolean;
}) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className={styles.progressWrap}>
      <div
        className={cx(styles.progress, styles[`progress_${size}`])}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span className={cx(styles.progressFill, styles[`fill_${tone}`])} style={{ width: `${percent}%` }} />
      </div>
      {showValue && <span className={styles.progressValue}>{percent}%</span>}
    </div>
  );
}

export function ProgressRing({
  value,
  size = 72,
  label,
  children,
  tone = 'success',
}: {
  value: number;
  size?: number;
  label: string;
  children?: ReactNode;
  tone?: 'success' | 'learn' | 'talk';
}) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className={styles.ring} style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--paper-deep)" strokeWidth={stroke} />
        <circle
          className={styles.ringValue}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`var(--${tone === 'success' ? 'success' : tone})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {children && <span className={styles.ringLabel}>{children}</span>}
    </div>
  );
}

export function StatTile({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statTop}>
        {icon && <span className={styles.statIcon} aria-hidden="true">{icon}</span>}
        <span className={styles.statLabel}>{label}</span>
      </div>
      <strong className={styles.statValue}>{value}</strong>
      {hint && <span className={styles.statHint}>{hint}</span>}
    </div>
  );
}

export function LevelBadge({ level, prefix = 'Nível estimado' }: { level: Level | null; prefix?: string }) {
  if (!level) return null;
  return (
    <span className={styles.levelBadge} title="Estimativa pedagógica — não é certificação oficial">
      <span className={styles.levelBars} aria-hidden="true" data-level={level}>
        <i />
        <i />
        <i />
        <i />
      </span>
      <span>
        <span className="visually-hidden">{prefix}: </span>
        {LEVEL_LABELS[level]}
      </span>
    </span>
  );
}

export function ModeBadge({ mode }: { mode: 'learn' | 'talk' }) {
  return (
    <span className={cx(styles.modeBadge, styles[`mode_${mode}`])}>
      {mode === 'learn' ? <BookOpen aria-hidden="true" /> : <MessagesSquare aria-hidden="true" />}
      {mode === 'learn' ? 'Modo Aprender' : 'Modo Conversação'}
    </span>
  );
}

/** Destaca um trecho com o "marca-texto" do design system. */
export function Highlight({ text, highlight }: { text: string; highlight?: string | undefined }) {
  if (!highlight) return <>{text}</>;
  const index = text.toLowerCase().indexOf(highlight.toLowerCase());
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="marker">{text.slice(index, index + highlight.length)}</mark>
      {text.slice(index + highlight.length)}
    </>
  );
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx(styles.pageHeader, className)}>
      <div className={styles.pageHeaderText}>
        {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
        <h1 tabIndex={-1} data-page-title>
          {title}
        </h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.pageActions}>{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className={styles.sectionTitle}>
      <h2 id={id}>{children}</h2>
      {action}
    </div>
  );
}
