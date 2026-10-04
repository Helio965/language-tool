import type { MouseEvent } from 'react';
import { Link } from 'react-router';
import { Logo } from '../../components/Brand';
import styles from './Landing.module.css';
import { NOT_YET } from './landingContent';

type LinkProps = (id: string) => { href: string; onClick: (event: MouseEvent<HTMLAnchorElement>) => void };

/** Rodapé completo: sobre o projeto (com o que ainda não existe), produto, conta, informações e legal. */
export function LandingFooter({ linkProps }: { linkProps: LinkProps }) {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <section id="sobre" className={styles.footerAbout} aria-labelledby="sobre-title">
          <Logo />
          <h2 id="sobre-title" tabIndex={-1}>
            Sobre o projeto
          </h2>
          <p>
            O English AI é uma plataforma de aprendizado de inglês com inteligência artificial, desenvolvida como projeto
            acadêmico. Esta é a primeira versão (MVP): aulas, exercícios, conversação com IA, revisão e progresso.
          </p>
          <p>Ainda não fazem parte do produto: {NOT_YET.join(', ')}.</p>
        </section>

        <nav className={styles.footerNav} aria-label="Rodapé">
          <div>
            <h2>Produto</h2>
            <ul>
              <li>
                <a {...linkProps('aprender')}>Aprender</a>
              </li>
              <li>
                <a {...linkProps('conversar')}>Conversar</a>
              </li>
              <li>
                <a {...linkProps('ia')}>Inteligência artificial</a>
              </li>
              <li>
                <a {...linkProps('progresso')}>Progresso</a>
              </li>
            </ul>
          </div>
          <div>
            <h2>Conta</h2>
            <ul>
              <li>
                <Link to="/entrar">Entrar</Link>
              </li>
              <li>
                <Link to="/cadastro">Criar conta</Link>
              </li>
              <li>
                <Link to="/recuperar-senha">Recuperar senha</Link>
              </li>
            </ul>
          </div>
          <div>
            <h2>Informações</h2>
            <ul>
              <li>
                <a {...linkProps('como-funciona')}>Como funciona</a>
              </li>
              <li>
                <a {...linkProps('seguranca')}>Privacidade e segurança</a>
              </li>
              <li>
                <a {...linkProps('sobre')}>Sobre o projeto</a>
              </li>
            </ul>
          </div>
          <div>
            <h2>Legal</h2>
            <ul>
              <li>
                <Link to="/termos-e-privacidade">Termos de uso</Link>
              </li>
              <li>
                <Link to="/termos-e-privacidade">Política de privacidade</Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>
      <p className={styles.footerBottom}>English AI · Projeto acadêmico — MVP em desenvolvimento.</p>
    </footer>
  );
}
