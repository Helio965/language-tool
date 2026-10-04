import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Clock, Compass, Info, ListChecks } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  LEVEL_LABELS,
  LEVELS,
  PERCEIVED_LEVEL_LABELS,
  type PlacementResultView,
  type PublicPlacementQuestion,
} from '@english-ai/core';
import { Button } from '../../components/Button';
import { Card } from '../../components/Display';
import { ChoiceGroup } from '../../components/Controls';
import { FocusBar } from '../../components/FocusBar';
import { InlineAlert, LoadingState } from '../../components/States';
import { useSession } from '../../app/session';
import { errorMessage } from '../../services';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { cx } from '../../utils/cx';
import styles from './PlacementPage.module.css';

type Phase =
  | { kind: 'intro' }
  | { kind: 'question'; questions: PublicPlacementQuestion[]; index: number; stageNumber: number; totalStages: number }
  | { kind: 'analyzing' }
  | { kind: 'result'; result: PlacementResultView };

/**
 * UC04 — Nivelamento. Etapas adaptativas; resultado apresentado como NÍVEL ESTIMADO
 * (estimativa pedagógica, não certificação). Em "retake", é refeito a partir do Perfil.
 */
export function PlacementPage({ retake = false }: { retake?: boolean }) {
  useDocumentTitle('Nivelamento');
  const { api, refresh } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>({ kind: 'intro' });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const step = await api.startPlacement();
      if (step.status === 'continue') setPhase({ kind: 'question', ...step, index: 0 });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function skip() {
    setBusy(true);
    try {
      const result = await api.skipPlacement();
      setPhase({ kind: 'result', result });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmAnswer() {
    if (phase.kind !== 'question' || selected === null) return;
    const question = phase.questions[phase.index];
    if (!question) return;
    const nextAnswers = { ...answers, [question.id]: selected };
    setAnswers(nextAnswers);
    setSelected(null);
    if (phase.index < phase.questions.length - 1) {
      setPhase({ ...phase, index: phase.index + 1 });
      return;
    }
    setPhase({ kind: 'analyzing' });
    try {
      const step = await api.submitPlacement(nextAnswers);
      if (step.status === 'continue') {
        setPhase({ kind: 'question', ...step, index: 0 });
      } else {
        // A sessão só é atualizada ao sair do resultado: senão a guarda de rota
        // (nextStep = ready) redirecionaria antes de o usuário ver o nível estimado.
        setPhase({ kind: 'result', result: step.result });
      }
    } catch (err) {
      setError(errorMessage(err));
      setPhase({ kind: 'intro' });
    }
  }

  const exitTo = retake ? '/perfil' : undefined;

  async function finish() {
    setBusy(true);
    await refresh();
    await queryClient.invalidateQueries();
    navigate(retake ? '/perfil' : '/inicio');
  }

  return (
    <div className={`${styles.page} dotted-paper`}>
      <div className={styles.inner}>
        {phase.kind === 'question' ? (
          <FocusBar
            backTo={exitTo ?? '/'}
            backLabel="Sair do nivelamento"
            title={`Etapa ${phase.stageNumber} de até ${phase.totalStages} · Atividade ${phase.index + 1} de ${phase.questions.length}`}
            progress={((phase.stageNumber - 1) * phase.questions.length + phase.index) / (phase.totalStages * phase.questions.length)}
            progressLabel="Progresso do nivelamento"
          />
        ) : (
          <FocusBar backTo={exitTo} title="Nivelamento" />
        )}

        <main id="conteudo" className={styles.content}>
          {phase.kind === 'intro' && (
            <div className={`${styles.stack} reveal`}>
              <span className="caption">{retake ? 'Refazer nivelamento' : 'Último passo antes de começar'}</span>
              <h1 data-page-title tabIndex={-1}>
                Vamos estimar o seu nível de inglês
              </h1>
              <ul className={styles.facts}>
                <li>
                  <Clock aria-hidden="true" /> Cerca de 3 minutos.
                </li>
                <li>
                  <ListChecks aria-hidden="true" /> De 4 a 12 atividades — elas ficam mais difíceis se você for bem.
                </li>
                <li>
                  <Info aria-hidden="true" /> Não é prova oficial: é um ponto de partida que se ajusta conforme você estuda.
                </li>
              </ul>
              {error && <InlineAlert>{error}</InlineAlert>}
              <div className={styles.actions}>
                <Button size="lg" onClick={start} loading={busy} loadingLabel="Preparando…" iconEnd={<ArrowRight aria-hidden="true" />}>
                  Começar nivelamento
                </Button>
                <Button size="lg" variant="secondary" onClick={skip} disabled={busy}>
                  Prefiro começar do zero
                </Button>
              </div>
            </div>
          )}

          {phase.kind === 'question' && (() => {
            const question = phase.questions[phase.index];
            if (!question) return null;
            return (
              <div className={`${styles.stack} reveal`} key={question.id}>
                <span className="caption">{question.instruction}</span>
                {question.passage && (
                  <blockquote className={styles.passage} lang="en">
                    {question.passage}
                  </blockquote>
                )}
                <h1 className={styles.prompt} data-page-title tabIndex={-1} lang={/[ãçéêíóôú]/i.test(question.prompt) ? 'pt-BR' : 'en'}>
                  {question.prompt.split('___').map((part, index, all) => (
                    <span key={index}>
                      {part}
                      {index < all.length - 1 && <span className={styles.blank} aria-label="lacuna" />}
                    </span>
                  ))}
                </h1>
                <ChoiceGroup
                  legend="Escolha uma resposta"
                  hideLegend
                  columns={question.options.some((option) => option.length > 24) ? 1 : 2}
                  options={question.options.map((option) => ({ value: option, title: <span lang="en">{option}</span> }))}
                  value={selected}
                  onChange={setSelected}
                />
                <div className={styles.actions}>
                  <Button size="lg" block disabled={selected === null} onClick={confirmAnswer}>
                    {phase.index < phase.questions.length - 1 ? 'Próxima' : 'Concluir etapa'}
                  </Button>
                </div>
                <p className={styles.hint}>Não sabe? Escolha a opção que parecer mais natural — vale a sua intuição.</p>
              </div>
            );
          })()}

          {phase.kind === 'analyzing' && <LoadingState label="Analisando suas respostas…" />}

          {phase.kind === 'result' && <Result result={phase.result} onContinue={finish} loading={busy} retake={retake} />}
        </main>
      </div>
    </div>
  );
}

function Result({
  result,
  onContinue,
  retake,
  loading,
}: {
  result: PlacementResultView;
  onContinue: () => void;
  retake: boolean;
  loading: boolean;
}) {
  return (
    <div className={`${styles.stack} reveal`}>
      <span className="caption">Resultado do nivelamento</span>
      <Card tone="ink" className={styles.resultCard}>
        <span className={styles.resultLabel}>Seu nível estimado</span>
        <h1 className={styles.resultLevel} data-page-title tabIndex={-1}>
          {result.levelLabel}
        </h1>
        <ol className={styles.scale} aria-label="Escala de níveis">
          {LEVELS.map((level) => (
            <li key={level} className={cx(level === result.level && styles.current)} aria-current={level === result.level ? 'step' : undefined}>
              {LEVEL_LABELS[level]}
            </li>
          ))}
        </ol>
        <p>{result.levelDescription}</p>
        {!result.skipped && (
          <p className={styles.score}>
            Você acertou {result.correct} de {result.answered} atividades.
          </p>
        )}
      </Card>
      <Card>
        <div className={styles.comparison}>
          <Compass aria-hidden="true" />
          <div>
            {result.perceivedLevel !== 'unknown' && !result.skipped && (
              <p className="muted">Você se descreveu como: {PERCEIVED_LEVEL_LABELS[result.perceivedLevel]}.</p>
            )}
            <p>{result.comparison}</p>
          </div>
        </div>
      </Card>
      <p className={styles.disclaimer}>
        <Info aria-hidden="true" />
        <span>
          Este resultado é uma <strong>estimativa pedagógica</strong> para personalizar seus estudos — não é uma certificação oficial de
          proficiência.
        </span>
      </p>
      <Button size="lg" onClick={onContinue} loading={loading} iconEnd={<ArrowRight aria-hidden="true" />}>
        {retake ? 'Voltar ao perfil' : 'Ir para o início'}
      </Button>
    </div>
  );
}
