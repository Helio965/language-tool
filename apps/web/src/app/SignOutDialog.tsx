import { LogOut } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../components/Button';
import { Dialog } from '../components/Overlay';
import { ActionError } from './QueryErrorState';
import { useSession } from './session';

/**
 * Confirmação de "Sair" nas etapas obrigatórias do primeiro acesso (configuração inicial e nivelamento).
 * Nessas etapas não há outra tela para onde voltar: sair significa sair da conta; ao entrar de novo,
 * a pessoa retoma a etapa pendente. As guardas levam ao login quando a sessão termina.
 */
export function SignOutDialog({ open, onClose, description }: { open: boolean; onClose: () => void; description: string }) {
  const { logout } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await logout();
    } catch (err) {
      setError(err);
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    setError(null);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Sair da conta?"
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={busy}>
            Continuar aqui
          </Button>
          <Button onClick={() => void confirm()} loading={busy} loadingLabel="Saindo…" icon={<LogOut aria-hidden="true" />}>
            Sair da conta
          </Button>
        </>
      }
    >
      <p>{description}</p>
      <ActionError error={error} />
    </Dialog>
  );
}
