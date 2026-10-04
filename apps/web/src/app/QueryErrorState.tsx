import { ArrowLeft, LogIn } from 'lucide-react';
import { Button } from '../components/Button';
import { ErrorState, InlineAlert, LoadingState } from '../components/States';
import { toApiError } from '../services';
import { useSession } from './session';

interface BackLink {
  to: string;
  label: string;
}

/** Erro de sessão: o SessionProvider já está tratando (revalida e leva ao login) — nada a repetir. */
export function isSessionError(error: unknown): boolean {
  return toApiError(error).code === 'UNAUTHENTICATED';
}

/**
 * Estado de erro ao carregar dados, com a ação que faz sentido para cada tipo de erro:
 * - rede / servidor / IA / limite de requisições → "Tentar de novo";
 * - sessão encerrada → nenhuma repetição: aviso neutro enquanto a sessão é revalidada, e "Entrar novamente";
 * - não encontrado / sem acesso / dados inválidos → voltar a um lugar conhecido.
 */
export function QueryErrorState({ error, onRetry, back }: { error: unknown; onRetry: () => void; back?: BackLink }) {
  const { endSession } = useSession();
  const apiError = toApiError(error);
  const backAction = (fallback: BackLink) => {
    const target = back ?? fallback;
    return (
      <Button to={target.to} variant="secondary" size="sm" icon={<ArrowLeft aria-hidden="true" />}>
        {target.label}
      </Button>
    );
  };

  switch (apiError.code) {
    case 'UNAUTHENTICATED':
      return (
        <div className="session-ending">
          <LoadingState label="Verificando sua sessão…" />
          <Button variant="ghost" size="sm" icon={<LogIn aria-hidden="true" />} onClick={() => endSession('expired')}>
            Entrar novamente
          </Button>
        </div>
      );
    case 'NOT_FOUND':
      return (
        <ErrorState
          title="Não encontramos este conteúdo"
          message="Ele pode ter sido removido ou o endereço está incorreto."
          actions={backAction({ to: '/inicio', label: 'Voltar ao início' })}
        />
      );
    case 'FORBIDDEN':
      return <ErrorState title="Acesso não permitido" message={apiError.message} actions={backAction({ to: '/inicio', label: 'Voltar ao início' })} />;
    case 'RATE_LIMITED':
      return <ErrorState title="Muitas tentativas em pouco tempo" message={apiError.message} onRetry={onRetry} />;
    case 'NETWORK':
    case 'INTERNAL':
    case 'AI_UNAVAILABLE':
      return <ErrorState message={apiError.message} onRetry={onRetry} actions={back ? backAction(back) : undefined} />;
    default:
      return <ErrorState message={apiError.message} actions={backAction({ to: '/inicio', label: 'Voltar ao início' })} />;
  }
}

/**
 * Erro de uma ação (enviar, salvar, concluir). Erros de sessão não aparecem aqui: o SessionProvider
 * mostra um único aviso no login, em vez de uma caixa vermelha em cada parte da tela.
 */
export function ActionError({ error, suffix }: { error: unknown; suffix?: string }) {
  if (!error || isSessionError(error)) return null;
  return (
    <InlineAlert>
      {toApiError(error).message}
      {suffix ? ` ${suffix}` : ''}
    </InlineAlert>
  );
}
