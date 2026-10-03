import { useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { SearchInput } from '@/components/ui/SearchInput';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface WikiSearchBoxProps {
  initialQuery?: string;
  autoFocus?: boolean;
  className?: string;
}

/** Búsqueda en la wiki: al escribir lleva a /wiki/buscar?q=… (con debounce). */
export function WikiSearchBox({ initialQuery = '', autoFocus, className }: WikiSearchBoxProps) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initialQuery);
  const debounced = useDebouncedValue(value.trim(), 350);
  const lastSent = useRef(initialQuery.trim());

  useEffect(() => {
    if (debounced === lastSent.current || (debounced.length > 0 && debounced.length < 2)) return;
    lastSent.current = debounced;
    void navigate({ to: '/wiki/buscar', search: { q: debounced }, replace: initialQuery !== '' });
  }, [debounced, navigate, initialQuery]);

  return (
    <SearchInput
      label="Buscar en la wiki"
      placeholder="Buscar guías, sistemas, instancias…"
      value={value}
      autoFocus={autoFocus}
      onChange={(event) => setValue(event.target.value)}
      className={className}
    />
  );
}
