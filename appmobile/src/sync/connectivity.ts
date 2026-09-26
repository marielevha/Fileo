import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

export type ConnectivityState = {
  connected: boolean | null;
  internetReachable: boolean | null;
  apiReachable: boolean | null;
};

let state: ConnectivityState = { connected: null, internetReachable: null, apiReachable: null };
const listeners = new Set<(value: ConnectivityState) => void>();
let probeInFlight: Promise<boolean> | null = null;

function publish(next: ConnectivityState) {
  if (next.connected === state.connected && next.internetReachable === state.internetReachable && next.apiReachable === state.apiReachable) return;
  state = next;
  for (const listener of listeners) listener(state);
}

export function getConnectivity(): ConnectivityState { return state; }

export function isApiKnownOffline(): boolean {
  return state.connected === false || state.apiReachable === false ||
    (state.internetReachable === false && state.apiReachable !== true);
}

export function subscribeConnectivity(listener: (value: ConnectivityState) => void) {
  listeners.add(listener);
  listener(state);
  return () => { listeners.delete(listener); };
}

export function markApiReachable(reachable: boolean) {
  publish({ ...state, apiReachable: reachable });
}

function updateDevice(next: NetInfoState) {
  const connected = next.isConnected;
  const internetReachable = next.isInternetReachable;
  const changed = connected !== state.connected || internetReachable !== state.internetReachable;
  publish({
    connected,
    internetReachable,
    apiReachable: connected === false ? false : changed ? null : state.apiReachable,
  });
}

export function startConnectivityMonitor() {
  return NetInfo.addEventListener(updateDevice);
}

export async function refreshConnectivity() {
  try { updateDevice(await NetInfo.refresh()); }
  catch { /* The API probe remains the source of truth when the OS status is unavailable. */ }
}

export function probeApi(baseUrl: string): Promise<boolean> {
  if (probeInFlight) return probeInFlight;
  if (state.connected === false) {
    markApiReachable(false);
    return Promise.resolve(false);
  }
  probeInFlight = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    try {
      const response = await fetch(`${baseUrl}/health`, { signal: controller.signal });
      markApiReachable(response.ok);
      return response.ok;
    } catch {
      markApiReachable(false);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  })();
  return probeInFlight.finally(() => { probeInFlight = null; });
}
