import { MailCheck, MonitorSmartphone } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { validateEmail } from '@english-ai/core';
import { Button } from '../../components/Button';
import { InlineAlert } from '../../components/States';
import { TextField } from '../../components/TextField';
import { AuthLayout } from '../../layouts/AuthLayout';
import { useSession } from '../../app/session';
import { errorMessage } from '../../services';
import type { PasswordResetRequestResult } from '../../services/apiClient';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import styles from './Auth.module.css';

/**
 * Recuperação de senha: a resposta é sempre a mesma, para não revelar quais e-mails têm conta.
 * No modo http, o link chega por e-mail. Na demonstração (sem servidor de e-mail), a tela mostra
 * — identificado como simulação — o e-mail que seria enviado.
 */
export function ForgotPasswordPage() {
  useDocumentTitle('Recuperar senha');
  const { api } = useSession();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<PasswordResetRequestResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fieldError = submitted ? (validateEmail(email) ?? undefined) : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setSubmitted(true);
    if (validateEmail(email)) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await api.requestPasswordReset(email));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function restart() {
    setResult(null);
    setSubmitted(false);
  }

  return (
    <AuthLayout>
      <div className={styles.head}>
        <h1>Recuperar senha</h1>
        <p className="muted">Informe o e-mail da sua conta e enviaremos um link para você criar uma senha nova.</p>
      </div>
      {result ? (
        <div className={styles.sent}>
          <div className={styles.success} role="status">
            <MailCheck aria-hidden="true" />
            <p>{result.message}</p>
            {api.mode === 'http' && (
              <p className={styles.note}>
                Confira a caixa de entrada e a pasta de spam. O link vale por {result.expiresInMinutes} minutos e só pode ser
                usado uma vez.
              </p>
            )}
          </div>
          {result.simulatedEmail !== undefined && <SimulatedEmail email={result.simulatedEmail} />}
          <div className={styles.sentActions}>
            <Button to="/entrar" variant="secondary" block>
              Voltar para o login
            </Button>
            <Button variant="ghost" block onClick={restart}>
              Usar outro e-mail
            </Button>
          </div>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submit} noValidate>
          {error && <InlineAlert>{error}</InlineAlert>}
          <TextField
            label="E-mail"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldError}
          />
          <Button type="submit" size="lg" block loading={loading} loadingLabel="Enviando…">
            Enviar link de redefinição
          </Button>
          <p className={styles.switch}>
            <Link to="/entrar">Voltar para o login</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}

/** Modo demonstração: nada sai do navegador, então a tela mostra o e-mail que seria enviado. */
function SimulatedEmail({ email }: { email: NonNullable<PasswordResetRequestResult['simulatedEmail']> | null }) {
  return (
    <section className={styles.simulated} aria-labelledby="simulated-title">
      <h2 id="simulated-title">
        <MonitorSmartphone aria-hidden="true" /> Simulação do modo demonstração
      </h2>
      <p>Nenhum e-mail real é enviado na demonstração.</p>
      {email ? (
        <div className={styles.simulatedMail}>
          <p>
            <span>Para:</span> {email.to}
          </p>
          <p>
            <span>Assunto:</span> {email.subject}
          </p>
          <Button to={email.resetPath} size="sm">
            Abrir o link de redefinição
          </Button>
        </div>
      ) : (
        <p>Não há conta com este e-mail neste navegador, então nenhum e-mail seria enviado.</p>
      )}
    </section>
  );
}
