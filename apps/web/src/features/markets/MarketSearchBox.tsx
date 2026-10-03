import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { SearchInput } from '@/components/ui/SearchInput';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface MarketSearchBoxProps {
  initialQuery?: string;
  autoFocus?: boolean;
  className?: string;
}

/** Búsqueda unificada: al escribir lleva a /mercados/buscar?q=… (con debounce). */
export function MarketSearchBox({ initialQuery = '', autoFocus, className }: MarketSearchBoxProps) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initialQuery);
  const debounced = useDebouncedValue(value.trim(), 350);
  const lastSent = useRef(initialQuery.trim());

  useEffect(() => {
    if (debounced === lastSent.current || (debounced.length > 0 && debounced.length < 2)) return;
    lastSent.current = debounced;
    void navigate({
      to: '/mercados/buscar',
      search: { q: debounced },
      replace: initialQuery !== '',
    });
  }, [debounced, navigate, initialQuery]);

  return (
    <SearchInput
      label="Buscar item en todos los mercados"
      placeholder="Buscar un objeto en los mercados…"
      value={value}
      autoFocus={autoFocus}
      onChange={(event) => setValue(event.target.value)}
      className={className}
    />
  );
}
