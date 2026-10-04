import { useMutation } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import {
  CORRECTION_INTENSITY_INFO,
  DAILY_GOAL_OPTIONS,
  type Correction,
  type CorrectionIntensity,
  type Preferences,
  type PreferencesInput,
} from '@english-ai/core';
import { Chip, ChoiceGroup, SegmentedControl, Switch } from '../../components/Controls';
import { CorrectionCard } from '../../components/CorrectionCard';
import { Card, PageHeader } from '../../components/Display';
import { useToast } from '../../components/Overlay';
import { InlineAlert } from '../../components/States';
import { useAccount, useSession } from '../../app/session';
import { errorMessage } from '../../services';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import styles from './Settings.module.css';

const SAMPLE: Correction = {
  original: 'I have 25 years.',
  suggestion: "I'm 25 years old.",
  changes: [{ from: 'have 25 years', to: '25 years old' }],
  explanation: 'Em inglês, a idade é dita com o verbo "to be": I am 25 years old.',
  tip: null,
  severity: 'grammar',
  skillTag: 'to_be',
  ruleId: 'sample',
};

const INTENSITY_PREVIEW: Record<CorrectionIntensity, string> = {
  light: 'Na conversa, este erro não interromperia: ele aparece só no resumo final.',
  balanced: 'Aparece de forma discreta, sem correções em mensagens seguidas.',
  detailed: 'Aparece sempre, com explicação e dicas extras — inclusive de naturalidade.',
};

/** UC12 — Configurar preferências. Cada alteração é salva automaticamente. */
export function PreferencesPage() {
  useDocumentTitle('Preferências');
  const account = useAccount();
  const { api, setAccount } = useSession();
  const toast = useToast();
  const prefs = account.preferences;

  const update = useMutation({
    mutationFn: (input: PreferencesInput) => api.updatePreferences(input),
    onSuccess: (next: Preferences) => {
      setAccount({ ...account, preferences: next });
      toast('Preferência salva.');
    },
  });
  const save = (input: PreferencesInput) => update.mutate(input);

  return (
    <div className="reveal">
      <PageHeader title="Preferências" subtitle="Ajuste como a IA explica, corrige e conversa com você. As mudanças são salvas na hora." />
      {update.isError && <InlineAlert>{errorMessage(update.error)}</InlineAlert>}
      <div className={styles.stack}>
        <Card aria-labelledby="pref-explanations">
          <h2 id="pref-explanations" className={styles.title}>
            Idioma das explicações
          </h2>
          <p className={styles.description}>
            No automático, iniciantes recebem explicações em português e níveis mais altos, em inglês (com apoio em português).
          </p>
          <SegmentedControl
            label="Idioma das explicações"
            value={prefs.explanationLanguage}
            onChange={(value) => save({ explanationLanguage: value })}
            options={[
              { value: 'auto', label: 'Automático' },
              { value: 'pt', label: 'Português' },
              { value: 'en', label: 'Inglês' },
            ]}
          />
        </Card>

        <Card aria-labelledby="pref-corrections">
          <h2 id="pref-corrections" className={styles.title}>
            Intensidade das correções
          </h2>
          <p className={styles.description}>Vale para a conversa. Nos exercícios, a correção sempre aparece — é o objetivo da atividade.</p>
          <ChoiceGroup
            legend="Intensidade das correções"
            hideLegend
            columns={3}
            value={prefs.correctionIntensity}
            onChange={(value) => save({ correctionIntensity: value })}
            options={(['light', 'balanced', 'detailed'] as const).map((value) => ({
              value,
              title: CORRECTION_INTENSITY_INFO[value].label,
              description: CORRECTION_INTENSITY_INFO[value].description,
            }))}
          />
          <div className={styles.preview}>
            <span className="caption">Como fica, por exemplo</span>
            <CorrectionCard correction={SAMPLE} variant="chat" />
            <p className={styles.previewNote}>{INTENSITY_PREVIEW[prefs.correctionIntensity]}</p>
          </div>
        </Card>

        <Card aria-labelledby="pref-conversation">
          <h2 id="pref-conversation" className={styles.title}>
            Conversação
          </h2>
          <div className={styles.row}>
            <span className={styles.rowLabel}>Tamanho das respostas da IA</span>
            <SegmentedControl
              label="Tamanho das respostas"
              value={prefs.replyLength}
              onChange={(value) => save({ replyLength: value })}
              options={[
                { value: 'short', label: 'Curtas' },
                { value: 'balanced', label: 'Equilibradas' },
              ]}
            />
          </div>
          <Switch
            title="Tradução de apoio nas conversas"
            description="Mostra “Ver tradução” nas mensagens da IA (níveis Iniciante e Básico)."
            checked={prefs.showTranslations}
            onChange={(value) => save({ showTranslations: value })}
          />
        </Card>

        <Card aria-labelledby="pref-learning">
          <h2 id="pref-learning" className={styles.title}>
            Aprendizagem
          </h2>
          <p className={styles.description}>Meta diária de estudo, usada no Início.</p>
          <div className={styles.chips} role="group" aria-label="Meta diária em minutos">
            {DAILY_GOAL_OPTIONS.map((minutes) => (
              <Chip key={minutes} selected={prefs.dailyGoalMinutes === minutes} onClick={() => save({ dailyGoalMinutes: minutes })}>
                {minutes} min
              </Chip>
            ))}
          </div>
          <Switch
            title="Lembretes de estudo"
            description="No MVP a preferência é salva, mas os lembretes ainda não são enviados."
            checked={prefs.studyReminders}
            onChange={(value) => save({ studyReminders: value })}
          />
        </Card>

        <Card aria-labelledby="pref-privacy">
          <h2 id="pref-privacy" className={styles.title}>
            Histórico e privacidade
          </h2>
          <Switch
            title="Salvar histórico de conversas"
            description={
              prefs.saveConversationHistory
                ? 'Conversas ficam salvas para você rever (apagadas automaticamente após 90 dias).'
                : 'O conteúdo de novas conversas é apagado ao encerrar.'
            }
            checked={prefs.saveConversationHistory}
            onChange={(value) => save({ saveConversationHistory: value })}
          />
          <Link to="/privacidade" className={styles.privacyLink}>
            <ShieldCheck aria-hidden="true" /> Ver dados coletados, apagar histórico ou excluir a conta
          </Link>
        </Card>
      </div>
    </div>
  );
}
