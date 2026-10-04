import { SearchInput } from '@/components/ui/SearchInput';
import { useSearchRoute } from '@/hooks/useSearchRoute';

interface WikiSearchBoxProps {
  initialQuery?: string;
  autoFocus?: boolean;
  className?: string;
}

/** Búsqueda en la wiki: al escribir lleva a /wiki/buscar?q=…; al borrarla vuelve a la portada. */
export function WikiSearchBox({ initialQuery = '', autoFocus, className }: WikiSearchBoxProps) {
  const [value, setValue] = useSearchRoute({ to: '/wiki/buscar', initialQuery, fallback: '/wiki' });

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
