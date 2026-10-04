import { useEffect } from 'react';

/** Título da aba do navegador — também anunciado por leitores de tela ao navegar. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} · English AI`;
  }, [title]);
}
