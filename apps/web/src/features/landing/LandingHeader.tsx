import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Logo } from '../../components/Brand';
import { Button } from '../../components/Button';
import { cx } from '../../utils/cx';
import styles from './Landing.module.css';
import { SECTIONS } from './landingContent';

type LinkProps = (id: string, onNavigate?: () => void) => { href: string; onClick: (event: MouseEvent<HTMLAnchorElement>) => void };

/**
 * Cabeçalho fixo da página pública. Telas largas: navegação completa + Entrar/Criar conta.
 * Telas menores: botão "Menu" (aria-expanded) que abre as seções; Esc fecha e devolve o foco ao botão.
 */
export function LandingHeader({ linkProps }: { linkProps: LinkProps }) {
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      menuButton.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <a {...linkProps('inicio', close)} className={styles.brand} aria-label="English AI — início da página">
          <Logo />
        </a>

        <nav id="landing-sections" aria-label="Seções da página" className={cx(styles.nav, open && styles.navOpen)}>
          <ul className={styles.navList}>
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a {...linkProps(section.id, close)} className={styles.navLink}>
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
          <div className={styles.navAccount}>
            <Button to="/cadastro" block onClick={close}>
              Criar conta
            </Button>
          </div>
        </nav>

        <div className={styles.headerActions}>
          <Button to="/entrar" variant="ghost" size="sm">
            Entrar
          </Button>
          <Button to="/cadastro" size="sm" className={styles.headerSignup}>
            Criar conta
          </Button>
          <button
            ref={menuButton}
            type="button"
            className={styles.menuButton}
            aria-label="Menu de seções"
            aria-expanded={open}
            aria-controls="landing-sections"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
