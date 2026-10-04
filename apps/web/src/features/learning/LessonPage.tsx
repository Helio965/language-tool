import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BookMarked,
  Check,
  Languages,
  ListChecks,
  MessagesSquare,
  PartyPopper,
  RefreshCcw,
  Shuffle,
  Sparkles,
  Target,
} from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ASSISTANT_PERSONA, LEVEL_LABELS, type Example, type LessonResult, type LessonView } from '@english-ai/core';
import { AssistantAvatar } from '../../components/Brand';
import { Button } from '../../components/Button';
import { Card, Highlight, ModeBadge, ProgressRing } from '../../components/Display';
import { FocusBar } from '../../components/FocusBar';
import { InlineAlert, LoadingState } from '../../components/States';
import { ActionError, QueryErrorState } from '../../app/QueryErrorState';
import { useApi, useSession, useUserKeys } from '../../app/session';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cx } from '../../utils/cx';
import { ExerciseRunner, type ExerciseOutcome } from '../exercises/ExerciseRunner';
import styles from './LessonPage.module.css';

const STEPS = [
  { id: 'intro', label: 'Objetivos' },
  { id: 'explanation', label: 'Explicação' },
  { id: 'examples', label: 'Exemplos' },
  { id: 'vocabulary', label: 'Vocabulário' },
  { id: 'exercises', label: 'Exercícios' },
  { id: 'summary', label: 'Resumo' },
] as const;
type StepId = (typeof STEPS)[number]['id'];

/** UC05 (Iniciar aula), UC06 (Realizar exercício), UC07 (Consultar correção). */
export function LessonPage() {
  const { lessonId = '' } = useParams();
  const api = useApi();
  const keys = useUserKeys();
  const query = useQuery({ queryKey: keys.lesson(lessonId), queryFn: () => api.getLesson(lessonId) });
  useDocumentTitle(query.data?.title ?? 'Aula');

  if (query.isPending) return <LoadingState label="Preparando sua aula…" />;
  if (query.isError) {
    return (
      <div className={styles.page}>
        <FocusBar backTo="/aprender" backLabel="Voltar à trilha" />
        <h1 className="visually-hidden" data-page-title tabIndex={-1}>
          Aula
        </h1>
        <QueryErrorState error={query.error} onRetry={() => void query.refetch()} back={{ to: '/aprender', label: 'Voltar à trilha' }} />
      </div>
    );
  }
  return <Lesson lesson={query.data} />;
}

