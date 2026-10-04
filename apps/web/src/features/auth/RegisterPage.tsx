import { Check, Circle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { passwordChecks, validateRegistration, type FieldErrors } from '@english-ai/core';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Controls';
import { InlineAlert } from '../../components/States';
import { PasswordField, TextField } from '../../components/TextField';
import { useToast } from '../../components/Overlay';
import { AuthLayout } from '../../layouts/AuthLayout';
import { useSession } from '../../app/session';
import { ApiError, errorMessage } from '../../services';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import styles from './Auth.module.css';

/** UC01 — Criar conta: apenas os dados necessários, validação em tempo real e feedback claro. */
export function RegisterPage() {
  useDocumentTitle('Criar conta');
  const { api, setAccount } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', password: '', passwordConfirmation: '', acceptedTerms: false });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [emailInUse, setEmailInUse] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clientErrors = validateRegistration(form);
  const visibleError = (field: keyof typeof form) =>
    serverErrors[field] ?? (submitted || touched[field] ? clientErrors[field] : undefined);
  const update = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
    setServerErrors((current) => ({ ...current, [field]: undefined as unknown as string }));
    if (field === 'email') setEmailInUse(false);
  };
  const blur = (field: string) => setTouched((current) => ({ ...current, [field]: true }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setGeneralError(null);
    if (Object.keys(clientErrors).length) {
      const first = Object.keys(clientErrors)[0];
      document.getElementById(`register-${first}`)?.focus();
      return;
    }
    setLoading(true);
    try {
      const account = await api.register(form);
      setAccount(account);
      toast('Conta criada! Vamos personalizar seus estudos.');
      navigate('/configuracao');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EMAIL_IN_USE') setEmailInUse(true);
      else if (error instanceof ApiError && Object.keys(error.fields).length) setServerErrors(error.fields);
      else setGeneralError(errorMessage(error));
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className={styles.head}>
        <h1>Crie sua conta</h1>
        <p className="muted">Leva menos de um minuto. Depois, vamos entender seu objetivo e estimar seu nível.</p>
      </div>
      <form className={styles.form} onSubmit={submit} noValidate>
        {generalError && <InlineAlert>{generalError}</InlineAlert>}
        <TextField
          id="register-name"
          label="Nome"
          autoComplete="given-name"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
          onBlur={() => blur('name')}
          error={visibleError('name')}
          maxLength={80}
        />
        <TextField
          id="register-email"
          label="E-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={form.email}
          onChange={(e) => update('email', e.target.value)}
          onBlur={() => blur('email')}
          error={visibleError('email')}
        />
        {emailInUse && (
          <InlineAlert>
            Já existe uma conta com este e-mail.{' '}
            <Link to="/entrar" state={{ email: form.email }}>
              Entrar com este e-mail
            </Link>
          </InlineAlert>
        )}
        <PasswordField
          id="register-password"
          label="Senha"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => update('password', e.target.value)}
          onBlur={() => blur('password')}
          error={visibleError('password')}
          hint={
            <ul className={styles.checks} aria-label="Requisitos da senha">
              {passwordChecks(form.password).map((check) => (
                <li key={check.id} className={check.ok ? styles.ok : undefined}>
                  {check.ok ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
                  {check.label}
                  <span className="visually-hidden">{check.ok ? ' (atendido)' : ' (pendente)'}</span>
                </li>
              ))}
            </ul>
          }
        />
        <PasswordField
          id="register-passwordConfirmation"
          label="Confirme a senha"
          autoComplete="new-password"
          value={form.passwordConfirmation}
          onChange={(e) => update('passwordConfirmation', e.target.value)}
          onBlur={() => blur('passwordConfirmation')}
          error={visibleError('passwordConfirmation')}
        />
        <Checkbox
          checked={form.acceptedTerms}
          onChange={(checked) => update('acceptedTerms', checked)}
          error={visibleError('acceptedTerms')}
        >
          Li e aceito os{' '}
          <Link to="/termos-e-privacidade" target="_blank">
            termos de uso e a política de privacidade
          </Link>
          .
        </Checkbox>
        <Button type="submit" size="lg" block loading={loading} loadingLabel="Criando sua conta…">
          Criar conta
        </Button>
      </form>
      <p className={styles.switch}>
        Já tem conta? <Link to="/entrar">Entrar</Link>
      </p>
    </AuthLayout>
  );
}
