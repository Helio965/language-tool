import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { LoadingState } from '../components/States';
import { pathForStep, useSession } from './session';

/** Exige sessão. Sem sessão → login (guardando a rota de origem). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { account, loading } = useSession();
  const location = useLocation();
  if (loading) return <LoadingState fullscreen label="Carregando sua conta…" />;
  if (!account) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return children;
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

/** Telas públicas (boas-vindas, login, cadastro): quem já entrou segue para a etapa pendente. */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { account, loading } = useSession();
  if (loading) return <LoadingState fullscreen label="Carregando…" />;
  if (account) return <Navigate to={pathForStep(account.nextStep)} replace />;
  return children;
}