function Lesson({ lesson }: { lesson: LessonView }) {
  const api = useApi();
  const { refreshUserData } = useSession();
  const navigate = useNavigate();
  const [step, setStep] = useState<StepId>('intro');
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [result, setResult] = useState<LessonResult | null>(null);
  const startedAt = useRef<number>(Date.now());
  const stepIndex = STEPS.findIndex((item) => item.id === step);

  const start = useMutation({
    mutationFn: () => api.startLesson(lesson.id),
    onSuccess: () => {
      startedAt.current = Date.now();
      setStep('explanation');
    },
  });

  const complete = useMutation({
    mutationFn: () => api.completeLesson(lesson.id, Math.round((Date.now() - startedAt.current) / 1000)),
    onSuccess: async (data) => {
      setResult(data);
      setStep('summary');
      await refreshUserData();
    },
  });

  const practice = useMutation({
    mutationFn: () => api.startConversation(lesson.practiceTopicId),
    onSuccess: (conversation) => navigate(`/conversar/${conversation.id}`),
  });

  const onFinishExercises = useCallback((_outcomes: ExerciseOutcome[]) => complete.mutate(), [complete]);
  const totalProgress =
    step === 'exercises' ? (stepIndex + exerciseIndex / Math.max(1, lesson.exercises.length)) / (STEPS.length - 1) : stepIndex / (STEPS.length - 1);

  const go = (id: StepId) => {
    setStep(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={styles.page} data-mode="learn">
      <FocusBar
        backTo="/aprender"
        backLabel="Sair da aula (seu andamento fica salvo)"
        title={lesson.title}
        progress={totalProgress}
        progressLabel="Progresso da aula"
      />
      <div className={styles.layout}>
        <nav className={styles.outline} aria-label="Etapas da aula">
          <ol>
            {STEPS.map((item, index) => (
              <li key={item.id} className={cx(index < stepIndex && styles.done, item.id === step && styles.current)} aria-current={item.id === step ? 'step' : undefined}>
                <span className={styles.outlineDot}>{index < stepIndex ? <Check aria-hidden="true" /> : index + 1}</span>
                {item.label}
              </li>
            ))}
          </ol>
        </nav>

        <div className={styles.stage} key={step}>
          {step === 'intro' && (
            <section className={`${styles.section} reveal`}>
              <div className={styles.eyebrow}>
                <ModeBadge mode="learn" />
                <span className="caption">
                  Aula {lesson.order} · {LEVEL_LABELS[lesson.level]}
                </span>
              </div>
              <h1 data-page-title tabIndex={-1} className={styles.title}>
                {lesson.title}
              </h1>
              <p className={styles.topic} lang="en">
                {lesson.topic}
              </p>
              <Card>
                <h2 className={styles.cardTitle}>
                  <Target aria-hidden="true" /> Nesta aula você vai
                </h2>
                <ul className={styles.objectives}>
                  {lesson.objectives.map((objective) => (
                    <li key={objective}>
                      <Check aria-hidden="true" /> {objective}
                    </li>
                  ))}
                </ul>
                <p className={styles.meta}>
                  {lesson.estimatedMinutes} minutos · {lesson.exercises.length} exercícios · {lesson.vocabulary.length} palavras novas
                </p>
              </Card>
              {lesson.aboveLevel && (
                <InlineAlert tone="info">Esta aula está acima do seu nível estimado. Tudo bem explorar — as explicações ajudam no caminho.</InlineAlert>
              )}
              {start.isError && <ActionError error={start.error} />}
              <Button size="lg" variant="accent" onClick={() => start.mutate()} loading={start.isPending} iconEnd={<ArrowRight aria-hidden="true" />}>
                {lesson.status === 'in_progress' ? 'Continuar aula' : lesson.status === 'completed' ? 'Refazer aula' : 'Começar aula'}
              </Button>
            </section>
          )}

          {step === 'explanation' && <ExplanationStep lesson={lesson} onNext={() => go('examples')} />}
          {step === 'examples' && <ExamplesStep lesson={lesson} onNext={() => go('vocabulary')} />}

          {step === 'vocabulary' && (
            <section className={`${styles.section} reveal`}>
              <h1 data-page-title tabIndex={-1} className={styles.stepTitle}>
                Vocabulário da aula
              </h1>
              <p className="muted">Estas palavras entram no seu vocabulário quando você concluir a aula.</p>
              <ul className={styles.words}>
                {lesson.vocabulary.map((word) => (
                  <li key={word.id} className={styles.word}>
                    <span className={styles.wordHead}>
                      <strong lang="en">
                        <mark className="marker">{word.word}</mark>
                      </strong>
                      <span>{word.translation}</span>
                    </span>
                    <span className={styles.wordExample} lang="en">
                      {word.examples[0]?.en}
                    </span>
                  </li>
                ))}
              </ul>
              <Button size="lg" onClick={() => go('exercises')} iconEnd={<ListChecks aria-hidden="true" />}>
                Ir para os exercícios
              </Button>
            </section>
          )}

          {step === 'exercises' && (
            <section className={styles.section}>
              <h1 className="visually-hidden" data-page-title tabIndex={-1}>
                Exercícios da aula
              </h1>
              <ExerciseRunner
                exercises={lesson.exercises}
                onAnswer={(exercise, answer) => api.answerExercise(lesson.id, exercise.id, answer)}
                onFinish={onFinishExercises}
                onIndexChange={setExerciseIndex}
                finishLabel="Ver resumo da aula"
              />
              {complete.isPending && <LoadingState label="Registrando seu progresso…" />}
              {complete.isError && <ActionError error={complete.error} />}
            </section>
          )}

          {step === 'summary' && result && (
            <section className={`${styles.section} reveal`}>
              <div className={styles.summaryHead}>
                <ProgressRing value={result.total ? result.correct / result.total : 1} size={96} label={`Você acertou ${result.correct} de ${result.total}`}>
                  {result.correct}/{result.total}
                </ProgressRing>
                <div>
                  <span className="caption">Aula concluída</span>
                  <h1 data-page-title tabIndex={-1} className={styles.stepTitle}>
                    {result.score >= 80 ? 'Mandou bem!' : result.score >= 50 ? 'Bom trabalho!' : 'Aula concluída — vamos reforçar?'}
                  </h1>
                  <p className="muted">
                    {result.score}% de acertos · {Math.max(1, Math.round(result.timeSpentSeconds / 60))} min de estudo
                  </p>
                </div>
              </div>

              {result.levelUp && (
                <Card tone="ink" className={styles.levelUp}>
                  <PartyPopper aria-hidden="true" />
                  <div>
                    <strong>Seu nível estimado agora é {result.levelUp.label}!</strong>
                    <p>Você concluiu as aulas do nível com bom desempenho.</p>
                  </div>
                </Card>
              )}

              <Card>
                <h2 className={styles.cardTitle}>
                  <BookMarked aria-hidden="true" /> Resumo da aula
                </h2>
                <ul className={styles.objectives}>
                  {result.takeaways.map((item) => (
                    <li key={item}>
                      <Check aria-hidden="true" /> {item}
                    </li>
                  ))}
                </ul>
                {result.newWords.length > 0 && (
                  <p className={styles.newWords}>
                    <strong>Palavras novas no seu vocabulário:</strong>{' '}
                    {result.newWords.map((word) => (
                      <mark key={word.id} className="marker" lang="en">
                        {word.word}
                      </mark>
                    ))}
                  </p>
                )}
              </Card>

              <div className={styles.summaryActions}>
                <Button
                  variant="accent"
                  size="lg"
                  className={styles.talkButton}
                  icon={<MessagesSquare aria-hidden="true" />}
                  onClick={() => practice.mutate()}
                  loading={practice.isPending}
                  loadingLabel={`${ASSISTANT_PERSONA.name} está preparando a conversa…`}
                >
                  Praticar isso na conversa
                </Button>
                {result.reviewSuggested && (
                  <Button to="/revisao" variant="secondary" size="lg" icon={<RefreshCcw aria-hidden="true" />}>
                    Revisar agora
                  </Button>
                )}
                {result.nextLesson && (
                  <Button to={`/aprender/aula/${result.nextLesson.id}`} variant="secondary" size="lg" iconEnd={<ArrowRight aria-hidden="true" />}>
                    Próxima: {result.nextLesson.title}
                  </Button>
                )}
                <Button to="/aprender" variant="ghost">
                  Voltar à trilha
                </Button>
              </div>
              {practice.isError && <ActionError error={practice.error} />}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function ExplanationStep({ lesson, onNext }: { lesson: LessonView; onNext: () => void }) {
  const api = useApi();
  const [showSupport, setShowSupport] = useState(false);
  const [alternatives, setAlternatives] = useState<string[]>([]);
  const explain = useMutation({
    mutationFn: () => api.explainAgain(lesson.id, alternatives.length),
    onSuccess: (data) => setAlternatives((current) => [...current, data.text]),
  });
  const supportLabel = lesson.language === 'pt' ? 'Ver em inglês' : 'Ver em português';

  return (
    <section className={`${styles.section} reveal`}>
      <div className={styles.stepHead}>
        <h1 data-page-title tabIndex={-1} className={styles.stepTitle}>
          Entendendo: <span lang="en">{lesson.topic}</span>
        </h1>
        {lesson.supportLanguageAvailable && (
          <Button variant="ghost" size="sm" icon={<Languages aria-hidden="true" />} onClick={() => setShowSupport((value) => !value)} aria-pressed={showSupport}>
            {showSupport ? 'Voltar' : supportLabel}
          </Button>
        )}
      </div>
      <Card className={styles.explanation}>
        {lesson.explanation.map((paragraph) => (
          <p key={paragraph.primary} lang={showSupport ? (lesson.language === 'pt' ? 'en' : 'pt-BR') : undefined}>
            {showSupport ? paragraph.support : paragraph.primary}
          </p>
        ))}
      </Card>
      {lesson.table && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>{lesson.table.caption}</caption>
            <thead>
              <tr>
                {lesson.table.headers.map((header) => (
                  <th key={header} scope="col">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lesson.table.rows.map((row) => (
                <tr key={row.join('|')}>
                  {row.map((cell, index) => (index === 0 ? <th key={index} scope="row">{cell}</th> : <td key={index}>{cell}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {alternatives.map((text, index) => (
        <div key={index} className={styles.aiCard} role="status">
          <AssistantAvatar size={32} />
          <div>
            <span className="caption">{ASSISTANT_PERSONA.name} · outra forma de explicar</span>
            <p>{text}</p>
          </div>
        </div>
      ))}
      {explain.isPending && (
        <div className={styles.aiCard} role="status">
          <AssistantAvatar size={32} thinking />
          <p className="muted">{ASSISTANT_PERSONA.name} está pensando em outra forma de explicar…</p>
        </div>
      )}
      {explain.isError && <ActionError error={explain.error} />}

      <div className={styles.rowActions}>
        <Button variant="secondary" icon={<Sparkles aria-hidden="true" />} onClick={() => explain.mutate()} disabled={explain.isPending}>
          Explicar de outro jeito
        </Button>
        <Button size="lg" onClick={onNext} iconEnd={<ArrowRight aria-hidden="true" />}>
          Ver exemplos
        </Button>
      </div>
    </section>
  );
}

function ExamplesStep({ lesson, onNext }: { lesson: LessonView; onNext: () => void }) {
  const api = useApi();
  const [extra, setExtra] = useState<Example[]>([]);
  const more = useMutation({
    mutationFn: () => api.anotherExample(lesson.id, extra.length),
    onSuccess: (example) => setExtra((current) => [...current, example]),
  });
  const examples = [...lesson.examples, ...extra];
  return (
    <section className={`${styles.section} reveal`}>
      <h1 data-page-title tabIndex={-1} className={styles.stepTitle}>
        Exemplos
      </h1>
      <ul className={styles.examples} aria-live="polite">
        {examples.map((example, index) => (
          <li key={`${example.en}-${index}`} className={cx(styles.example, index >= lesson.examples.length && styles.exampleNew)}>
            <p className={styles.exampleEn} lang="en">
              <Highlight text={example.en} highlight={example.highlight} />
            </p>
            <p className={styles.examplePt}>{example.pt}</p>
          </li>
        ))}
      </ul>
      {more.isError && <ActionError error={more.error} />}
      <div className={styles.rowActions}>
        <Button variant="secondary" icon={<Shuffle aria-hidden="true" />} onClick={() => more.mutate()} loading={more.isPending} loadingLabel="Criando exemplo…">
          Me dê outro exemplo
        </Button>
        <Button size="lg" onClick={onNext} iconEnd={<ArrowRight aria-hidden="true" />}>
          Continuar
        </Button>
      </div>
    </section>
  );
}
