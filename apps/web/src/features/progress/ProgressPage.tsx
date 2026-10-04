import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookCheck, Clock, Flame, Info, Library, ListChecks, MessagesSquare, Target } from 'lucide-react';
import { Link } from 'react-router';
import type { ProgressOverview } from '@english-ai/core';
import { Button } from '../../components/Button';
import { Card, PageHeader, ProgressBar, SectionTitle, StatTile } from '../../components/Display';
import { EmptyState, Skeleton } from '../../components/States';
import { QueryErrorState } from '../../app/QueryErrorState';
import { useApi, useUserKeys } from '../../app/session';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { formatMinutes, relativeDay } from '../../utils/format';
import { cx } from '../../utils/cx';
import styles from './ProgressPage.module.css';

/** UC11 — Consultar progresso. Poucos indicadores, fáceis de entender (Análise de requisitos §17). */
export function ProgressPage() {
  useDocumentTitle('Progresso');
  const api = useApi();
  const keys = useUserKeys();
  const query = useQuery({ queryKey: keys.progress, queryFn: () => api.getProgress() });

  return (
    <div className="reveal">
      <PageHeader title="Seu progresso" subtitle="Acompanhe sua evolução de forma simples: o que você já fez e o que vale revisar." />
      {query.isPending && <Skeleton lines={4} height={80} />}
      {query.isError && <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />}
      {query.data && !query.data.hasActivity && (
        <EmptyState
          title="Nada por aqui ainda"
          description="Seu progresso aparecerá aqui assim que você começar sua primeira aula."
          action={
            <Button to="/aprender" variant="accent">
              Começar minha primeira aula
            </Button>
          }
        />
      )}
      {query.data && query.data.hasActivity && <Overview data={query.data} />}
    </div>
  );
}

