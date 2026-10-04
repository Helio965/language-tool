import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Logo } from '../components/Brand';
import styles from './AuthLayout.module.css';

/** Telas de entrada: papel pontilhado; no desktop, painel de marca com um exemplo de correção. */
export function AuthLayout({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className={styles.layout}>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <aside className={styles.brandPanel} aria-hidden="true">
        <Logo inverse size={40} />
        <div className={styles.brandBody}>{aside ?? <DefaultAside />}</div>
        <p className={styles.brandFoot}>Projeto acadêmico — MVP em desenvolvimento</p>
      </aside>
      <main id="conteudo" className={`${styles.main} dotted-paper`}>
        <div className={styles.mobileLogo}>
          <Link to="/" aria-label="English AI — página inicial">
            <Logo />
          </Link>
        </div>
        <div className={`${styles.content} reveal`}>{children}</div>
      </main>
    </div>
  );
}

function DefaultAside() {
  return (
    <>
      <p className={styles.quote}>
        Errar faz parte.
        <br />
        <span className={styles.quoteAccent}>A gente explica o porquê.</span>
      </p>
      <div className={styles.sample}>
        <span className={styles.sampleLabel}>Sua frase</span>
        <p className={styles.sampleOriginal}>
          She <s>go</s> to school every day.
        </p>
        <span className={styles.sampleLabel}>Forma recomendada</span>
        <p className={styles.sampleSuggestion}>
          She <mark className="marker">goes</mark> to school every day.
        </p>
        <p className={styles.sampleWhy}>Com he, she e it, normalmente adicionamos -s ao verbo no presente simples.</p>
      </div>
    </>
  );
}
