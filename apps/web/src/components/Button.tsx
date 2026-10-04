import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { cx } from '../utils/cx';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';

interface BaseProps {
  variant?: ButtonVariant;
  size?: 'md' | 'lg' | 'sm';
  block?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  icon?: ReactNode;
  iconEnd?: ReactNode;
  children: ReactNode;
  className?: string;
}

type ButtonProps = BaseProps & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { to?: undefined };
type LinkProps = BaseProps & { to: string; state?: unknown; onClick?: () => void };

function classes({ variant = 'primary', size = 'md', block, loading, className }: BaseProps) {
  return cx(styles.button, styles[variant], styles[size], block && styles.block, loading && styles.loading, className);
}

function Content({ icon, iconEnd, loading, loadingLabel, children }: BaseProps) {
  return (
    <>
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
      {!loading && iconEnd}
    </>
  );
}

/** Botão do design system. Com `to`, vira um link com aparência de botão. */
export function Button(props: ButtonProps | LinkProps) {
  if (props.to !== undefined) {
    const { to, state, onClick, ...rest } = props as LinkProps;
    return (
      <Link to={to} state={state} onClick={onClick} className={classes(rest)}>
        <Content {...rest} />
      </Link>
    );
  }
  const { variant, size, block, loading, loadingLabel, icon, iconEnd, children, className, type = 'button', disabled, ...rest } =
    props as ButtonProps;
  return (
    <button
      type={type}
      className={classes({ variant, size, block, loading, className, children })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Content icon={icon} iconEnd={iconEnd} loading={loading} loadingLabel={loadingLabel}>
        {children}
      </Content>
    </button>
  );
}
