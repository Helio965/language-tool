import { MailCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { validateEmail } from '@english-ai/core';
import { Button } from '../../components/Button';
import { InlineAlert } from '../../components/States';
import { TextField } from '../../components/TextField';
import { AuthLayout } from '../../layouts/AuthLayout';
import { useSession } from '../../app/session';
import { errorMessage } from '../../services';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import styles from './Auth.module.css';

/** Recuperação de senha: a resposta é sempre a mesma, para não revelar quais e-mails têm conta. */
export function ForgotPasswordPage() {
  useDocumentTitle('Recuperar senha');
  const { api } = useSession();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fieldError = submitted ? (validateEmail(email) ?? undefined) : undefined;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (validateEmail(email)) return;
    setLoading(true);
    setError(null);
    try {
      setMessage(await api.requestPasswordReset(email));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className={styles.head}>
        <h1>Recuperar senha</h1>
        <p className="muted">Informe o e-mail da sua conta e enviaremos as instruções.</p>
      </div>
      {message ? (
        <div className={styles.success} role="status">
          <MailCheck aria-hidden="true" />
          <p>{message}</p>
          <p className={styles.note}>No protótipo (MVP), nenhum e-mail é enviado de fato.</p>
          <Button to="/entrar" variant="secondary" block>
            Voltar para o login
          </Button>
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
            Enviar instruções
          </Button>
          <p className={styles.switch}>
            <Link to="/entrar">Voltar para o login</Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
