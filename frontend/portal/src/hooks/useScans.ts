import { useCallback, useEffect, useState } from 'react';
import type { ScanRecord } from '../types/portal';

export function useScans(enabled = true, onForbidden?: () => void) {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!enabled) { setScans([]); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/scan`, { credentials: 'include' });
      if (response.status === 403) onForbidden?.();
      if (!response.ok) throw new Error('Scans could not be loaded.');
      const data = await response.json();
      setScans(Array.isArray(data) ? data : []);
    } catch (caught) {
      setScans([]);
      setError(caught instanceof Error ? caught.message : 'Scans could not be loaded.');
    } finally { setLoading(false); }
  }, [enabled, onForbidden]);

  useEffect(() => { void refresh(); }, [refresh]);
  return { scans, setScans, loading, error, refresh };
}
