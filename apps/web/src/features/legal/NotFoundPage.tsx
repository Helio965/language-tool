import { Button } from '../../components/Button';
import { EmptyState } from '../../components/States';
import { useSession } from '../../app/session';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function NotFoundPage() {
  useDocumentTitle('Página não encontrada');
  const { account } = useSession();
  return (
    <main id="conteudo" style={{ maxWidth: 560, margin: '0 auto', padding: 'var(--space-12) var(--gutter)' }}>
      <EmptyState
        title="Página não encontrada"
        description="O endereço pode ter mudado ou não existe. Vamos voltar para um lugar conhecido?"
        action={<Button to={account ? '/inicio' : '/'}>{account ? 'Ir para o início' : 'Ir para a página inicial'}</Button>}
      />
    </main>
  );
}