function Overview({ data }: { data: ProgressOverview }) {
  const { totals, level } = data;
  const maxMinutes = Math.max(10, ...data.week.map((day) => day.minutes));

  return (
    <div className={styles.grid}>
      {level && (
        <Card tone="ink" className={styles.levelCard} aria-labelledby="level-title">
          <span className={styles.levelLabel}>Nível estimado</span>
          <h2 id="level-title" className={styles.levelName}>
            {level.label}
          </h2>
          <ProgressBar value={level.percent / 100} label={`Aulas concluídas do nível ${level.label}`} tone="success" />
          <p className={styles.levelText}>
            {level.completedInLevel} de {level.totalInLevel} aulas do nível {level.label} concluídas
            {level.nextLabel ? ` · próximo: ${level.nextLabel}` : ''}
          </p>
          <p className={styles.levelNote}>
            <Info aria-hidden="true" /> Estimativa pedagógica que evolui com seus estudos — não é certificação oficial.
          </p>
        </Card>
      )}

      <section className={styles.statsSection} aria-labelledby="summary-title">
        <SectionTitle id="summary-title">Resumo</SectionTitle>
        <div className={styles.stats}>
          <StatTile icon={<BookCheck />} label="Aulas concluídas" value={totals.lessonsCompleted} />
          <StatTile icon={<ListChecks />} label="Exercícios" value={totals.exercisesDone} />
          <StatTile icon={<Target />} label="Taxa de acertos" value={totals.accuracy === null ? '—' : `${totals.accuracy}%`} />
          <StatTile icon={<Library />} label="Palavras estudadas" value={totals.wordsStudied} hint={`${totals.wordsLearned} aprendidas`} />
          <StatTile icon={<Clock />} label="Tempo de estudo" value={formatMinutes(totals.studyMinutes)} hint={`${totals.studyDays} ${totals.studyDays === 1 ? 'dia' : 'dias'} de estudo`} />
          <StatTile icon={<Flame />} label="Sequência" value={`${totals.streakDays} ${totals.streakDays === 1 ? 'dia' : 'dias'}`} hint={`${totals.conversations} ${totals.conversations === 1 ? 'conversa' : 'conversas'}`} />
        </div>
      </section>

      <Card className={styles.week} aria-labelledby="week-title">
        <h2 id="week-title" className={styles.cardTitle}>
          Últimos 7 dias
        </h2>
        <ol className={styles.bars} aria-label="Minutos de estudo por dia">
          {data.week.map((day, index) => (
            <li key={day.date} className={cx(index === data.week.length - 1 && styles.today)}>
              <span className={styles.barValue}>{day.minutes ? `${day.minutes}` : ''}</span>
              <span className={styles.barTrack}>
                <span
                  className={cx(styles.bar, day.active && styles.barActive)}
                  style={{ height: `${Math.max(day.active ? 8 : 3, (day.minutes / maxMinutes) * 100)}%` }}
                />
              </span>
              <span className={styles.barDay}>{index === data.week.length - 1 ? 'Hoje' : day.weekday}</span>
              <span className="visually-hidden">
                {day.weekday}: {day.minutes} minutos{day.active && !day.minutes ? ', com atividade' : ''}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <section aria-labelledby="review-title" className={styles.reviewSection}>
        <SectionTitle
          id="review-title"
          action={
            data.needsReview.length > 0 && (
              <Button to="/revisao" variant="ghost" size="sm" iconEnd={<ArrowRight aria-hidden="true" />}>
                Revisar
              </Button>
            )
          }
        >
          Precisa revisar
        </SectionTitle>
        {data.needsReview.length === 0 ? (
          <p className="muted">Tudo em dia! Novas revisões aparecem conforme você estuda.</p>
        ) : (
          <ul className={styles.reviewList}>
            {data.needsReview.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <span>{item.reasonText}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.skills.length > 0 && (
        <Card className={styles.skills} aria-labelledby="skills-title">
          <h2 id="skills-title" className={styles.cardTitle}>
            Desempenho por tema
          </h2>
          <ul className={styles.skillList}>
            {data.skills.map((skill) => (
              <li key={skill.skillTag}>
                <span className={styles.skillHead}>
                  <span>{skill.label}</span>
                  <strong>{skill.accuracy}%</strong>
                </span>
                <ProgressBar
                  value={skill.accuracy / 100}
                  label={`${skill.label}: ${skill.accuracy}% de acertos em ${skill.attempts} exercícios`}
                  tone={skill.accuracy >= 70 ? 'success' : skill.accuracy >= 40 ? 'learn' : 'talk'}
                  size="sm"
                />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.recurringErrors.length > 0 && (
        <Card className={styles.errors} aria-labelledby="errors-title">
          <h2 id="errors-title" className={styles.cardTitle}>
            Erros recorrentes
          </h2>
          <p className={styles.cardHint}>Somando exercícios e correções das conversas.</p>
          <ul className={styles.errorList}>
            {data.recurringErrors.map((error) => (
              <li key={error.skillTag}>
                <span>
                  <strong>{error.label}</strong>
                  <span>
                    {error.count} {error.count === 1 ? 'ocorrência' : 'ocorrências'}
                  </span>
                </span>
                {error.lessonId && (
                  <Link to={`/aprender/aula/${error.lessonId}`} className={styles.errorLink}>
                    Rever aula <ArrowRight aria-hidden="true" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.recentLessons.length > 0 && (
        <Card className={styles.recent} aria-labelledby="recent-title">
          <h2 id="recent-title" className={styles.cardTitle}>
            Aulas recentes
          </h2>
          <ul className={styles.recentList}>
            {data.recentLessons.map((lesson) => (
              <li key={lesson.lessonId}>
                <Link to={`/aprender/aula/${lesson.lessonId}`}>{lesson.title}</Link>
                <span>
                  {lesson.score}% · {relativeDay(lesson.completedAt)}
                </span>
              </li>
            ))}
          </ul>
          <Button to="/conversar" variant="ghost" size="sm" icon={<MessagesSquare aria-hidden="true" />}>
            Praticar na conversa
          </Button>
        </Card>
      )}
    </div>
  );
}
