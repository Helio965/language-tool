import { useQuery } from '@tanstack/react-query';
import { BookOpen, CalendarClock, Library, RefreshCcw, Target } from 'lucide-react';
import type { ReviewItemView } from '@english-ai/core';
import { Button } from '../../components/Button';
import { PageHeader, SectionTitle } from '../../components/Display';
import { EmptyState, ErrorState, Skeleton } from '../../components/States';
import { useApi } from '../../app/session';
import { errorMessage } from '../../services';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { relativeDay } from '../../utils/format';
import styles from './ReviewPage.module.css';

const KIND_ICON = { lesson: BookOpen, skill: Target, vocabulary: Library } as const;

/** UC08 — Revisar conteúdo: cada item mostra o MOTIVO da revisão. */
export function ReviewPage() {
  useDocumentTitle('Revisão');
  const api = useApi();
  const query = useQuery({ queryKey: ['reviews'], queryFn: () => api.getReviews() });
  const due = query.data?.due ?? [];

  return (
    <div className="reveal">
      <PageHeader
        title="Revisão"
        subtitle={
          query.data
            ? due.length
              ? `Você tem ${due.length} ${due.length === 1 ? 'conteúdo' : 'conteúdos'} para revisar.`
              : 'Nada pendente agora.'
            : 'Reforce o que você estudou, no momento certo.'
        }
      />
      {query.isPending && <Skeleton lines={3} height={84} />}
      {query.isError && <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />}
      {query.data && due.length === 0 && (
        <EmptyState
          title="Tudo em dia!"
          description="Novas revisões aparecem conforme você estuda — por exemplo, quando um tema gera dúvidas ou alguns dias depois de uma aula."
          action={
            <Button to="/aprender" variant="accent">
              Continuar estudando
            </Button>
          }
        />
      )}
      {due.length > 0 && (
        <ul className={styles.list}>
          {due.map((item) => (
            <ReviewCard key={item.id} item={item} />
          ))}
        </ul>
      )}
      {query.data && query.data.upcoming.length > 0 && (
        <section aria-labelledby="upcoming-title" className={styles.upcoming}>
          <SectionTitle id="upcoming-title">Próximas revisões</SectionTitle>
          <ul className={styles.upcomingList}>
            {query.data.upcoming.map((item) => (
              <li key={item.id}>
                <CalendarClock aria-hidden="true" />
                <span>{item.title}</span>
                <span className={styles.when}>{relativeDay(item.dueAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {query.data && query.data.completedCount > 0 && (
        <p className={styles.completed}>
          <RefreshCcw aria-hidden="true" /> {query.data.completedCount} {query.data.completedCount === 1 ? 'revisão concluída' : 'revisões concluídas'} até agora.
        </p>
      )}
    </div>
  );
}

function ReviewCard({ item }: { item: ReviewItemView }) {
  const Icon = KIND_ICON[item.kind];
  return (
    <li className={styles.card}>
      <span className={styles.icon}>
        <Icon aria-hidden="true" />
      </span>
      <div className={styles.text}>
        <h2>{item.title}</h2>
        <p>{item.reasonText}</p>
        <span className={styles.meta}>~{item.estimatedMinutes} min</span>
      </div>
      <Button to={`/revisao/${item.id}`} variant="primary" className={styles.go}>
        Revisar
      </Button>
    </li>
  );
}
