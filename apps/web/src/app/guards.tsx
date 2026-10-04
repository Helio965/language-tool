import { Fragment, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { ErrorState, LoadingState } from '../components/States';
import { pathForStep, safeReturnPath, useSession } from './session';

/**
 * Exige sessão. Sem sessão, o destino depende de como ela terminou:
 * - visitante ou sessão expirada → /entrar, guardando a página para voltar depois do login;
 * - "Sair" intencional → /entrar, sem voltar à página anterior (e sem aviso de expiração);
 * - conta excluída → página inicial.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { account, loading, checkFailed, endReason, refresh } = useSession();
  const location = useLocation();
  if (loading) return <LoadingState fullscreen label="Carregando sua conta…" />;
  if (checkFailed) {
    return (
      <div className="session-check-failed">
        <ErrorState
          title="Não foi possível verificar sua conta"
          message="Sem conexão com o servidor. Verifique sua internet e tente de novo."
          onRetry={() => void refresh()}
        />
      </div>
    );
  }
  if (!account) {
    if (endReason === 'signed_out') return <Navigate to="/entrar" replace />;
    if (endReason === 'deleted') return <Navigate to="/" replace />;
    return <Navigate to="/entrar" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }
  // Se a conta mudar (ex.: login com outra conta em outra aba), as telas privadas remontam do zero.
  return <Fragment key={account.user.id}>{children}</Fragment>;
}

/**
 * Garante que o usuário está na etapa certa do fluxo e nunca repete etapas concluídas:
 * configuração inicial → nivelamento → app.
 */
export function RequireStep({ step, children }: { step: 'onboarding' | 'placement' | 'ready'; children: ReactNode }) {
  const { account } = useSession();
  if (!account) return null;
  const order = ['onboarding', 'placement', 'ready'] as const;
  const current = order.indexOf(account.nextStep);
  const required = order.indexOf(step);
  // Etapa ainda não liberada → vai para a pendente. Etapa de entrada já concluída → segue em frente.
  if (current < required || (step !== 'ready' && current > required)) return <Navigate to={pathForStep(account.nextStep)} replace />;
  return children;
}

/**
 * Telas públicas (boas-vindas, login, cadastro): quem já entrou segue para a etapa pendente
 * — ou, depois do login, para a página que tentava abrir.
 */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { account, loading } = useSession();
  const location = useLocation();
  if (loading) return <LoadingState fullscreen label="Carregando…" />;
  if (account) {
    const from = safeReturnPath((location.state as { from?: unknown } | null)?.from);
    return <Navigate to={account.nextStep === 'ready' && from ? from : pathForStep(account.nextStep)} replace />;
  }
  return children;
}
