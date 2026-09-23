import { useRouter } from 'expo-router';
import { CloudCheck, CloudOff, RefreshCw, TriangleAlert } from 'lucide-react-native';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';

import { getAttachmentSyncHistory, getPaymentSyncHistory, getSyncHistory, runSyncCycle } from '../api/client';
import { getConnectivity, isApiKnownOffline, subscribeConnectivity, type ConnectivityState } from './connectivity';
import { useAppTheme } from '../theme';
import { AppText } from '../components/AppText';

type SyncOverview = { pending: number; problems: number; connection: 'checking' | 'online' | 'offline' | 'error'; offlineReason: 'device' | 'server' | null };
const SyncContext = createContext<SyncOverview>({ pending: 0, problems: 0, connection: 'checking', offlineReason: null });

function offlineReason(state: ConnectivityState): SyncOverview['offlineReason'] {
  return state.connected === false || state.internetReachable === false && state.apiReachable !== true ? 'device' : 'server';
}

export function SyncOverviewProvider({ children }: PropsWithChildren) {
  const [overview, setOverview] = useState<SyncOverview>({ pending: 0, problems: 0, connection: 'checking', offlineReason: null });

  useEffect(() => {
    let active = true;
    async function updateCounts(connection?: SyncOverview['connection']) {
      try {
        const [operations, payments, attachments] = await Promise.all([
          getSyncHistory(), getPaymentSyncHistory(), getAttachmentSyncHistory(),
        ]);
        if (active) setOverview((current) => ({
          pending: operations.filter((entry) => entry.status === 'pending').length +
            payments.filter((entry) => entry.status === 'pending').length +
            attachments.filter((entry) => entry.status === 'pending').length,
          problems: operations.filter((entry) => ['conflict', 'rejected', 'blocked'].includes(entry.status)).length +
            payments.filter((entry) => entry.status === 'rejected').length +
            attachments.filter((entry) => entry.status === 'rejected').length,
          connection: isApiKnownOffline() ? 'offline' : connection ?? current.connection,
          offlineReason: isApiKnownOffline() ? offlineReason(getConnectivity()) : connection ? null : current.offlineReason,
        }));
      } catch { if (active) setOverview((current) => ({ ...current, connection: 'error' })); }
    }
    const run = async () => {
      let connection: SyncOverview['connection'] = 'online';
      try { await runSyncCycle(); }
      catch (error) { connection = error instanceof Error && /connexion|inaccessible|network/i.test(error.message) ? 'offline' : 'error'; }
      await updateCounts(connection);
    };
    let wasDeviceOffline = false;
    const stopStatus = subscribeConnectivity((state) => {
      const deviceOffline = state.connected === false || state.internetReachable === false && state.apiReachable !== true;
      if (deviceOffline || state.apiReachable === false) void updateCounts('offline');
      else if (state.apiReachable === true) void updateCounts('online');
      if (wasDeviceOffline && !deviceOffline) void run();
      wasDeviceOffline = deviceOffline;
    });
    void run();
    const syncTimer = setInterval(() => void run(), 30_000);
    const countTimer = setInterval(() => void updateCounts(), 5_000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void run(); });
    return () => { active = false; clearInterval(syncTimer); clearInterval(countTimer); listener.remove(); stopStatus(); };
  }, []);

  return <SyncContext.Provider value={overview}>{children}</SyncContext.Provider>;
}

export function useSyncOverview() { return useContext(SyncContext); }

export function syncBadge(overview: SyncOverview): number | '!' | undefined {
  if (overview.problems) return Math.min(99, overview.problems);
  if (overview.pending) return Math.min(99, overview.pending);
  if (overview.connection === 'offline' || overview.connection === 'error') return '!';
  return undefined;
}

export function SyncStatusButton() {
  const router = useRouter(); const theme = useAppTheme(); const overview = useSyncOverview();
  const Icon = overview.problems || overview.connection === 'error' ? TriangleAlert : overview.connection === 'offline' ? CloudOff : overview.pending || overview.connection === 'checking' ? RefreshCw : CloudCheck;
  const color = overview.problems || overview.connection === 'error' ? theme.colors.secondary : overview.connection === 'offline' ? theme.colors.warning : theme.colors.primary;
  const label = overview.problems ? `${overview.problems} opération${overview.problems > 1 ? 's' : ''} à examiner` :
    overview.connection === 'offline' ? `${overview.pending} en attente, ${overview.offlineReason === 'device' ? 'sans connexion Internet' : 'serveur indisponible'}` :
      overview.connection === 'error' ? `Synchronisation interrompue${overview.pending ? `, ${overview.pending} en attente` : ''}` :
        overview.pending ? `${overview.pending} en attente de synchronisation` :
          overview.connection === 'checking' ? 'Vérification de la synchronisation' : 'Synchronisation à jour';
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={() => router.push('/atelier/plus/synchronisation')} style={[styles.button, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
    <Icon color={color} size={21} />
    {overview.pending + overview.problems > 0 ? <View style={[styles.count, { backgroundColor: overview.problems ? theme.colors.secondary : theme.colors.primary }]}><AppText color="#fff" style={styles.countText}>{Math.min(99, overview.pending + overview.problems)}</AppText></View> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', borderRadius: 8, borderWidth: 1, height: 42, justifyContent: 'center', width: 42 },
  count: { alignItems: 'center', borderRadius: 9, height: 17, justifyContent: 'center', minWidth: 17, paddingHorizontal: 2, position: 'absolute', right: -5, top: -5 },
  countText: { fontFamily: 'Inter_700Bold', fontSize: 10, lineHeight: 13 },
});
