import { useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  Compass,
  Cpu,
  GraduationCap,
  HelpCircle,
  MessagesSquare,
  Plane,
  Sprout,
  TrendingUp,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  GOAL_DESCRIPTIONS,
  GOAL_LABELS,
  GOALS,
  INTEREST_AREA_LABELS,
  INTEREST_AREAS,
  LEVEL_DESCRIPTIONS,
  MAX_INTEREST_AREAS,
  PERCEIVED_LEVEL_LABELS,
  PRIOR_EXPERIENCE_LABELS,
  PRIOR_EXPERIENCES,
  type Goal,
  type InterestArea,
  type PerceivedLevel,
  type PriorExperience,
  type ProfileInput,
} from '@english-ai/core';
import { Button } from '../../components/Button';
import { ChoiceGroup, Chip, Switch } from '../../components/Controls';
import { FocusBar } from '../../components/FocusBar';
import { InlineAlert } from '../../components/States';
import { useToast } from '../../components/Overlay';
import { useAccount, useSession } from '../../app/session';
import { errorMessage } from '../../services';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import styles from './OnboardingPage.module.css';

const GOAL_ICONS: Record<Goal, ReactNode> = {
  basics: <Sprout />,
  conversation: <MessagesSquare />,
  work: <Briefcase />,
  travel: <Plane />,
  technology: <Cpu />,
};

const PERCEIVED: PerceivedLevel[] = ['beginner', 'basic', 'intermediate', 'advanced', 'unknown'];
const PERCEIVED_HINTS: Record<PerceivedLevel, string> = {
  unknown: 'Tudo bem — o nivelamento vai ajudar.',
  beginner: LEVEL_DESCRIPTIONS.beginner,
  basic: LEVEL_DESCRIPTIONS.basic,
  intermediate: LEVEL_DESCRIPTIONS.intermediate,
  advanced: LEVEL_DESCRIPTIONS.advanced,
};

const STEPS = ['Objetivo', 'Experiência', 'Interesses'] as const;

/**
 * UC03 — Configurar perfil. No primeiro acesso é a "configuração inicial" (3 passos curtos);
 * depois, o mesmo formulário é usado em Perfil → Editar perfil de aprendizagem.
 */
