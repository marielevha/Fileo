import { useCallback, useEffect, useState } from 'react';
import { getPublicConfig, getSupportEmail, type PublicConfig } from '../api/client';

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

export function usePublicConfig() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setConfig(await getPublicConfig(setConfig));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  return { config, loading, reload };
}
