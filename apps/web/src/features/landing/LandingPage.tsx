import { useState } from 'react';
import { useSession } from '../../app/session';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { errorMessage } from '../../services';
import styles from './Landing.module.css';
import { LandingFooter } from './LandingFooter';
import { LandingHeader } from './LandingHeader';
import {
  AiSection,
  FinalCta,
  HeroSection,
  HowItWorksSection,
  LearnSection,
  PersonalizationSection,
  ProblemSection,
  ProgressSection,
  SecuritySection,
  TalkSection,
  type DemoAction,
} from './LandingSections';
import { useSectionNavigation } from './useSectionNavigation';

/**
 * Página pública (`/`). Visitantes conhecem o produto; quem já tem sessão é levado pela guarda
 * PublicOnly à etapa pendente (configuração, nivelamento ou Início). Ver docs/UX-SPECIFICATION.md.
 */
export function LandingPage() {
  useDocumentTitle('Aprenda inglês com IA');
  const { api, signIn } = useSession();
  const { linkProps } = useSectionNavigation();
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  async function startDemo() {
    if (!api.startDemo || demoLoading) return;
    setDemoLoading(true);
    setDemoError(null);
    try {
      // A guarda PublicOnly leva à etapa pendente da conta de demonstração.
      signIn(await api.startDemo());
    } catch (err) {
      setDemoError(errorMessage(err));
      setDemoLoading(false);
    }
  }

  const demo: DemoAction = { available: api.mode === 'demo' && Boolean(api.startDemo), loading: demoLoading, error: demoError, start: () => void startDemo() };

  return (
    <div className={styles.page}>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <LandingHeader linkProps={linkProps} />
      <main id="conteudo" className={styles.main} tabIndex={-1}>
        <HeroSection demo={demo} />
        <ProblemSection />
        <HowItWorksSection />
        <LearnSection />
        <TalkSection />
        <AiSection />
        <ProgressSection />
        <PersonalizationSection />
        <SecuritySection />
        <FinalCta demo={demo} />
      </main>
      <LandingFooter linkProps={linkProps} />
    </div>
  );
}
