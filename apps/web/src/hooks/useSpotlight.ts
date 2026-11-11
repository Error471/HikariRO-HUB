import { useEffect } from 'react';

/**
 * Reflejo que sigue al cursor sobre las superficies (`.surface`): guarda la posición del puntero
 * en --mx/--my del elemento. Un único listener delegado; no hace nada en pantallas táctiles.
 */
export function useSpotlight() {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let current: HTMLElement | null = null;
    let frame = 0;

    const clear = () => {
      current?.style.removeProperty('--mx');
      current?.style.removeProperty('--my');
      current = null;
    };

    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const target = event.target instanceof Element ? event.target.closest('.surface') : null;
        if (target !== current) clear();
        if (!(target instanceof HTMLElement)) return;
        current = target;
        const box = target.getBoundingClientRect();
        target.style.setProperty('--mx', `${event.clientX - box.left}px`);
        target.style.setProperty('--my', `${event.clientY - box.top}px`);
      });
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', clear);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', clear);
      clear();
    };
  }, []);
}
