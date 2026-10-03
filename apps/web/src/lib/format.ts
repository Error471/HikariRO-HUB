const dateTime = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const longDate = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const relative = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

const timeOnly = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Hora sola si es hoy (respecto a `reference`); si no, día/mes y hora. */
export function formatEpoch(epochSeconds: number, reference = new Date()): string {
  const date = new Date(epochSeconds * 1000);
  return sameDay(date, reference) ? timeOnly.format(date) : dateTime.format(date);
}

/** Rango compacto: "18:04 – 18:14" o "3/10, 23:50 – 4/10, 00:20". */
export function formatEpochRange(startSeconds: number, endSeconds: number): string {
  const start = new Date(startSeconds * 1000);
  const end = new Date(endSeconds * 1000);
  return `${formatEpoch(startSeconds)} – ${sameDay(start, end) ? timeOnly.format(end) : formatEpoch(endSeconds)}`;
}

export function formatLongDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : longDate.format(date);
}

export function formatRelative(iso: string, now = Date.now()): string {
  const diffSeconds = (new Date(iso).getTime() - now) / 1000;
  if (Number.isNaN(diffSeconds)) return '';
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(diffSeconds) >= size) return relative.format(Math.round(diffSeconds / size), unit);
  }
  return 'ahora mismo';
}

const zeny = new Intl.NumberFormat('es-ES', { useGrouping: 'always' });

/** 10000000 → "10.000.000 z" (también agrupa números de 4 cifras). */
export function formatZeny(value: number): string {
  return `${zeny.format(value)} z`;
}

export function formatCount(value: number): string {
  return zeny.format(value);
}
