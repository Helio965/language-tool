import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, UserX } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import { Card, PageHeader } from '../../components/Display';
import { Dialog, useToast } from '../../components/Overlay';
import { ActionError } from '../../app/QueryErrorState';
import { PasswordField } from '../../components/TextField';
import { useSession, useUserKeys } from '../../app/session';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { DataPolicy } from '../legal/DataPolicy';
import styles from './Settings.module.css';

/** Privacidade e dados — RN07 (controle do histórico) e RF20 (exclusão de dados). */
export function PrivacyPage() {
  useDocumentTitle('Privacidade e dados');
  const { api, endSession } = useSession();
  const keys = useUserKeys();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmHistory, setConfirmHistory] = useState(false);
  const [confirmAccount, setConfirmAccount] = useState(false);
  const [password, setPassword] = useState('');

  const clearHistory = useMutation({
    mutationFn: () => api.deleteAllConversations(),
    onSuccess: async (count) => {
      setConfirmHistory(false);
      toast(count ? `${count} ${count === 1 ? 'conversa apagada' : 'conversas apagadas'}.` : 'Não havia conversas para apagar.');
      await queryClient.invalidateQueries({ queryKey: keys.all });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: () => api.deleteAccount(password),
    // A sessão termina como "excluída": as guardas levam à página inicial e os dados privados saem do cache.
    onSuccess: () => endSession('deleted'),
    onError: () => setPassword(''),
  });

  function submitDelete(event: FormEvent) {
    event.preventDefault();
    if (password && !deleteAccount.isPending) deleteAccount.mutate();
  }

  function openHistoryDialog() {
    clearHistory.reset();
    setConfirmHistory(true);
  }

  function closeAccountDialog() {
    if (deleteAccount.isPending) return;
    setConfirmAccount(false);
    setPassword('');
    deleteAccount.reset();
  }

  return (
    <div className="reveal">
      <PageHeader title="Privacidade e dados" subtitle="Transparência sobre o que coletamos, por quê, e controle total sobre seus dados." />
      <div className={styles.stack}>
        <Card aria-labelledby="data-title">
          <h2 id="data-title" className={styles.title}>
            O que coletamos
          </h2>
          <DataPolicy />
        </Card>

        <Card aria-labelledby="history-title">
          <h2 id="history-title" className={styles.title}>
            Histórico de conversas
          </h2>
          <p className={styles.description}>
            Apaga o conteúdo de todas as conversas. Seus números de progresso (quantidade de conversas e tempo) continuam.
          </p>
          <Button variant="secondary" icon={<Trash2 aria-hidden="true" />} onClick={openHistoryDialog}>
            Apagar histórico de conversas
          </Button>
        </Card>

        <Card aria-labelledby="delete-title" className={styles.danger}>
          <h2 id="delete-title" className={styles.title}>
            Excluir conta
          </h2>
          <p className={styles.description}>
            Remove permanentemente sua conta, perfil, progresso, vocabulário, revisões e conversas. Não é possível desfazer.
          </p>
          <Button variant="danger" icon={<UserX aria-hidden="true" />} onClick={() => setConfirmAccount(true)}>
            Excluir minha conta e meus dados
          </Button>
        </Card>
      </div>

      <Dialog
        open={confirmHistory}
        onClose={() => !clearHistory.isPending && setConfirmHistory(false)}
        title="Apagar o histórico de conversas?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmHistory(false)} disabled={clearHistory.isPending}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => clearHistory.mutate()} loading={clearHistory.isPending} loadingLabel="Apagando…">
              Apagar histórico
            </Button>
          </>
        }
      >
        <p>O conteúdo de todas as conversas será apagado. Essa ação não pode ser desfeita.</p>
        {clearHistory.isError && <ActionError error={clearHistory.error} />}
      </Dialog>

      <Dialog open={confirmAccount} onClose={closeAccountDialog} title="Excluir sua conta?">
        <form className={styles.stack} onSubmit={submitDelete}>
          <p>Para confirmar, digite sua senha. Todos os seus dados serão removidos permanentemente.</p>
          <PasswordField label="Senha" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {deleteAccount.isError && <ActionError error={deleteAccount.error} />}
          <div className={styles.dangerActions}>
            <Button variant="secondary" onClick={closeAccountDialog} disabled={deleteAccount.isPending}>
              Cancelar
            </Button>
            <Button type="submit" variant="danger" disabled={!password} loading={deleteAccount.isPending} loadingLabel="Excluindo…">
              Excluir definitivamente
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
