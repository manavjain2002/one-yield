import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, isApiConfigured } from '@/lib/api';

const DEBOUNCE_MS = 350;

type IdentityAvailability = { nameUnique: boolean; symbolUnique: boolean };

/**
 * Debounced backend check that pool name/symbol are not already used (pools + drafts).
 * Same behavior as inline use in BorrowerPools: no fetch until borrower role + API + non-empty debounced field.
 */
export function usePoolIdentityAvailability(name: string, symbol: string, role: string | undefined) {
  const normalizedName = name.trim().toUpperCase();
  const normalizedSymbol = symbol.trim().toUpperCase();
  const [debouncedName, setDebouncedName] = useState('');
  const [debouncedSymbol, setDebouncedSymbol] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedName(normalizedName);
      setDebouncedSymbol(normalizedSymbol);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [normalizedName, normalizedSymbol]);

  const { data: identityAvailability, isFetching: isCheckingIdentity } = useQuery({
    queryKey: ['pools', 'identity-availability', debouncedName, debouncedSymbol],
    enabled: isApiConfigured() && role === 'borrower' && (!!debouncedName || !!debouncedSymbol),
    queryFn: async () => {
      const { data } = await api.get<IdentityAvailability>('/pools/identity-availability', {
        params: {
          name: debouncedName || undefined,
          symbol: debouncedSymbol || undefined,
        },
      });
      return data;
    },
  });

  const nameUnique = normalizedName ? identityAvailability?.nameUnique !== false : true;
  const symbolUnique = normalizedSymbol ? identityAvailability?.symbolUnique !== false : true;

  return {
    normalizedName,
    normalizedSymbol,
    isCheckingIdentity,
    nameUnique,
    symbolUnique,
    hasIdentityConflict: !nameUnique || !symbolUnique,
  };
}
