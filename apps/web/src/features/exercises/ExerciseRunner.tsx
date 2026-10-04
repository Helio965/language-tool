import { ArrowRight, CheckCircle2, CircleDot, Languages, Lightbulb, XCircle } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { EXERCISE_TYPE_LABELS, countWords, type ExerciseFeedback, type PublicExercise } from '@english-ai/core';
import { AssistantAvatar } from '../../components/Brand';
import { Button } from '../../components/Button';
import { ChoiceGroup } from '../../components/Controls';
import { CorrectionCard } from '../../components/CorrectionCard';
import { ActionError } from '../../app/QueryErrorState';
import { cx } from '../../utils/cx';
import styles from './ExerciseRunner.module.css';

export interface ExerciseOutcome {
  exerciseId: string;
  correct: boolean;
}

interface RunnerProps {
  exercises: PublicExercise[];
  onAnswer: (exercise: PublicExercise, answer: string) => Promise<ExerciseFeedback>;
  onFinish: (outcomes: ExerciseOutcome[]) => void;
  onIndexChange?: (index: number) => void;
  finishLabel?: string;
}

/** Executa uma sequência de exercícios: responder → verificar → feedback explicado → continuar. */
export function ExerciseRunner({ exercises, onAnswer, onFinish, onIndexChange, finishLabel = 'Concluir' }: RunnerProps) {
  const [index, setIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<ExerciseOutcome[]>([]);
  const exercise = exercises[index];

  useEffect(() => onIndexChange?.(index), [index, onIndexChange]);
  if (!exercise) return null;

  const last = index === exercises.length - 1;
  return (
    <ExerciseCard
      key={exercise.id}
      exercise={exercise}
      position={`Exercício ${index + 1} de ${exercises.length}`}
      onAnswer={onAnswer}
      continueLabel={last ? finishLabel : 'Continuar'}
      onContinue={(correct) => {
        const next = [...outcomes, { exerciseId: exercise.id, correct }];
        setOutcomes(next);
        if (last) onFinish(next);
        else setIndex(index + 1);
      }}
    />
  );
}

function ExerciseCard({
  exercise,
  position,
  onAnswer,
  onContinue,
  continueLabel,
}: {
  exercise: PublicExercise;
  position: string;
  onAnswer: RunnerProps['onAnswer'];
  onContinue: (correct: boolean) => void;
  continueLabel: string;
}) {
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<ExerciseFeedback | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [checking, setChecking] = useState(false);
  const isOpen = exercise.type === 'write';

  async function check(event?: FormEvent) {
    event?.preventDefault();
    if (!answer.trim() || feedback) return;
    setChecking(true);
    setError(null);
    try {
      setFeedback(await onAnswer(exercise, answer.trim()));
    } catch (err) {
      setError(err);
    } finally {
      setChecking(false);
    }
  }

  const locked = Boolean(feedback) || checking;
  const tone = (option: string) => {
    if (!feedback) return undefined;
    if (feedback.expectedAnswer && option.toLowerCase() === feedback.expectedAnswer.toLowerCase()) return 'correct' as const;
    if (option === answer && feedback.status !== 'correct') return 'incorrect' as const;
    return undefined;
  };

  return (
    <div className={styles.card}>
      <div className={styles.meta}>
        <span className="caption">{position}</span>
        <span className={styles.type}>{EXERCISE_TYPE_LABELS[exercise.type]}</span>
      </div>
      <form onSubmit={check} className={styles.form}>
        <h2 className={styles.instruction}>{exercise.instruction}</h2>

        {exercise.type === 'translate' && (
          <p className={styles.source} lang="pt-BR">
            “{exercise.prompt}”
          </p>
        )}
        {(exercise.type === 'multiple_choice' || exercise.type === 'write') && (
          <p className={styles.prompt} lang={exercise.type === 'write' ? 'en' : undefined}>
            {exercise.prompt}
          </p>
        )}
        {exercise.type === 'select_word' && <Sentence prompt={exercise.prompt} filled={answer} />}

        {exercise.type === 'fill_blank' && (
          <p className={styles.sentence} lang="en">
            {exercise.prompt.split('___').map((part, i, all) => (
              <span key={i}>
                {part}
                {i < all.length - 1 && (
                  <input
                    className={cx(styles.blankInput, feedback && styles[`input_${feedback.status}`])}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    aria-label="Complete a lacuna"
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    readOnly={locked}
                    size={Math.max(4, answer.length + 1)}
                    autoFocus
                  />
                )}
              </span>
            ))}
          </p>
        )}

        {(exercise.type === 'multiple_choice' || exercise.type === 'select_word') && (
          <ChoiceGroup
            legend="Opções"
            hideLegend
            columns={exercise.type === 'select_word' || (exercise.options ?? []).every((option) => option.length < 22) ? 2 : 1}
            options={(exercise.options ?? []).map((option) => ({ value: option, title: <span lang="en">{option}</span> }))}
            value={answer || null}
            onChange={(value) => !locked && setAnswer(value)}
            disabled={locked}
            tone={tone}
          />
        )}

        {(exercise.type === 'translate' || isOpen) && (
          <div className={styles.textareaWrap}>
            <label className="visually-hidden" htmlFor={`answer-${exercise.id}`}>
              Sua resposta em inglês
            </label>
            <textarea
              id={`answer-${exercise.id}`}
              className={styles.textarea}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={isOpen ? 'Escreva sua frase em inglês…' : 'Digite a tradução em inglês…'}
              rows={isOpen ? 3 : 2}
              maxLength={400}
              readOnly={locked}
              lang="en"
              autoCapitalize="sentences"
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void check();
                }
              }}
            />
            {isOpen && <span className={styles.counter}>{countWords(answer)} palavras</span>}
          </div>
        )}

        {exercise.hint && !feedback && (
          <p className={styles.hint}>
            <Lightbulb aria-hidden="true" /> Dica: {exercise.hint}
          </p>
        )}

        <ActionError error={error} />

        {!feedback && (
          <div className={styles.actions}>
            <Button
              type="submit"
              size="lg"
              block
              disabled={!answer.trim()}
              loading={checking}
              loadingLabel={isOpen ? 'A IA está analisando sua frase…' : 'Verificando…'}
            >
              Verificar
            </Button>
          </div>
        )}
      </form>

      {feedback && (
        <FeedbackPanel feedback={feedback} continueLabel={continueLabel} onContinue={() => onContinue(feedback.status === 'correct')} />
      )}
    </div>
  );
}

