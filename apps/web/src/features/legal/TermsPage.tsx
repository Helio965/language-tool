import { Link } from 'react-router';
import { Logo } from '../../components/Brand';
import { Card } from '../../components/Display';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import styles from '../settings/Settings.module.css';
import { DataPolicy } from './DataPolicy';

/** Termos de uso e privacidade (público) — aceite exigido no cadastro. */
export function TermsPage() {
  useDocumentTitle('Termos e privacidade');
  return (
    <div className={`${styles.publicPage} reveal`}>
      <header className={styles.publicTop}>
        <Link to="/" aria-label="English AI — página inicial">
          <Logo />
        </Link>
      </header>
      <main id="conteudo" className={styles.stack}>
        <h1 data-page-title tabIndex={-1}>
          Termos de uso e privacidade
        </h1>
        <Card>
          <h2 className={styles.title}>Sobre o English AI</h2>
          <ul className={styles.list}>
            <li>Projeto acadêmico — MVP em desenvolvimento, oferecido para estudo e validação.</li>
            <li>O nível exibido é uma estimativa pedagógica, não uma certificação oficial de proficiência.</li>
            <li>A assistente de IA pode cometer erros. Use as explicações como apoio, não como verdade absoluta.</li>
            <li>Use a plataforma com respeito: conteúdo ofensivo ou ilegal não é permitido.</li>
          </ul>
        </Card>
        <Card>
          <h2 className={styles.title}>Privacidade</h2>
          <DataPolicy />
        </Card>
        <p className="muted">Texto informativo do protótipo. Uma versão definitiva deve ser revisada juridicamente antes de uso em produção.</p>
      </main>
    </div>
  );
}
