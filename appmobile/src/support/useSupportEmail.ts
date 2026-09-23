import { useCallback, useEffect, useState } from 'react';
import { getSupportEmail } from '../api/client';

export function useSupportEmail() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setEmail(await getSupportEmail(setEmail));
    } catch {
      setEmail(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  return { email, loading, reload };
}
