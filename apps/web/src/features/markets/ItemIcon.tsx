import { Package } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/cn';

export function ItemIcon({
  src,
  name,
  className,
}: {
  src: string;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-lg bg-night-950/70 ring-1 ring-white/8',
        className ?? 'size-11',
      )}
    >
      {failed ? (
        <Package aria-hidden="true" className="size-4 text-ink-faint" />
      ) : (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="size-6 object-contain [image-rendering:pixelated]"
        />
      )}
    </span>
  );
}
