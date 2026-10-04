import { Check, Circle } from 'lucide-react';
import { passwordChecks } from '@english-ai/core';
import styles from './Auth.module.css';

/** Requisitos da senha ao vivo — a mesma política no cadastro e na redefinição de senha. */
export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className={styles.checks} aria-label="Requisitos da senha">
      {passwordChecks(password).map((check) => (
        <li key={check.id} className={check.ok ? styles.ok : undefined}>
          {check.ok ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
          {check.label}
          <span className="visually-hidden">{check.ok ? ' (atendido)' : ' (pendente)'}</span>
        </li>
      ))}
    </ul>
  );
}
