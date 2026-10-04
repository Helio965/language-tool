import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, History, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { ASSISTANT_PERSONA, CORRECTION_INTENSITY_INFO, type TopicView } from '@english-ai/core';
import { AssistantAvatar } from '../../components/Brand';
import { Chip } from '../../components/Controls';
import { ModeBadge, PageHeader, SectionTitle } from '../../components/Display';
import { EmptyState, InlineAlert, Skeleton } from '../../components/States';
import { ActionError, QueryErrorState } from '../../app/QueryErrorState';
import { useAccount, useApi, useUserKeys } from '../../app/session';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { relativeDay } from '../../utils/format';
import { TopicIcon } from './topicIcons';
import styles from './ConversationHubPage.module.css';

/** Modo Conversação — escolha de assunto e histórico (UC09). */
export function ConversationHubPage() {
  useDocumentTitle('Conversar');
  const api = useApi();
  const account = useAccount();
  const navigate = useNavigate();
  const keys = useUserKeys();
  const topics = useQuery({ queryKey: keys.topics, queryFn: () => api.listTopics() });
  const history = useQuery({ queryKey: keys.conversations, queryFn: () => api.listConversations() });
  const start = useMutation({
    mutationFn: (topicId: string) => api.startConversation(topicId),
    onSuccess: (conversation) => navigate(`/conversar/${conversation.id}`),
  });
  const prefs = account.preferences;

  return (
    <div className="reveal" data-mode="talk">
      <PageHeader
        eyebrow={<ModeBadge mode="talk" />}
        title="Converse em inglês, sem medo de errar"
        subtitle={`${ASSISTANT_PERSONA.name} conversa com naturalidade e corrige com calma — só quando ajuda o seu aprendizado.`}
      />

      <div className={styles.settingsRow}>
        <Link to="/preferencias" className={styles.setting}>
          <SlidersHorizontal aria-hidden="true" />
          Correções: <strong>{CORRECTION_INTENSITY_INFO[prefs.correctionIntensity].label}</strong>
        </Link>
        <Link to="/preferencias" className={styles.setting}>
          <ShieldCheck aria-hidden="true" />
          Histórico: <strong>{prefs.saveConversationHistory ? 'salvo' : 'não salvo'}</strong>
        </Link>
      </div>

      {start.isError && <ActionError error={start.error} />}

      <section aria-labelledby="topics-title" className={styles.section}>
        <SectionTitle id="topics-title">Sobre o que vamos conversar?</SectionTitle>
        {topics.isPending && <Skeleton lines={3} height={110} />}
        {topics.isError && <QueryErrorState error={topics.error} onRetry={() => void topics.refetch()} />}
        {topics.data && (
          <ul className={styles.topics}>
            {topics.data.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                loading={start.isPending && start.variables === topic.id}
                disabled={start.isPending}
                onStart={() => start.mutate(topic.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="history-title" className={styles.section}>
        <SectionTitle id="history-title">
          <History aria-hidden="true" className={styles.titleIcon} /> Conversas recentes
        </SectionTitle>
        {!prefs.saveConversationHistory && (
          <InlineAlert tone="info">O histórico está desativado: o conteúdo das conversas é apagado ao encerrar.</InlineAlert>
        )}
        {history.isPending && <Skeleton lines={2} height={64} />}
        {history.isError && <QueryErrorState error={history.error} onRetry={() => void history.refetch()} />}
        {history.data && history.data.length === 0 && (
          <EmptyState title="Nenhuma conversa ainda" description="Suas conversas salvas aparecerão aqui para você revisar quando quiser." />
        )}
        {history.data && history.data.length > 0 && (
          <ul className={styles.history}>
            {history.data.map((item) => (
              <li key={item.id}>
                <Link to={`/conversar/${item.id}`} className={styles.historyItem}>
                  <AssistantAvatar size={34} />
                  <span className={styles.historyText}>
                    <strong>{item.title}</strong>
                    <span lang="en">{item.preview}</span>
                  </span>
                  <span className={styles.historyMeta}>
                    {relativeDay(item.updatedAt)}
                    {item.endedAt ? <Chip>Encerrada</Chip> : <Chip tone="talk">Em andamento</Chip>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TopicCard({ topic, onStart, loading, disabled }: { topic: TopicView; onStart: () => void; loading: boolean; disabled: boolean }) {
  return (
    <li>
      <button type="button" className={styles.topic} onClick={onStart} disabled={disabled} aria-busy={loading || undefined}>
        <span className={styles.topicIcon}>
          <TopicIcon name={topic.icon} />
        </span>
        <span className={styles.topicText}>
          <span className={styles.topicTitle}>
            {topic.title}
            {topic.recommended && <Chip tone="marker">Para você</Chip>}
          </span>
          <span className={styles.topicEn} lang="en">
            {topic.titleEn}
          </span>
          <span className={styles.topicDescription}>{topic.description}</span>
          {topic.aboveLevel && <span className={styles.topicNote}>Um pouco acima do seu nível — ótimo para se desafiar.</span>}
        </span>
        <span className={styles.topicGo} aria-hidden="true">
          {loading ? <span className={styles.spinner} /> : <ArrowRight />}
        </span>
        {loading && <span className="visually-hidden">Iniciando conversa…</span>}
      </button>
    </li>
  );
}
