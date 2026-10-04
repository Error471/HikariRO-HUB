import { SearchInput } from '@/components/ui/SearchInput';
import { useSearchRoute } from '@/hooks/useSearchRoute';

interface MarketSearchBoxProps {
  initialQuery?: string;
  autoFocus?: boolean;
  className?: string;
}

/** Búsqueda unificada: al escribir lleva a /mercados/buscar?q=…; al borrarla vuelve a donde estabas. */
export function MarketSearchBox({ initialQuery = '', autoFocus, className }: MarketSearchBoxProps) {
  const [value, setValue] = useSearchRoute({ to: '/mercados/buscar', initialQuery });

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
