import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, UserX } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../../components/Button';
import { Card, PageHeader } from '../../components/Display';
import { Dialog, useToast } from '../../components/Overlay';
import { InlineAlert } from '../../components/States';
import { PasswordField } from '../../components/TextField';
import { useSession } from '../../app/session';
import { errorMessage } from '../../services';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { DataPolicy } from '../legal/DataPolicy';
import styles from './Settings.module.css';

/** Privacidade e dados — RN07 (controle do histórico) e RF20 (exclusão de dados). */
export function PrivacyPage() {
  useDocumentTitle('Privacidade e dados');
  const { api, setAccount } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmHistory, setConfirmHistory] = useState(false);
  const [confirmAccount, setConfirmAccount] = useState(false);
  const [password, setPassword] = useState('');

  const clearHistory = useMutation({
    mutationFn: () => api.deleteAllConversations(),
    onSuccess: async (count) => {
      setConfirmHistory(false);
      toast(count ? `${count} ${count === 1 ? 'conversa apagada' : 'conversas apagadas'}.` : 'Não havia conversas para apagar.');
      await queryClient.invalidateQueries();
    },
  });

  const deleteAccount = useMutation({
    mutationFn: () => api.deleteAccount(password),
    onSuccess: () => {
      queryClient.clear();
      setAccount(null);
      navigate('/', { replace: true });
    },
  });

  function submitDelete(event: FormEvent) {
    event.preventDefault();
    if (password) deleteAccount.mutate();
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
          <Button variant="secondary" icon={<Trash2 aria-hidden="true" />} onClick={() => setConfirmHistory(true)}>
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
        onClose={() => setConfirmHistory(false)}
        title="Apagar o histórico de conversas?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmHistory(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => clearHistory.mutate()} loading={clearHistory.isPending} loadingLabel="Apagando…">
              Apagar histórico
            </Button>
          </>
        }
      >
        <p>O conteúdo de todas as conversas será apagado. Essa ação não pode ser desfeita.</p>
        {clearHistory.isError && <InlineAlert>{errorMessage(clearHistory.error)}</InlineAlert>}
      </Dialog>

      <Dialog open={confirmAccount} onClose={() => setConfirmAccount(false)} title="Excluir sua conta?">
        <form className={styles.stack} onSubmit={submitDelete}>
          <p>Para confirmar, digite sua senha. Todos os seus dados serão removidos permanentemente.</p>
          <PasswordField label="Senha" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {deleteAccount.isError && <InlineAlert>{errorMessage(deleteAccount.error)}</InlineAlert>}
          <div className={styles.dangerActions}>
            <Button variant="secondary" onClick={() => setConfirmAccount(false)}>
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
