import { useCallback, useEffect, type MouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Navegação pelas seções da página pública (âncoras #como-funciona, #aprender…).
 * - Rolagem suave só quando a pessoa não pediu movimento reduzido.
 * - O foco vai para o título da seção: quem usa teclado ou leitor de tela continua dali.
 * - O endereço ganha a âncora (sem nova entrada no histórico), então dá para compartilhar o link.
 */
export function useSectionNavigation() {
  const navigate = useNavigate();
  const { hash } = useLocation();

  const goTo = useCallback(
    (id: string, options: { smooth?: boolean } = {}) => {
      const section = document.getElementById(id);
      if (!section) return;
      section.scrollIntoView?.({ behavior: options.smooth !== false && !prefersReducedMotion() ? 'smooth' : 'auto', block: 'start' });
      section.querySelector<HTMLElement>('h1, h2')?.focus({ preventScroll: true });
      navigate({ hash: id === 'inicio' ? '' : `#${id}` }, { replace: true, preventScrollReset: true });
    },
    [navigate],
  );

  // Chegando por um link com âncora (ex.: /#seguranca): vai direto à seção, sem animação.
  useEffect(() => {
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    if (id) goTo(id, { smooth: false });
    // Só na chegada à página; depois, cada clique chama goTo.
  }, []);

  /** Props para um link de âncora: funciona sem JavaScript (href) e com rolagem acessível. */
  const linkProps = useCallback(
    (id: string, onNavigate?: () => void) => ({
      href: `#${id}`,
      onClick: (event: MouseEvent<HTMLAnchorElement>) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onNavigate?.();
        goTo(id);
      },
    }),
    [goTo],
  );

  return { goTo, linkProps };
}
