import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BookOpen, Flame, History, MessagesSquare, RefreshCcw, Target } from 'lucide-react';
import { Link } from 'react-router';
import type { HomeDashboard } from '@english-ai/core';
import { ASSISTANT_PERSONA } from '@english-ai/core';
import { AssistantAvatar } from '../../components/Brand';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Controls';
import { Card, LevelBadge, PageHeader, ProgressBar, ProgressRing, SectionTitle } from '../../components/Display';
import { Skeleton } from '../../components/States';
import { QueryErrorState } from '../../app/QueryErrorState';
import { useApi, useUserKeys } from '../../app/session';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { greeting, plural, relativeDay } from '../../utils/format';
import styles from './HomePage.module.css';

export function HomePage() {
  useDocumentTitle('Início');
  const api = useApi();
  const keys = useUserKeys();
  const query = useQuery({ queryKey: keys.home, queryFn: () => api.getHome() });

  if (query.isPending) {
    return (
      <div className={styles.page}>
        <Skeleton lines={2} height={28} />
        <Skeleton lines={4} height={90} />
      </div>
    );
  }
  if (query.isError) {
    return (
      <>
        <h1 className="visually-hidden" data-page-title tabIndex={-1}>
          Início
        </h1>
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  }
  return <Dashboard data={query.data} />;
}

function Dashboard({ data }: { data: HomeDashboard }) {
  const lesson = data.continueLesson;
  const goalProgress = data.dailyGoalMinutes ? data.todayMinutes / data.dailyGoalMinutes : 0;
  const firstReview = data.reviewDue[0];

  return (
    <div className={`${styles.page} reveal`}>
      <PageHeader
        title={`${greeting()}, ${data.firstName}!`}
        subtitle={data.hasActivity ? 'Que bom te ver de novo. Aqui está o seu próximo passo.' : 'Tudo pronto para a sua primeira aula.'}
        eyebrow={
          <>
            <LevelBadge level={data.level} />
            {data.goalLabel && <Chip icon={<Target aria-hidden="true" />}>Objetivo: {data.goalLabel}</Chip>}
          </>
        }
      />

      <div className={styles.grid}>
        <div className={styles.mainCol}>
          {lesson ? (
            <Card className={styles.next} aria-labelledby="next-title">
              <span className={styles.nextLabel}>
                {lesson.status === 'in_progress' ? 'Continuar de onde parei' : data.hasActivity ? 'Próxima aula recomendada' : 'Comece por aqui'}
              </span>
              <h2 id="next-title" className={styles.nextTitle}>
                {lesson.title}
              </h2>
              <p className={styles.nextMeta}>
                <span lang="en">{lesson.topic}</span> · {lesson.estimatedMinutes} min · {lesson.exerciseCount} exercícios
              </p>
              <p className="muted">{lesson.summary}</p>
              <Button to={`/aprender/aula/${lesson.id}`} variant="accent" size="lg" iconEnd={<ArrowRight aria-hidden="true" />}>
                {lesson.status === 'in_progress' ? 'Continuar aula' : 'Começar aula'}
              </Button>
            </Card>
          ) : (
            <Card className={styles.next}>
              <span className={styles.nextLabel}>Trilha concluída</span>
              <h2 className={styles.nextTitle}>Você concluiu todas as aulas disponíveis!</h2>
              <p className="muted">Continue praticando na conversa e revisando o que aprendeu.</p>
              <Button to="/conversar" variant="accent">
                Conversar agora
              </Button>
            </Card>
          )}

          {firstReview && (
            <Link to="/revisao" className={styles.review}>
              <span className={styles.reviewIcon}>
                <RefreshCcw aria-hidden="true" />
              </span>
              <span className={styles.reviewText}>
                <strong>Você tem {plural(data.reviewCount, 'conteúdo', 'conteúdos')} para revisar</strong>
                <span>{firstReview.reasonText}</span>
              </span>
              <ArrowRight aria-hidden="true" className={styles.reviewArrow} />
            </Link>
          )}

          <section aria-labelledby="modes-title">
            <SectionTitle id="modes-title">Escolha como estudar</SectionTitle>
            <div className={styles.modes}>
              <Link to="/aprender" className={`${styles.mode} ${styles.learn}`}>
                <BookOpen aria-hidden="true" />
                <strong>Aprender</strong>
                <span>Aulas, exercícios e explicações no seu nível.</span>
              </Link>
              <Link to="/conversar" className={`${styles.mode} ${styles.talk}`}>
                <MessagesSquare aria-hidden="true" />
                <strong>Conversar</strong>
                <span>Pratique com {ASSISTANT_PERSONA.name} sem medo de errar.</span>
              </Link>
            </div>
          </section>
        </div>

        <aside className={styles.sideCol} aria-label="Resumo do dia">
          <Card className={styles.today}>
            <ProgressRing value={goalProgress} size={84} label={`Meta de hoje: ${data.todayMinutes} de ${data.dailyGoalMinutes} minutos`}>
              {data.todayMinutes}
              <br />
              <small>min</small>
            </ProgressRing>
            <div>
              <h2 className={styles.sideTitle}>Meta de hoje</h2>
              <p className="muted">
                {data.todayMinutes >= data.dailyGoalMinutes
                  ? 'Meta cumprida! Cada minuto extra é bônus.'
                  : `${data.todayMinutes} de ${data.dailyGoalMinutes} minutos.`}
              </p>
              <p className={styles.streak}>
                <Flame aria-hidden="true" />
                {data.streakDays > 0 ? `${plural(data.streakDays, 'dia seguido', 'dias seguidos')} de estudo` : 'Estude hoje para começar uma sequência'}
              </p>
            </div>
          </Card>

          {data.hasActivity && (
            <Card>
              <h2 className={styles.sideTitle}>Seu progresso</h2>
              <div className={styles.miniStats}>
                <div>
                  <strong>{data.lessonsCompleted}</strong>
                  <span>{data.lessonsCompleted === 1 ? 'aula concluída' : 'aulas concluídas'}</span>
                </div>
                <div>
                  <strong>{data.accuracy ?? '—'}{data.accuracy !== null && '%'}</strong>
                  <span>de acertos</span>
                </div>
              </div>
              <ProgressBar value={(data.accuracy ?? 0) / 100} label="Taxa de acertos" tone="success" size="sm" />
              <Button to="/progresso" variant="ghost" size="sm" iconEnd={<ArrowRight aria-hidden="true" />}>
                Ver progresso completo
              </Button>
            </Card>
          )}

          {data.recentWords.length > 0 && (
            <Card>
              <h2 className={styles.sideTitle}>Palavras recentes</h2>
              <ul className={styles.words}>
                {data.recentWords.map((word) => (
                  <li key={word.id}>
                    <Link to={`/vocabulario?palavra=${word.id}`} lang="en">
                      <mark className="marker">{word.word}</mark>
                    </Link>
                    <span>{word.translation}</span>
                  </li>
                ))}
              </ul>
              <Button to="/vocabulario" variant="ghost" size="sm" iconEnd={<ArrowRight aria-hidden="true" />}>
                Abrir vocabulário
              </Button>
            </Card>
          )}

          {data.lastConversation && (
            <Link to={`/conversar/${data.lastConversation.id}`} className={styles.lastChat}>
              <AssistantAvatar size={32} />
              <span className={styles.lastChatText}>
                <strong>Última conversa: {data.lastConversation.title}</strong>
                <span className={styles.lastChatWhen}>
                  <History aria-hidden="true" /> {relativeDay(data.lastConversation.updatedAt)}
                </span>
              </span>
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
