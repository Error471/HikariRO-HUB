/** Solo se abren fuera de la app los enlaces web normales (nada de file:, javascript:, etc.). */
export function isExternalWebUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

/** ¿La URL pertenece a la propia app (servidor local)? */
export function isAppUrl(url: string, appOrigin: string): boolean {
  try {
    return new URL(url).origin === appOrigin;
  } catch {
    return false;
  }
}

/** Ruta interna segura para abrir desde una notificación (evita salir de la app). */
export function appRoute(path: string): string {
  return path.startsWith('/') && !path.startsWith('//') ? path : '/';
}
