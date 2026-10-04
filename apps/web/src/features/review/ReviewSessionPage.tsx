import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { useRef, useState } from 'react';
import { useParams } from 'react-router';
import type { ReviewResult } from '@english-ai/core';
import { Button } from '../../components/Button';
import { Card, ProgressRing } from '../../components/Display';
import { FocusBar } from '../../components/FocusBar';
import { LoadingState } from '../../components/States';
import { ActionError, QueryErrorState } from '../../app/QueryErrorState';
import { useApi, useSession, useUserKeys } from '../../app/session';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { relativeDay } from '../../utils/format';
import { ExerciseRunner, type ExerciseOutcome } from '../exercises/ExerciseRunner';
import styles from './ReviewSessionPage.module.css';

/** Sessão de revisão: atividades → correção → resultado e próxima data (UC08). */
export function ReviewSessionPage() {
  useDocumentTitle('Sessão de revisão');
  const { reviewId = '' } = useParams();
  const api = useApi();
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const startedAt = useRef(Date.now());
  const { refreshUserData } = useSession();
  const keys = useUserKeys();
  const session = useQuery({ queryKey: keys.reviewSession(reviewId), queryFn: () => api.startReview(reviewId), staleTime: Infinity, gcTime: 0 });

  const complete = useMutation({
    mutationFn: (outcomes: ExerciseOutcome[]) =>
      api.completeReview(reviewId, {
        correct: outcomes.filter((outcome) => outcome.correct).length,
        total: outcomes.length,
        timeSpentSeconds: Math.round((Date.now() - startedAt.current) / 1000),
      }),
    onSuccess: async (data) => {
      setResult(data);
      await refreshUserData();
    },
  });

  if (session.isPending) return <LoadingState label="Separando as atividades da revisão…" />;
  if (session.isError) {
    return (
      <>
        <FocusBar backTo="/revisao" backLabel="Voltar à revisão" />
        <h1 className="visually-hidden" data-page-title tabIndex={-1}>
          Sessão de revisão
        </h1>
        <QueryErrorState error={session.error} onRetry={() => void session.refetch()} back={{ to: '/revisao', label: 'Voltar à revisão' }} />
      </>
    );
  }
  const { review, exercises } = session.data;

  return (
    <div className={styles.page}>
      <FocusBar
        backTo="/revisao"
        backLabel="Sair da revisão"
        title={`Revisão · ${review.title}`}
        progress={result ? 1 : index / exercises.length}
        progressLabel="Progresso da revisão"
      />
      {!result ? (
        <div className={styles.content}>
          <p className={styles.reason}>
            <strong>Por que revisar:</strong> {review.reasonText}
          </p>
          <h1 className="visually-hidden" data-page-title tabIndex={-1}>
            Revisão: {review.title}
          </h1>
          <ExerciseRunner
            exercises={exercises}
            onAnswer={(exercise, answer) => api.answerReview(reviewId, exercise.id, answer)}
            onFinish={(outcomes) => complete.mutate(outcomes)}
            onIndexChange={setIndex}
            finishLabel="Ver resultado"
          />
          {complete.isPending && <LoadingState label="Atualizando seu progresso…" />}
          {complete.isError && <ActionError error={complete.error} />}
        </div>
      ) : (
        <div className={`${styles.content} reveal`}>
          <div className={styles.resultHead}>
            <ProgressRing value={result.total ? result.correct / result.total : 0} size={96} label={`${result.correct} de ${result.total} corretas`}>
              {result.correct}/{result.total}
            </ProgressRing>
            <div>
              <span className="caption">Revisão concluída</span>
              <h1 data-page-title tabIndex={-1}>
                {result.score}% de acertos
              </h1>
            </div>
          </div>
          <Card>
            <p>{result.message}</p>
            {result.nextReviewAt && (
              <p className={styles.next}>
                <CalendarClock aria-hidden="true" /> Próxima revisão deste conteúdo: {relativeDay(result.nextReviewAt)}.
              </p>
            )}
          </Card>
          <div className={styles.actions}>
            <Button to="/revisao" size="lg" iconEnd={<ArrowRight aria-hidden="true" />}>
              Voltar à revisão
            </Button>
            <Button to="/progresso" variant="secondary" size="lg">
              Ver progresso
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
