import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUp, Flag, Info, Languages, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useParams } from 'react-router';
import {
  ASSISTANT_PERSONA,
  CORRECTION_INTENSITY_INFO,
  MESSAGE_MAX,
  type ConversationFeedbackView,
  type ConversationView,
  type Message,
} from '@english-ai/core';
import { AssistantAvatar } from '../../components/Brand';
import { Button } from '../../components/Button';
import { CorrectionCard } from '../../components/CorrectionCard';
import { Card, ModeBadge } from '../../components/Display';
import { FocusBar } from '../../components/FocusBar';
import { Dialog } from '../../components/Overlay';
import { ErrorState, InlineAlert, LoadingState } from '../../components/States';
import { useAccount, useApi } from '../../app/session';
import { errorMessage } from '../../services';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cx } from '../../utils/cx';
import { ConversationSummary } from './ConversationSummary';
import styles from './ChatPage.module.css';

/** UC09 — Conversar com IA, com correção contextual (RN04) e feedback ao final. */
export function ChatPage() {
  const { conversationId = '' } = useParams();
  const api = useApi();
  const query = useQuery({ queryKey: ['conversation', conversationId], queryFn: () => api.getConversation(conversationId) });
  useDocumentTitle(query.data ? `Conversa: ${query.data.title}` : 'Conversa');

  if (query.isPending) return <LoadingState label="Abrindo a conversa…" />;
  if (query.isError) {
    return (
      <>
        <FocusBar backTo="/conversar" backLabel="Voltar" icon="back" />
        <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      </>
    );
  }
  return <Chat key={query.data.id} conversation={query.data} />;
}

