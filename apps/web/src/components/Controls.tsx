import { useId, type ReactNode } from 'react';
import { cx } from '../utils/cx';
import styles from './Field.module.css';
import choice from './Choice.module.css';

export function Checkbox({
  checked,
  onChange,
  children,
  error,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  error?: string | undefined;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <label className={styles.check} htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span>{children}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  title,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={styles.switchRow} onClick={() => !disabled && onChange(!checked)}>
      <span className={styles.switchText} id={`${id}-label`}>
        <span className={styles.switchTitle}>{title}</span>
        {description && <span className={styles.switchDescription} id={`${id}-desc`}>{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        className={styles.switch}
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onChange(!checked);
        }}
      />
    </div>
  );
}

interface ChoiceOption<T extends string> {
  value: T;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
}

/**
 * Grupo de cartões selecionáveis construído com inputs nativos (radio/checkbox):
 * acessível por teclado e leitores de tela sem código extra.
 */
export function ChoiceGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  multiple,
  columns = 1,
  hideLegend,
  name,
  disabled,
  tone,
}: {
  legend: string;
  options: Array<ChoiceOption<T>>;
  value: T | T[] | null;
  onChange: (value: T) => void;
  multiple?: boolean;
  columns?: 1 | 2 | 3;
  hideLegend?: boolean;
  name?: string;
  disabled?: boolean;
  tone?: (option: T) => 'correct' | 'incorrect' | undefined;
}) {
  const autoName = useId();
  const selected = (option: T) => (Array.isArray(value) ? value.includes(option) : value === option);
  return (
    <fieldset className={choice.group} disabled={disabled}>
      <legend className={cx(choice.legend, hideLegend && 'visually-hidden')}>{legend}</legend>
      <div className={cx(choice.options, columns === 2 && choice.two, columns === 3 && choice.three)}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cx(
              choice.option,
              selected(option.value) && choice.selected,
              tone?.(option.value) === 'correct' && choice.correct,
              tone?.(option.value) === 'incorrect' && choice.incorrect,
            )}
          >
            <input
              className="visually-hidden"
              type={multiple ? 'checkbox' : 'radio'}
              name={name ?? autoName}
              value={option.value}
              checked={selected(option.value)}
              onChange={() => onChange(option.value)}
            />
            {option.icon && <span className={choice.icon} aria-hidden="true">{option.icon}</span>}
            <span className={choice.text}>
              <span className={choice.title}>{option.title}</span>
              {option.description && <span className={choice.description}>{option.description}</span>}
            </span>
            <span className={cx(choice.indicator, multiple && choice.square)} aria-hidden="true" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Chip({
  children,
  selected,
  onClick,
  tone = 'neutral',
  icon,
  as = 'span',
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  tone?: 'neutral' | 'learn' | 'talk' | 'success' | 'almost' | 'error' | 'marker';
  icon?: ReactNode;
  as?: 'span' | 'button';
}) {
  const className = cx(choice.chip, choice[`chip_${tone}`], selected && choice.chipSelected, onClick && choice.chipButton);
  if (as === 'button' || onClick) {
    return (
      <button type="button" className={className} onClick={onClick} aria-pressed={selected}>
        {icon}
        {children}
      </button>
    );
  }
  return (
    <span className={className}>
      {icon}
      {children}
    </span>
  );
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <fieldset className={choice.segmented}>
      <legend className="visually-hidden">{label}</legend>
      {options.map((option) => (
        <label key={option.value} className={cx(choice.segment, value === option.value && choice.segmentActive)}>
          <input
            className="visually-hidden"
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
