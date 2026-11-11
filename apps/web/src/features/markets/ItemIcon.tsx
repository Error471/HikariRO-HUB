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
      className={cn('well grid shrink-0 place-items-center rounded-xl', className ?? 'size-11')}
    >
      {failed ? (
        <Package aria-hidden="true" className="size-4 text-ink-faint" />
      ) : (
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          width={24}
          height={24}
          onError={() => setFailed(true)}
          className="size-6 object-contain [image-rendering:pixelated]"
        />
      )}
    </span>
  );
}
