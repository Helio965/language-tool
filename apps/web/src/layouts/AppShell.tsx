import { BarChart3, BookOpen, Home, MessagesSquare, MonitorSmartphone, UserRound } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation, useMatches } from 'react-router';
import { Logo } from '../components/Brand';
import { LevelBadge } from '../components/Display';
import { useAccount, useSession } from '../app/session';
import { cx } from '../utils/cx';
import styles from './AppShell.module.css';

const NAV = [
  { to: '/inicio', label: 'Início', icon: Home },
  { to: '/aprender', label: 'Aprender', icon: BookOpen },
  { to: '/conversar', label: 'Conversar', icon: MessagesSquare },
  { to: '/progresso', label: 'Progresso', icon: BarChart3 },
  { to: '/perfil', label: 'Perfil', icon: UserRound },
] as const;

export interface RouteHandle {
  /** Telas imersivas (aula, chat, revisão) escondem a navegação inferior no celular. */
  immersive?: boolean;
  mode?: 'learn' | 'talk';
}

/**
 * Estrutura das telas autenticadas:
 * celular → barra inferior; tablet → trilho lateral; desktop → barra lateral com marca e nível.
 */
export function AppShell() {
  const account = useAccount();
  const { api } = useSession();
  const location = useLocation();
  const matches = useMatches();
  const handle = (matches.at(-1)?.handle ?? {}) as RouteHandle;
  const mainRef = useRef<HTMLElement>(null);

  // Ao trocar de tela, leva o foco ao título (leitores de tela anunciam a nova página).
  useEffect(() => {
    const title = mainRef.current?.querySelector<HTMLElement>('[data-page-title]');
    title?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className={cx(styles.shell, handle.immersive && styles.immersive)} data-mode={handle.mode}>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <aside className={styles.sidebar}>
        <NavLink to="/inicio" className={styles.brand} aria-label="English AI — Início">
          <Logo />
        </NavLink>
        <nav aria-label="Navegação principal" className={styles.sideNav}>
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cx(styles.sideLink, isActive && styles.active)}>
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.sideFooter}>
          <LevelBadge level={account.profile.estimatedLevel} />
          {api.mode === 'demo' ? (
            <p className={styles.demoNotice}>
              <MonitorSmartphone aria-hidden="true" />
              <span>
                <strong>Modo demonstração</strong> Seus dados ficam salvos só neste navegador.
              </span>
            </p>
          ) : (
            <p className={styles.sideNote}>Projeto acadêmico — MVP</p>
          )}
        </div>
      </aside>

      <main id="conteudo" ref={mainRef} className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>

      <nav aria-label="Navegação principal" className={styles.bottomNav}>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => cx(styles.bottomLink, isActive && styles.active)}>
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
