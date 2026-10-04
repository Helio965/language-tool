/**
 * Validação de entrada compartilhada entre front-end (feedback imediato) e back-end (fonte da verdade).
 */
import { AppError, type FieldErrors } from './errors';

export const NAME_MAX = 80;
export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const MESSAGE_MAX = 600;
export const ANSWER_MAX = 400;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface RegistrationInput {
  name: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  acceptedTerms: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateName(name: string): string | null {
  const value = name.trim();
  if (!value) return 'Informe seu nome.';
  if (value.length < 2) return 'O nome precisa ter pelo menos 2 letras.';
  if (value.length > NAME_MAX) return `Use no máximo ${NAME_MAX} caracteres.`;
  return null;
}

export function validateEmail(email: string): string | null {
  const value = email.trim();
  if (!value) return 'Informe seu e-mail.';
  if (value.length > EMAIL_MAX || !EMAIL_PATTERN.test(value)) return 'Digite um e-mail válido, como nome@exemplo.com.';
  return null;
}

export interface PasswordCheck {
  id: 'length' | 'letter' | 'number';
  label: string;
  ok: boolean;
}

/** Regras de senha exibidas em tempo real no cadastro. */
export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { id: 'length', label: `Pelo menos ${PASSWORD_MIN} caracteres`, ok: password.length >= PASSWORD_MIN },
    { id: 'letter', label: 'Uma letra', ok: /[A-Za-zÀ-ÿ]/.test(password) },
    { id: 'number', label: 'Um número', ok: /\d/.test(password) },
  ];
}

export function validatePassword(password: string): string | null {
  if (!password) return 'Crie uma senha.';
  if (password.length > PASSWORD_MAX) return `Use no máximo ${PASSWORD_MAX} caracteres.`;
  if (passwordChecks(password).some((check) => !check.ok)) {
    return `A senha precisa ter ${PASSWORD_MIN}+ caracteres, com letras e números.`;
  }
  return null;
}

export interface NewPasswordInput {
  password: string;
  passwordConfirmation: string;
}

/** Senha nova + confirmação: a mesma política no cadastro e na redefinição de senha. */
export function validateNewPassword(input: NewPasswordInput): FieldErrors {
  const errors: FieldErrors = {};
  const password = validatePassword(input.password);
  if (password) errors.password = password;
  if (!input.passwordConfirmation) errors.passwordConfirmation = 'Confirme sua senha.';
  else if (input.password !== input.passwordConfirmation) errors.passwordConfirmation = 'As senhas não coincidem.';
  return errors;
}

export function validateRegistration(input: RegistrationInput): FieldErrors {
  const errors: FieldErrors = {};
  const name = validateName(input.name);
  const email = validateEmail(input.email);
  if (name) errors.name = name;
  if (email) errors.email = email;
  Object.assign(errors, validateNewPassword(input));
  if (!input.acceptedTerms) errors.acceptedTerms = 'Para continuar, aceite os termos e a política de privacidade.';
  return errors;
}

export function validateLogin(input: LoginInput): FieldErrors {
  const errors: FieldErrors = {};
  const email = validateEmail(input.email);
  if (email) errors.email = email;
  if (!input.password) errors.password = 'Informe sua senha.';
  return errors;
}

export function assertValid(errors: FieldErrors): void {
  if (Object.keys(errors).length > 0) {
    throw new AppError('VALIDATION', 'Dados inválidos.', errors);
  }
}

export function validateMessage(text: string): string | null {
  const value = text.trim();
  if (!value) return 'Escreva uma mensagem.';
  if (value.length > MESSAGE_MAX) return `Use no máximo ${MESSAGE_MAX} caracteres por mensagem.`;
  return null;
}
