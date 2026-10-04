import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { validateLogin } from '@english-ai/core';
import { Button } from '../../components/Button';
import { Card } from '../../components/Display';
import { InlineAlert } from '../../components/States';
import { PasswordField, TextField } from '../../components/TextField';
import { AuthLayout } from '../../layouts/AuthLayout';
import { pathForStep, useSession } from '../../app/session';
import { errorMessage } from '../../services';
import { DEMO_ACCOUNT } from '../../mocks/demoSeed';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import styles from './Auth.module.css';

/** UC02 — Fazer login. Após entrar, retoma a etapa pendente (sem repetir etapas). */
export function LoginPage() {
  useDocumentTitle('Entrar');
  const { api, setAccount } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state ?? {}) as { email?: string; from?: string };
  const [email, setEmail] = useState(state.email ?? '');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const errors = submitted ? validateLogin({ email, password }) : {};

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setError(null);
    if (Object.keys(validateLogin({ email, password })).length) return;
    setLoading(true);
    try {
      const account = await api.login({ email, password });
      setAccount(account);
      const destination = account.nextStep === 'ready' && state.from ? state.from : pathForStep(account.nextStep);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setPassword('');
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className={styles.head}>
        <h1>Que bom te ver de novo</h1>
        <p className="muted">Entre para continuar de onde parou.</p>
      </div>
      <form className={styles.form} onSubmit={submit} noValidate>
        {error && <InlineAlert>{error}</InlineAlert>}
        <TextField
          label="E-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <PasswordField
          label="Senha"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <Link to="/recuperar-senha" className={styles.forgot}>
          Esqueci minha senha
        </Link>
        <Button type="submit" size="lg" block loading={loading} loadingLabel="Entrando…">
          Entrar
        </Button>
      </form>
      <p className={styles.switch}>
        Novo por aqui? <Link to="/cadastro">Criar conta</Link>
      </p>
      {api.mode === 'demo' && (
        <Card tone="marker" className={styles.demoHint} as="aside" aria-label="Conta de demonstração">
          <strong>Modo demonstração</strong>
          <p>
            Conta de exemplo: <code>{DEMO_ACCOUNT.email}</code> · senha <code>{DEMO_ACCOUNT.password}</code> (disponível
            depois de clicar em “Explorar demonstração” na página inicial).
          </p>
        </Card>
      )}
    </AuthLayout>
  );
}
