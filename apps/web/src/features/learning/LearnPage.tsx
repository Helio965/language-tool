import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, Library, RefreshCcw } from 'lucide-react';
import { Link } from 'react-router';
import { LEVEL_LABELS, LEVELS, type LessonSummary } from '@english-ai/core';
import { Chip } from '../../components/Controls';
import { Card, LevelBadge, ModeBadge, PageHeader, ProgressBar } from '../../components/Display';
import { ErrorState, Skeleton } from '../../components/States';
import { useAccount, useApi } from '../../app/session';
import { errorMessage } from '../../services';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cx } from '../../utils/cx';
import styles from './LearnPage.module.css';

/** Modo Aprender — trilha de aulas com progressão de dificuldade (RN02) adequada ao nível (RN03). */
export function LearnPage() {
  useDocumentTitle('Aprender');
  const api = useApi();
  const account = useAccount();
  const lessons = useQuery({ queryKey: ['lessons'], queryFn: () => api.listLessons() });
  const reviews = useQuery({ queryKey: ['reviews'], queryFn: () => api.getReviews() });
  const level = account.profile.estimatedLevel;

  return (
    <div className="reveal">
      <PageHeader
        eyebrow={<ModeBadge mode="learn" />}
        title="Sua trilha de aprendizado"
        subtitle="Aulas curtas com explicação, exemplos e exercícios. Comece pela recomendada — ou explore no seu ritmo."
      />
      <div className={styles.layout}>
        <div className={styles.trail}>
          {lessons.isPending && <Skeleton lines={5} height={84} />}
          {lessons.isError && <ErrorState message={errorMessage(lessons.error)} onRetry={() => lessons.refetch()} />}
          {lessons.data &&
            LEVELS.map((lvl) => {
              const group = lessons.data.filter((lesson) => lesson.level === lvl);
              if (!group.length) return null;
              const done = group.filter((lesson) => lesson.status === 'completed').length;
              return (
                <section key={lvl} className={styles.group} aria-labelledby={`level-${lvl}`}>
                  <header className={styles.groupHead}>
                    <h2 id={`level-${lvl}`}>{LEVEL_LABELS[lvl]}</h2>
                    <span className={styles.groupCount}>
                      {done} de {group.length} concluídas
                    </span>
                  </header>
                  {group[0]?.aboveLevel && (
                    <p className={styles.groupNote}>Recomendado depois de avançar no seu nível atual — mas fique à vontade para explorar.</p>
                  )}
                  <ol className={styles.path}>
                    {group.map((lesson) => (
                      <LessonItem key={lesson.id} lesson={lesson} />
                    ))}
                  </ol>
                </section>
              );
            })}
        </div>

        <aside className={styles.side} aria-label="Atalhos do Modo Aprender">
          {lessons.data && level && (
            <Card>
              <span className="caption">Seu nível</span>
              <div className={styles.levelRow}>
                <LevelBadge level={level} />
              </div>
              {(() => {
                const inLevel = lessons.data.filter((lesson) => lesson.level === level);
                const done = inLevel.filter((lesson) => lesson.status === 'completed').length;
                return (
                  <>
                    <ProgressBar value={inLevel.length ? done / inLevel.length : 0} label={`Aulas do nível ${LEVEL_LABELS[level]}`} tone="learn" />
                    <p className={styles.sideText}>
                      {done} de {inLevel.length} aulas do nível {LEVEL_LABELS[level]}. Conclua todas com bom desempenho para avançar.
                    </p>
                  </>
                );
              })()}
            </Card>
          )}
          <Link to="/revisao" className={styles.shortcut}>
            <RefreshCcw aria-hidden="true" />
            <span>
              <strong>Revisão</strong>
              <span>
                {reviews.data
                  ? reviews.data.due.length
                    ? `${reviews.data.due.length} ${reviews.data.due.length === 1 ? 'conteúdo pendente' : 'conteúdos pendentes'}`
                    : 'Tudo em dia'
                  : 'Reforce o que estudou'}
              </span>
            </span>
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link to="/vocabulario" className={styles.shortcut}>
            <Library aria-hidden="true" />
            <span>
              <strong>Vocabulário</strong>
              <span>Palavras das suas aulas</span>
            </span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </div>
  );
}

function LessonItem({ lesson }: { lesson: LessonSummary }) {
  const status =
    lesson.status === 'completed' ? (
      <Chip tone="success" icon={<Check aria-hidden="true" />}>
        Concluída · {lesson.score}%
      </Chip>
    ) : lesson.status === 'in_progress' ? (
      <Chip tone="learn">Em andamento</Chip>
    ) : lesson.recommended ? (
      <Chip tone="marker">Recomendada</Chip>
    ) : null;

  return (
    <li className={cx(styles.item, lesson.recommended && styles.recommended, lesson.status === 'completed' && styles.completed)}>
      <span className={styles.dot} aria-hidden="true">
        {lesson.status === 'completed' ? <Check /> : lesson.order}
      </span>
      <Link to={`/aprender/aula/${lesson.id}`} className={styles.lessonCard}>
        <span className={styles.lessonText}>
          <strong>{lesson.title}</strong>
          <span className={styles.lessonMeta}>
            <span lang="en">{lesson.topic}</span> · {lesson.estimatedMinutes} min
          </span>
          {lesson.recommended && <span className={styles.lessonSummary}>{lesson.summary}</span>}
        </span>
        <span className={styles.lessonStatus}>{status}</span>
        {lesson.recommended && (
          <span className={styles.cta} aria-hidden="true">
            {lesson.status === 'in_progress' ? 'Continuar' : 'Começar'} <ArrowRight />
          </span>
        )}
      </Link>
    </li>
  );
}
