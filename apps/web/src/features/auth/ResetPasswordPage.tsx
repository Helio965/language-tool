import { CheckCircle2, Clock, LinkIcon, ShieldAlert } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'react-router';
import { validateNewPassword, type FieldErrors, type ResetTokenStatus } from '@english-ai/core';
import { Button } from '../../components/Button';
import { InlineAlert, LoadingState } from '../../components/States';
import { PasswordField } from '../../components/TextField';
import { AuthLayout } from '../../layouts/AuthLayout';
import { useSession } from '../../app/session';
import { ApiError, errorMessage } from '../../services';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import styles from './Auth.module.css';
import { PasswordChecklist } from './PasswordChecklist';

type View =
  | { kind: 'checking' }
  | { kind: 'check-failed'; message: string }
  | { kind: 'form' }
  | { kind: 'unavailable'; status: Exclude<ResetTokenStatus, 'valid'> }
  | { kind: 'done' };

const UNAVAILABLE: Record<Exclude<ResetTokenStatus, 'valid'>, { icon: typeof Clock; title: string; message: string }> = {
  expired: {
    icon: Clock,
    title: 'Este link venceu',
    message: 'Por segurança, o link de redefinição vale por pouco tempo. Peça um novo e use-o logo em seguida.',
  },
  used: {
    icon: CheckCircle2,
    title: 'Este link já foi usado',
    message: 'Cada link redefine a senha uma única vez. Se a senha já foi trocada, é só entrar com ela. Se não, peça um novo link.',
  },
  invalid: {
    icon: LinkIcon,
    title: 'Link inválido',
    message: 'Este link não é válido ou foi substituído por um mais recente. Use o link do último e-mail recebido ou peça um novo.',
  },
};

/**
 * Redefinir a senha a partir do link do e-mail. Estados: verificando → formulário | link vencido,
 * usado ou inválido | falha ao verificar → concluído. Fica fora das guardas de rota: o link precisa
 * funcionar mesmo se este navegador estiver conectado (a sessão da mesma conta é encerrada ao final).
 */
export function ResetPasswordPage() {
  useDocumentTitle('Redefinir senha');
  const { token = '' } = useParams();
  const { api, account, endSession } = useSession();
  const [view, setView] = useState<View>({ kind: 'checking' });
  const [form, setForm] = useState({ password: '', passwordConfirmation: '' });
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // A verificação depende só do token: encerrar a sessão ao final não pode reabrir o estado do link.
  const apiRef = useRef(api);
  useEffect(() => {
    apiRef.current = api;
  }, [api]);

  const check = useCallback(async () => {
    setView({ kind: 'checking' });
    try {
      const status = await apiRef.current.checkPasswordResetToken(token);
      setView(status === 'valid' ? { kind: 'form' } : { kind: 'unavailable', status });
    } catch (err) {
      setView({ kind: 'check-failed', message: errorMessage(err) });
    }
  }, [token]);

  useEffect(() => {
    void check();
  }, [check]);

  // Leva o foco ao título quando o estado muda (leitores de tela anunciam o resultado).
  useEffect(() => {
    if (view.kind !== 'checking') headingRef.current?.focus();
  }, [view.kind]);

  const clientErrors = validateNewPassword(form);
  const fieldError = (field: 'password' | 'passwordConfirmation') => serverErrors[field] ?? (submitted ? clientErrors[field] : undefined);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSubmitted(true);
    setServerErrors({});
    setError(null);
    if (Object.keys(clientErrors).length > 0) return;
    setSaving(true);
    try {
      const { sessionEnded } = await api.resetPassword({ token, ...form });
      // A sessão deste navegador era da mesma conta: encerra também na interface (e nas outras abas).
      if (sessionEnded && account) endSession('signed_out');
      setForm({ password: '', passwordConfirmation: '' });
      setView({ kind: 'done' });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'RESET_TOKEN_INVALID') {
        await check();
      } else if (err instanceof ApiError && err.code === 'VALIDATION' && Object.keys(err.fields).length > 0) {
        setServerErrors(err.fields);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  if (view.kind === 'checking') {
    return (
      <AuthLayout>
        <LoadingState label="Verificando o link…" />
      </AuthLayout>
    );
  }

  if (view.kind === 'done') {
    return (
      <AuthLayout>
        <div className={styles.success} role="status">
          <CheckCircle2 aria-hidden="true" />
          <h1 ref={headingRef} tabIndex={-1}>
            Senha redefinida com sucesso.
          </h1>
          <p>Agora é só entrar com a senha nova. Por segurança, as sessões abertas com a senha antiga foram encerradas.</p>
          <Button to="/entrar" size="lg" block>
            Entrar
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (view.kind === 'unavailable' || view.kind === 'check-failed') {
    const info =
      view.kind === 'unavailable'
        ? UNAVAILABLE[view.status]
        : { icon: ShieldAlert, title: 'Não foi possível verificar o link', message: view.message };
    const Icon = info.icon;
    return (
      <AuthLayout>
        <div className={styles.resetState}>
          <Icon aria-hidden="true" />
          <h1 ref={headingRef} tabIndex={-1}>
            {info.title}
          </h1>
          <p>{info.message}</p>
          <div className={styles.resetActions}>
            {view.kind === 'check-failed' ? (
              <Button onClick={() => void check()} block>
                Tentar de novo
              </Button>
            ) : (
              <Button to="/recuperar-senha" block>
                Pedir um novo link
              </Button>
            )}
            <Button to="/entrar" variant="secondary" block>
              Voltar para o login
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className={styles.head}>
        <h1 ref={headingRef} tabIndex={-1}>
          Criar uma senha nova
        </h1>
        <p className="muted">Escolha uma senha que você não use em outros sites.</p>
      </div>
      <form className={styles.form} onSubmit={submit} noValidate>
        {error && <InlineAlert>{error}</InlineAlert>}
        <PasswordField
          id="reset-password"
          label="Nova senha"
          autoComplete="new-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={fieldError('password')}
          hint={<PasswordChecklist password={form.password} />}
        />
        <PasswordField
          id="reset-passwordConfirmation"
          label="Confirme a nova senha"
          autoComplete="new-password"
          value={form.passwordConfirmation}
          onChange={(e) => setForm({ ...form, passwordConfirmation: e.target.value })}
          error={fieldError('passwordConfirmation')}
        />
        <Button type="submit" size="lg" block loading={saving} loadingLabel="Salvando…">
          Redefinir senha
        </Button>
      </form>
    </AuthLayout>
  );
}