function Chat({ conversation }: { conversation: ConversationView }) {
  const api = useApi();
  const account = useAccount();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<Message[]>(conversation.messages);
  const [draft, setDraft] = useState('');
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [summary, setSummary] = useState<ConversationFeedbackView | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ended = Boolean(conversation.endedAt) || Boolean(summary);
  const prefs = account.preferences;
  const userCount = messages.filter((message) => message.role === 'user').length;
  const inlineCount = messages.reduce((sum, message) => sum + message.corrections.length, 0);
  const deferredCount = messages.reduce((sum, message) => sum + message.deferredCorrections.length, 0);

  const send = useMutation({
    mutationFn: (text: string) => api.sendMessage(conversation.id, text),
    onMutate: (text) => setPendingText(text),
    onSuccess: (result) => {
      setMessages((current) => [...current, result.userMessage, result.assistantMessage]);
      setPendingText(null);
      void queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (_error, text) => {
      setPendingText(null);
      setDraft(text);
    },
  });

  const end = useMutation({
    mutationFn: () => api.endConversation(conversation.id),
    onSuccess: async (data) => {
      setSummary(data);
      setConfirmEnd(false);
      await queryClient.invalidateQueries();
    },
  });

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }, [messages.length, pendingText]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || send.isPending || ended) return;
    setDraft('');
    send.mutate(text);
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  if (summary) {
    return (
      <div data-mode="talk">
        <FocusBar backTo="/conversar" backLabel="Voltar ao Modo Conversação" icon="back" title={conversation.title} />
        <ConversationSummary summary={summary} />
      </div>
    );
  }

  return (
    <div className={styles.page} data-mode="talk">
      <FocusBar
        backTo="/conversar"
        backLabel="Voltar ao Modo Conversação"
        icon="back"
        title={
          <span className={styles.barTitle}>
            <AssistantAvatar size={26} /> {ASSISTANT_PERSONA.name} · {conversation.title}
          </span>
        }
        action={
          !ended && userCount > 0 ? (
            <Button variant="secondary" size="sm" icon={<Flag aria-hidden="true" />} onClick={() => setConfirmEnd(true)}>
              Encerrar
            </Button>
          ) : ended ? (
            <Button variant="secondary" size="sm" onClick={() => end.mutate()} loading={end.isPending}>
              Ver feedback
            </Button>
          ) : undefined
        }
      />

      <div className={styles.layout}>
        <section className={styles.chat} aria-label="Conversa">
          <h1 className="visually-hidden" data-page-title tabIndex={-1}>
            Conversa sobre {conversation.title}
          </h1>
          <div className={styles.intro}>
            <ModeBadge mode="talk" />
            <span>Escreva em inglês. Errou? Tudo bem — é assim que se aprende.</span>
          </div>

          <div ref={listRef} className={styles.messages} role="log" aria-live="polite" aria-relevant="additions">
            {messages.map((message) => (
              <MessageItem key={message.id} message={message} />
            ))}
            {pendingText && (
              <>
                <div className={cx(styles.row, styles.userRow)}>
                  <div className={cx(styles.bubble, styles.userBubble, styles.sending)} lang="en">
                    {pendingText}
                  </div>
                </div>
                <div className={styles.row}>
                  <AssistantAvatar size={32} thinking />
                  <div className={cx(styles.bubble, styles.aiBubble, styles.typing)} role="status">
                    <span className={styles.dots} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>{ASSISTANT_PERSONA.name} está preparando uma resposta…</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {send.isError && <InlineAlert>{errorMessage(send.error)} Sua mensagem voltou para o campo de texto.</InlineAlert>}

          {ended ? (
            <Card tone="talk" className={styles.endedNote}>
              <Info aria-hidden="true" /> Esta conversa foi encerrada. Veja o feedback ou comece uma nova no Modo Conversação.
            </Card>
          ) : (
            <form className={styles.composer} onSubmit={submit}>
              <label htmlFor="chat-input" className="visually-hidden">
                Sua mensagem em inglês
              </label>
              <textarea
                id="chat-input"
                ref={inputRef}
                className={styles.input}
                value={draft}
                onChange={(e) => setDraft(e.target.value.slice(0, MESSAGE_MAX))}
                onKeyDown={onKeyDown}
                placeholder="Escreva em inglês…"
                rows={1}
                lang="en"
                maxLength={MESSAGE_MAX}
                disabled={send.isPending}
                autoFocus
              />
              {draft.length > MESSAGE_MAX - 100 && (
                <span className={styles.counter} aria-live="polite">
                  {MESSAGE_MAX - draft.length} caracteres restantes
                </span>
              )}
              <button type="submit" className={styles.send} disabled={!draft.trim() || send.isPending} aria-label="Enviar mensagem">
                <ArrowUp aria-hidden="true" />
              </button>
            </form>
          )}
          <p className={styles.privacy}>
            <ShieldCheck aria-hidden="true" /> Não compartilhe dados pessoais (documentos, telefone, senhas). Removemos os mais óbvios
            automaticamente.
          </p>
        </section>

        <aside className={styles.panel} aria-label="Feedback da conversa">
          <Card>
            <h2 className={styles.panelTitle}>Feedback da conversa</h2>
            <dl className={styles.panelStats}>
              <div>
                <dt>Suas mensagens</dt>
                <dd>{userCount}</dd>
              </div>
              <div>
                <dt>Correções mostradas</dt>
                <dd>{inlineCount}</dd>
              </div>
              <div>
                <dt>Guardadas para o final</dt>
                <dd>{deferredCount}</dd>
              </div>
            </dl>
            <p className={styles.panelText}>
              Modo de correção: <strong>{CORRECTION_INTENSITY_INFO[prefs.correctionIntensity].label}</strong>.{' '}
              {CORRECTION_INTENSITY_INFO[prefs.correctionIntensity].description}
            </p>
            <p className={styles.panelText}>
              Para não interromper o fluxo, alguns pontos ficam guardados e aparecem no resumo quando você encerra a conversa.
            </p>
            {!ended && userCount > 0 && (
              <Button variant="accent" block onClick={() => setConfirmEnd(true)}>
                Encerrar e ver feedback
              </Button>
            )}
          </Card>
        </aside>
      </div>

      <Dialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        title="Encerrar a conversa?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmEnd(false)}>
              Continuar conversando
            </Button>
            <Button variant="accent" onClick={() => end.mutate()} loading={end.isPending} loadingLabel="Preparando feedback…">
              Encerrar e ver feedback
            </Button>
          </>
        }
      >
        <p>Vamos reunir as correções e os pontos para praticar.</p>
        {!prefs.saveConversationHistory && (
          <p className={styles.dialogNote}>Como o histórico está desativado, o conteúdo desta conversa será apagado ao encerrar.</p>
        )}
        {end.isError && <InlineAlert>{errorMessage(end.error)}</InlineAlert>}
      </Dialog>
    </div>
  );
}

function MessageItem({ message }: { message: Message }) {
  const [showTranslation, setShowTranslation] = useState(false);
  if (message.role === 'assistant') {
    return (
      <div className={styles.row}>
        <AssistantAvatar size={32} />
        <div className={styles.aiColumn}>
          <div className={cx(styles.bubble, styles.aiBubble)}>
            <span className="visually-hidden">{ASSISTANT_PERSONA.name} disse: </span>
            <span lang="en">{message.content}</span>
          </div>
          {message.translation && (
            <>
              <button type="button" className={styles.translate} onClick={() => setShowTranslation((value) => !value)} aria-expanded={showTranslation}>
                <Languages aria-hidden="true" /> {showTranslation ? 'Ocultar tradução' : 'Ver tradução'}
              </button>
              {showTranslation && <p className={styles.translation}>{message.translation}</p>}
            </>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className={cx(styles.row, styles.userRow)}>
      <div className={styles.userColumn}>
        <div className={cx(styles.bubble, styles.userBubble)} lang="en">
          <span className="visually-hidden">Você disse: </span>
          {message.content}
        </div>
        {message.notices.map((notice) => (
          <p key={notice} className={styles.notice}>
            <ShieldCheck aria-hidden="true" /> {notice}
          </p>
        ))}
        {message.corrections.map((correction) => (
          <CorrectionCard key={correction.ruleId} correction={correction} variant="chat" />
        ))}
      </div>
    </div>
  );
}