function Sentence({ prompt, filled }: { prompt: string; filled: string }) {
  return (
    <p className={styles.sentence} lang="en">
      {prompt.split('___').map((part, i, all) => (
        <span key={i}>
          {part}
          {i < all.length - 1 && <span className={cx(styles.blank, filled && styles.blankFilled)}>{filled || ' '}</span>}
        </span>
      ))}
    </p>
  );
}

const STATUS_ICON = { correct: CheckCircle2, almost: CircleDot, incorrect: XCircle } as const;

function FeedbackPanel({
  feedback,
  onContinue,
  continueLabel,
}: {
  feedback: ExerciseFeedback;
  onContinue: () => void;
  continueLabel: string;
}) {
  const [showSupport, setShowSupport] = useState(false);
  const [showWhy, setShowWhy] = useState(feedback.status !== 'correct');
  const Icon = STATUS_ICON[feedback.status];
  const correct = feedback.status === 'correct';

  return (
    <div className={cx(styles.feedback, styles[`feedback_${feedback.status}`])} role="status" aria-live="polite">
      <div className={styles.feedbackHead}>
        <Icon aria-hidden="true" />
        <strong>{feedback.title}</strong>
      </div>

      {feedback.correction ? (
        <>
          {feedback.aiFeedback && (
            <p className={styles.ai}>
              <AssistantAvatar size={26} /> {feedback.aiFeedback}
            </p>
          )}
          <CorrectionCard correction={feedback.correction} />
        </>
      ) : (
        <>
          {!correct && feedback.expectedAnswer && (
            <dl className={styles.compare}>
              <div>
                <dt>Sua resposta</dt>
                <dd lang="en">{feedback.userAnswer}</dd>
              </div>
              <div>
                <dt>Forma recomendada</dt>
                <dd lang="en">
                  <mark className="marker">{feedback.expectedAnswer}</mark>
                </dd>
              </div>
            </dl>
          )}
          {correct && feedback.aiFeedback && (
            <p className={styles.ai}>
              <AssistantAvatar size={26} /> {feedback.aiFeedback}
            </p>
          )}
          {correct && !showWhy ? (
            <button type="button" className={styles.linkButton} onClick={() => setShowWhy(true)}>
              Por que está certo?
            </button>
          ) : (
            <div className={styles.why}>
              <span className="caption">{correct ? 'Por que está certo' : 'Explicação'}</span>
              <p>{showSupport && feedback.supportExplanation ? feedback.supportExplanation : feedback.explanation}</p>
              {feedback.tip && (
                <p className={styles.tip}>
                  <Lightbulb aria-hidden="true" /> {feedback.tip}
                </p>
              )}
              {feedback.supportExplanation && feedback.supportExplanation !== feedback.explanation && (
                <button type="button" className={styles.linkButton} onClick={() => setShowSupport((value) => !value)}>
                  <Languages aria-hidden="true" /> {showSupport ? 'Voltar ao idioma original' : 'Ver no outro idioma'}
                </button>
              )}
            </div>
          )}
        </>
      )}

      <Button size="lg" block onClick={onContinue} iconEnd={<ArrowRight aria-hidden="true" />} autoFocus>
        {continueLabel}
      </Button>
    </div>
  );
}