export function OnboardingPage({ mode = 'onboarding' }: { mode?: 'onboarding' | 'edit' }) {
  useDocumentTitle(mode === 'edit' ? 'Editar perfil de aprendizagem' : 'Configuração inicial');
  const account = useAccount();
  const { api, refresh } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const profile = account.profile;
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal | null>(profile.goal);
  const [perceived, setPerceived] = useState<PerceivedLevel | null>(profile.goal ? profile.perceivedLevel : null);
  const [experience, setExperience] = useState<PriorExperience | null>(profile.priorExperience);
  const [conversation, setConversation] = useState(profile.conversationInterest);
  const [professional, setProfessional] = useState(profile.professionalInterest);
  const [areas, setAreas] = useState<InterestArea[]>(profile.interestAreas);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canContinue = step === 0 ? goal !== null : step === 1 ? perceived !== null && experience !== null : true;

  function toggleArea(area: InterestArea) {
    setAreas((current) =>
      current.includes(area) ? current.filter((item) => item !== area) : current.length >= MAX_INTEREST_AREAS ? current : [...current, area],
    );
  }

  async function finish() {
    if (!goal || !perceived || !experience) return;
    setSaving(true);
    setError(null);
    const input: ProfileInput = {
      goal,
      perceivedLevel: perceived,
      priorExperience: experience,
      conversationInterest: conversation,
      professionalInterest: professional,
      interestAreas: areas,
    };
    try {
      await api.saveProfile(input);
      await refresh();
      await queryClient.invalidateQueries();
      if (mode === 'edit') {
        toast('Perfil de aprendizagem atualizado.');
        navigate('/perfil');
      } else {
        navigate('/nivelamento');
      }
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  const next = () => (step < STEPS.length - 1 ? setStep(step + 1) : void finish());

  return (
    <div className={`${styles.page} dotted-paper`}>
      <div className={styles.inner}>
        <FocusBar
          icon={step === 0 ? 'close' : 'back'}
          backLabel={step === 0 ? (mode === 'edit' ? 'Cancelar edição' : 'Sair') : 'Voltar ao passo anterior'}
          onBack={() => (step === 0 ? navigate(mode === 'edit' ? '/perfil' : '/') : setStep(step - 1))}
          title={`Passo ${step + 1} de ${STEPS.length} · ${STEPS[step]}`}
          progress={(step + 1) / STEPS.length}
          progressLabel="Progresso da configuração"
        />
        <main id="conteudo" className={`${styles.content} reveal`} key={step}>
          {step === 0 && (
            <>
              <header className={styles.header}>
                <span className="caption">{mode === 'edit' ? 'Perfil de aprendizagem' : `Olá, ${account.user.name.split(' ')[0]}!`}</span>
                <h1 data-page-title tabIndex={-1}>
                  Qual é o seu principal objetivo com o inglês?
                </h1>
                <p className="muted">Vamos usar isso para sugerir aulas e assuntos de conversa.</p>
              </header>
              <ChoiceGroup
                legend="Objetivo de aprendizagem"
                hideLegend
                options={GOALS.map((value) => ({ value, title: GOAL_LABELS[value], description: GOAL_DESCRIPTIONS[value], icon: GOAL_ICONS[value] }))}
                value={goal}
                onChange={setGoal}
              />
            </>
          )}

          {step === 1 && (
            <>
              <header className={styles.header}>
                <h1 data-page-title tabIndex={-1}>
                  Como você descreve seu inglês hoje?
                </h1>
                <p className="muted">Não existe resposta errada. Depois, o nivelamento faz uma estimativa.</p>
              </header>
              <ChoiceGroup
                legend="Nível percebido"
                hideLegend
                columns={2}
                options={PERCEIVED.map((value) => ({
                  value,
                  title: PERCEIVED_LEVEL_LABELS[value],
                  description: PERCEIVED_HINTS[value],
                  icon: value === 'unknown' ? <HelpCircle /> : <TrendingUp />,
                }))}
                value={perceived}
                onChange={setPerceived}
              />
              <fieldset className={styles.chipsGroup}>
                <legend>Você já estudou inglês antes?</legend>
                <div className={styles.chips}>
                  {PRIOR_EXPERIENCES.map((value) => (
                    <Chip key={value} selected={experience === value} onClick={() => setExperience(value)}>
                      {PRIOR_EXPERIENCE_LABELS[value]}
                    </Chip>
                  ))}
                </div>
              </fieldset>
            </>
          )}

          {step === 2 && (
            <>
              <header className={styles.header}>
                <h1 data-page-title tabIndex={-1}>
                  O que mais te interessa?
                </h1>
                <p className="muted">Usamos seus interesses para escolher assuntos de conversa. Tudo opcional.</p>
              </header>
              <div className={styles.switches}>
                <Switch
                  title="Quero praticar conversação"
                  description="Daremos destaque ao Modo Conversação."
                  checked={conversation}
                  onChange={setConversation}
                />
                <Switch
                  title="Uso (ou quero usar) inglês no trabalho"
                  description="Ajuda a priorizar situações profissionais."
                  checked={professional}
                  onChange={setProfessional}
                />
              </div>
              <fieldset className={styles.chipsGroup}>
                <legend>
                  Áreas de interesse <span className="muted">(até {MAX_INTEREST_AREAS})</span>
                </legend>
                <div className={styles.chips}>
                  {INTEREST_AREAS.map((area) => (
                    <Chip key={area} selected={areas.includes(area)} onClick={() => toggleArea(area)}>
                      {INTEREST_AREA_LABELS[area]}
                    </Chip>
                  ))}
                </div>
                <p className={styles.counter} aria-live="polite">
                  {areas.length} de {MAX_INTEREST_AREAS} selecionadas
                </p>
              </fieldset>
            </>
          )}

          {error && <InlineAlert>{error}</InlineAlert>}

          <div className={styles.footer}>
            <Button
              size="lg"
              block
              disabled={!canContinue}
              loading={saving}
              loadingLabel="Salvando…"
              onClick={next}
              icon={step === STEPS.length - 1 && mode === 'onboarding' ? <GraduationCap aria-hidden="true" /> : undefined}
            >
              {step < STEPS.length - 1 ? 'Continuar' : mode === 'edit' ? 'Salvar alterações' : 'Salvar e fazer o nivelamento'}
            </Button>
            {step === STEPS.length - 1 && mode === 'onboarding' && (
              <p className={styles.footNote}>
                <Compass aria-hidden="true" /> Você pode mudar essas escolhas depois, no seu perfil.
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
