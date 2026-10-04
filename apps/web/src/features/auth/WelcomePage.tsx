import { ArrowRight, BookOpen, MessagesSquare, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { ASSISTANT_PERSONA } from '@english-ai/core';
import { AssistantAvatar, Logo } from '../../components/Brand';
import { Button } from '../../components/Button';
import { InlineAlert } from '../../components/States';
import { useSession } from '../../app/session';
import { errorMessage } from '../../services';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import styles from './WelcomePage.module.css';

export function WelcomePage() {
  useDocumentTitle('Aprenda inglês com IA');
  const { api, signIn } = useSession();
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exploreDemo() {
    if (!api.startDemo || demoLoading) return;
    setDemoLoading(true);
    setError(null);
    try {
      // A guarda PublicOnly leva à etapa pendente da conta de demonstração.
      signIn(await api.startDemo());
    } catch (err) {
      setError(errorMessage(err));
      setDemoLoading(false);
    }
  }

  return (
    <div className={`${styles.page} dotted-paper`}>
      <header className={styles.top}>
        <Logo />
        <Button to="/entrar" variant="ghost" size="sm">
          Entrar
        </Button>
      </header>

      <main className={styles.main} id="conteudo">
        <section className={`${styles.hero} reveal`} aria-labelledby="hero-title">
          <span className={styles.kicker}>
            <Sparkles aria-hidden="true" /> Do primeiro “hello” à conversa
          </span>
          <h1 id="hero-title" className={styles.title}>
            Inglês de verdade, <span className="marker">no seu ritmo</span>.
          </h1>
          <p className={styles.lead}>
            Aulas curtas, conversa com IA e correções que explicam o porquê — com explicações em português quando você
            precisa.
          </p>
          <div className={styles.actions}>
            <Button to="/cadastro" size="lg" iconEnd={<ArrowRight aria-hidden="true" />}>
              Criar conta grátis
            </Button>
            <Button to="/entrar" size="lg" variant="secondary">
              Já tenho conta
            </Button>
          </div>
          {api.mode === 'demo' && (
            <div className={styles.demo}>
              <Button variant="ghost" onClick={exploreDemo} loading={demoLoading} loadingLabel="Preparando demonstração…">
                Explorar demonstração com dados de exemplo
              </Button>
              <p className={styles.demoNote}>Modo demonstração: os dados ficam apenas neste navegador e a IA é simulada.</p>
              {error && <InlineAlert>{error}</InlineAlert>}
            </div>
          )}
        </section>

        <section className={styles.preview} aria-label="Como funciona">
          <article className={`${styles.modeCard} ${styles.learn}`}>
            <span className={styles.modeIcon}>
              <BookOpen aria-hidden="true" />
            </span>
            <h2>Aprender</h2>
            <p>Aulas estruturadas do Iniciante ao Avançado: explicação, exemplos, exercícios e revisão.</p>
          </article>
          <article className={`${styles.modeCard} ${styles.talk}`}>
            <span className={styles.modeIcon}>
              <MessagesSquare aria-hidden="true" />
            </span>
            <h2>Conversar</h2>
            <p>Pratique sem medo de errar. A IA conversa com naturalidade e corrige só quando ajuda.</p>
          </article>
          <article className={styles.chatSample} aria-label="Exemplo de conversa com correção">
            <div className={styles.bubbleUser} lang="en">
              I have 25 years.
            </div>
            <div className={styles.note}>
              <span>More natural</span>
              <strong lang="en">
                I&apos;m <mark className="marker">25 years old</mark>.
              </strong>
            </div>
            <div className={styles.bubbleAi}>
              <AssistantAvatar size={28} />
              <span className={styles.bubbleAiText} lang="en">
                Oh, so you&apos;re 25! What do you do?
              </span>
            </div>
            <p className={styles.sampleCaption}>
              {ASSISTANT_PERSONA.name}, a assistente de IA, mantém a conversa fluindo.
            </p>
          </article>
        </section>
      </main>

      <footer className={styles.footer}>
        <span>Projeto acadêmico — MVP em desenvolvimento</span>
        <Link to="/termos-e-privacidade">Termos e privacidade</Link>
      </footer>
    </div>
  );
}
