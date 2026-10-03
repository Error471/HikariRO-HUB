import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, type MouseEvent } from 'react';

function scrollToAnchor(container: HTMLElement, hash: string) {
  const id = decodeURIComponent(hash.replace(/^#/, ''));
  if (!id) return;
  const target = container.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Renderiza el HTML de la wiki. La API ya lo ha saneado con una lista blanca estricta
 * (y la CSP bloquea scripts); aquí solo se interceptan los enlaces internos para
 * navegar sin recargar la app.
 */
export function WikiContent({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const hash = useRouterState({ select: (state) => state.location.hash });

  useEffect(() => {
    if (ref.current && hash) scrollToAnchor(ref.current, hash);
  }, [html, hash]);

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor || !ref.current) return;
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }
    const href = anchor.getAttribute('href') ?? '';
    if (href.startsWith('#')) {
      event.preventDefault();
      scrollToAnchor(ref.current, href);
      history.replaceState(null, '', href);
      return;
    }
    if (anchor.dataset.wiki) {
      event.preventDefault();
      void navigate({ href });
    }
  };

  return (
    // Delegación de clics: los enlaces siguen siendo <a> navegables con teclado.
    <div
      ref={ref}
      className="wiki-content"
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
