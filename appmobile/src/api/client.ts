import Constants from 'expo-constants';
import { File as ExpoFile } from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';
import { Platform } from 'react-native';

import { clearAuthSession, getAuthSession, saveAuthSession } from '../auth/session';
import { isApiKnownOffline, markApiReachable, probeApi, refreshConnectivity } from '../sync/connectivity';
import type {
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  RegisterRequest,
  RegisterResponse,
} from '../types/auth';
import type { AgendaFilter, AgendaPage, BootstrapResponse } from '../types/dashboard';
import type { ArticleTemplate } from '../types/dashboard';
import type { Client, ClientInput, ClientPage, ClientSort, Measurement, MeasurementInput, SortDirection } from '../types/clients';
import type {
  ClientOption,
  CreateOrderRequest,
  ItemStatus,
  OrderDetail,
  OrderFilter,
  OrderPage,
  OrderSummary,
} from '../types/orders';
import type { PlanningAssigneeFilter, PlanningResponse, PlanningStatusFilter } from '../types/planning';
import type { SubscriptionOverview, TeamPage, WorkshopDetails } from '../types/more';
import type { AttachmentDraft } from '../components/AttachmentPicker';
import { applyReceipts, attachmentEntries, cacheClients, cacheOrders, cachePlanning, cachedClient, cachedClients, cachedOrders, cachedPlanning, cachedResponse, hasCachedClients, hasCachedOrders, nextPendingBatch, outboxEntries, paymentEntries, queueAttachment, queueClientOperation, queueItemOperation, queueMeasurement, queueOrderCreate, queueOrderOperation, queuePayment, saveResponse, settleAttachment, settlePayment, type PaymentDraft, type SyncReceipt } from '../offline/store';

type ApiSuccess<T> = { ok: true; data: T };
type ApiFailure = { ok: false; error: { code: string; message: string } };

export class ApiError extends Error {
  constructor(message: string, public code: string, public status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

function developmentApiUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3000/api/mobile/v1`;
  }
  const host = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
  return `http://${host}:3000/api/mobile/v1`;
}

export function getApiBaseUrl(): string {
  return (process.env.EXPO_PUBLIC_FILEO_API_URL || developmentApiUrl()).replace(/\/$/, '');
}

async function fetchApi(path: string, init: RequestInit, token?: string): Promise<Response> {
  if (isApiKnownOffline()) throw new ApiError('Serveur inaccessible. Vérifiez votre connexion.', 'network_error', 0);
  const headers = new Headers(init.headers);
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);
  const controller = new AbortController();
  const timeoutMs = !init.method || init.method === 'GET' ? 5_000 :
    path === '/sync' ? 30_000 : path.includes('/attachments') ? 45_000 : 12_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers, signal: controller.signal });
    markApiReachable(true);
    return response;
  } catch {
    markApiReachable(false);
    throw new ApiError('Serveur inaccessible. Vérifiez votre connexion.', 'network_error', 0);
  } finally {
    clearTimeout(timeout);
  }
}

async function readPayload<T>(response: Response): Promise<ApiSuccess<T> | ApiFailure | null> {
  return response.json().catch(() => null) as Promise<ApiSuccess<T> | ApiFailure | null>;
}

function responseError(response: Response, payload: ApiSuccess<unknown> | ApiFailure | null) {
  const failure = payload && !payload.ok ? payload.error : null;
  const fallback = response.status === 413
    ? 'Le fichier est trop volumineux pour être envoyé.'
    : 'Une erreur inattendue est survenue.';
  return new ApiError(
    failure?.message ?? fallback,
    failure?.code ?? 'unexpected_error',
    response.status,
  );
}

let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const current = await getAuthSession();
    if (!current?.refreshToken) {
      throw new ApiError('Votre session a expiré. Reconnectez-vous.', 'session_expired', 401);
    }

    const response = await fetchApi('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    const payload = await readPayload<RefreshResponse>(response);
    if (!response.ok || !payload?.ok) {
      await clearAuthSession();
      throw new ApiError('Votre session a expiré. Reconnectez-vous.', 'session_expired', 401);
    }

    await saveAuthSession(payload.data, current.persist);
    return payload.data.token;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, options: { offlineFallback?: boolean } = {}): Promise<T> {
  const session = await getAuthSession();
  const cacheable = (!init.method || init.method === 'GET') && /^\/(bootstrap|clients|orders|planning|dashboard\/agenda|faq|more\/affiliation)(\/|\?|$)/.test(path);
  let response: Response;
  try {
    response = await fetchApi(path, init, session?.token);
  } catch (error) {
    if (cacheable && options.offlineFallback !== false && error instanceof ApiError && error.code === 'network_error') {
      const cached = await cachedResponse<T>(path).catch(() => null);
      if (cached !== null) return cached;
    }
    throw error;
  }

  if (response.status === 401 && !path.startsWith('/auth/')) {
    const token = await refreshAccessToken();
    response = await fetchApi(path, init, token);
  }

  const payload = await readPayload<T>(response);
  if (!response.ok || !payload?.ok) throw responseError(response, payload);
  if (cacheable) await saveResponse(path, payload.data).catch(() => undefined);
  return payload.data;
}

let syncInFlight: Promise<void> | null = null;
let lastClientHydration = 0;
let lastHydratedScope = '';
let cycleInFlight: Promise<void> | null = null;

export function syncNow(alreadyProbed = false): Promise<void> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    if (isApiKnownOffline() || !alreadyProbed && !(await probeApi(getApiBaseUrl()))) {
      throw new ApiError('Serveur inaccessible. Modifications conservées sur cet appareil.', 'network_error', 0);
    }
    for (;;) {
      const operations = await nextPendingBatch();
      if (!operations.length) break;
      const result = await apiRequest<{ receipts: SyncReceipt[] }>('/sync', {
        method: 'POST', body: JSON.stringify({ operations }),
      });
      await applyReceipts(result.receipts);
      if (!result.receipts.length) break;
    }
    for (const entry of await paymentEntries()) {
      if (entry.status !== 'pending') continue;
      const parent = (await outboxEntries()).find((item) => item.operation.entityKind === 'order' &&
        item.operation.action === 'create' && item.operation.entityId === entry.payload.orderId);
      if (parent && parent.status !== 'applied') continue;
      try {
        const result = await apiRequest<{ movementId: string }>('/payments/record', {
          method: 'POST', body: JSON.stringify({ ...entry.payload, idempotencyKey: entry.idempotencyKey }),
        });
        await settlePayment(entry.idempotencyKey, 'applied', result.movementId, null);
      } catch (error) {
        if (error instanceof ApiError && (error.code === 'network_error' || error.status >= 500 || error.status === 401)) throw error;
        await settlePayment(entry.idempotencyKey, 'rejected', null, error instanceof Error ? error.message : 'Encaissement refuse.');
      }
    }
    for (const entry of await attachmentEntries()) {
      if (entry.status !== 'pending') continue;
      const measurementId = entry.path.match(/\/measurements\/([0-9a-f-]+)\/attachments$/i)?.[1];
      const orderId = entry.path.match(/^\/orders\/([0-9a-f-]+)\/attachments$/i)?.[1];
      if (measurementId) {
        const parent = (await outboxEntries()).find((item) => item.operation.entityKind === 'measurement' && item.operation.entityId === measurementId);
        if (parent && parent.status !== 'applied') continue;
      }
      if (orderId) {
        const parent = (await outboxEntries()).find((item) => item.operation.entityKind === 'order' && item.operation.action === 'create' && item.operation.entityId === orderId);
        if (parent && parent.status !== 'applied') continue;
      }
      try {
        const localFile = new ExpoFile(entry.uri);
        if (!localFile.exists) {
          await settleAttachment(entry.id, 'rejected', 'Fichier local introuvable.');
          continue;
        }
        await apiRequest(entry.path, {
          method: 'POST',
          headers: { 'x-fileo-attachment-id': entry.id },
          body: JSON.stringify({ files: [{ name: entry.name, mimeType: entry.mimeType, dataBase64: await localFile.base64() }] }),
        });
        await settleAttachment(entry.id, 'applied', null);
      } catch (error) {
        if (error instanceof ApiError && (error.code === 'network_error' || error.status >= 500 || error.status === 401)) throw error;
        await settleAttachment(entry.id, 'rejected', error instanceof Error ? error.message : 'Envoi refuse.');
      }
    }
  })();
  return syncInFlight.finally(() => { syncInFlight = null; });
}

export async function getSyncHistory() { return outboxEntries(); }
export async function getPaymentSyncHistory() { return paymentEntries(); }
export async function getAttachmentSyncHistory() { return attachmentEntries(); }

export function runSyncCycle(): Promise<void> {
  if (cycleInFlight) return cycleInFlight;
  cycleInFlight = performSyncCycle();
  return cycleInFlight.finally(() => { cycleInFlight = null; });
}

async function performSyncCycle() {
  await refreshConnectivity();
  if (!(await probeApi(getApiBaseUrl()))) {
    throw new ApiError('Serveur inaccessible. Modifications conservées sur cet appareil.', 'network_error', 0);
  }
  await syncNow(true);
  const session = await getAuthSession();
  const currentScope = `${session?.userId ?? ''}:${session?.workshopId ?? ''}`;
  if (currentScope === lastHydratedScope && Date.now() - lastClientHydration < 5 * 60_000) return;
  for (let page = 1; page <= 200; page++) {
    const result = await apiRequest<ClientPage>(`/clients?page=${page}&pageSize=100&sort=name&direction=asc&includeArchived=true`, {}, { offlineFallback: false });
    await cacheClients(result.items);
    if (page >= result.pageCount) break;
  }
  for (let page = 1; page <= 200; page++) {
    const result = await apiRequest<OrderPage>(`/orders?page=${page}&pageSize=50`, {}, { offlineFallback: false });
    await cacheOrders(result.items);
    if (page >= result.pageCount) break;
  }
  await cachePlanning(await apiRequest<PlanningResponse>('/planning?status=all&assignee=all', {}, { offlineFallback: false }));
  await apiRequest<AffiliateOverview>('/more/affiliation', {}, { offlineFallback: false }).catch(() => undefined);
  lastClientHydration = Date.now();
  lastHydratedScope = currentScope;
}

async function sendQueuedMutation() {
  try { await syncNow(); }
  catch (error) { if (!(error instanceof ApiError) || !['network_error', 'internal_error', 'session_expired'].includes(error.code) && error.status < 500) throw error; }
}

export function login(payload: LoginRequest): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function register(payload: RegisterRequest): Promise<RegisterResponse> {
  return apiRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export type PasswordResetChallenge = { requested: true; phone: string; purpose: 'password_reset'; resendAfter: string };
export type PasswordResetVerification = { purpose: 'password_reset'; token: string; refreshToken: string; expiresAt: string };

export function requestPasswordReset(country: 'CG' | 'CD', phone: string): Promise<PasswordResetChallenge> {
  return apiRequest('/auth/password/forgot', { method: 'POST', body: JSON.stringify({ country, phone }) });
}

export function resendPasswordResetCode(country: 'CG' | 'CD', phone: string): Promise<PasswordResetChallenge> {
  return apiRequest('/auth/otp/request', { method: 'POST', body: JSON.stringify({ country, phone, purpose: 'password_reset' }) });
}

export function verifyPasswordResetCode(country: 'CG' | 'CD', phone: string, code: string): Promise<PasswordResetVerification> {
  return apiRequest('/auth/otp/verify', { method: 'POST', body: JSON.stringify({ country, phone, code, purpose: 'password_reset' }) });
}

export function resetPassword(accessToken: string, password: string): Promise<{ passwordReset: true }> {
  return apiRequest('/auth/password/reset', { method: 'POST', body: JSON.stringify({ accessToken, password }) });
}

export async function getBootstrap(onCached?: (cached: BootstrapResponse) => void): Promise<BootstrapResponse> {
  if (onCached) {
    const cached = await cachedResponse<BootstrapResponse>('/bootstrap').catch(() => null);
    if (cached) onCached(cached);
  }
  return apiRequest<BootstrapResponse>('/bootstrap');
}

export async function getDashboardAgenda(filter: AgendaFilter, page = 1, onCached?: (cached: AgendaPage) => void): Promise<AgendaPage> {
  const path = `/dashboard/agenda?filter=${filter}&page=${page}`;
  if (onCached) {
    const cached = await cachedResponse<AgendaPage>(path).catch(() => null);
    if (cached) onCached(cached);
  }
  return apiRequest<AgendaPage>(path);
}

export async function logout(): Promise<void> {
  try {
    await apiRequest('/auth/logout', { method: 'POST' });
  } finally {
    await clearAuthSession();
  }
}

export function updateProfile(fullName: string) {
  return apiRequest<{ id: string; fullName: string; phone: string }>('/more/profile', { method: 'PATCH', body: JSON.stringify({ fullName }) });
}

export function getWorkshopDetails() {
  return apiRequest<WorkshopDetails>('/more/workshop');
}

export function updateWorkshop(name: string, city: string, measurementUnits: string[]) {
  return apiRequest<{ name: string; city: string | null; measurementUnits: string[] }>('/more/workshop', { method: 'PATCH', body: JSON.stringify({ name, city, measurementUnits }) });
}

export type TemplateInput = {
  name: string;
  description?: string | null;
  defaultWorkType: 'creation' | 'retouche';
  active: boolean;
  sortOrder: number;
  fields: Array<{ label: string; unit: string; required?: boolean }>;
};

export function listTemplates() {
  return apiRequest<{ items: ArticleTemplate[] }>('/more/templates');
}

export function saveTemplate(input: TemplateInput, id?: string) {
  return apiRequest<{ id: string }>(id ? `/more/templates/${id}` : '/more/templates', {
    method: id ? 'PATCH' : 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteTemplate(id: string) {
  return apiRequest<{ deleted: true }>(`/more/templates/${id}`, { method: 'DELETE' });
}

export type AffiliateOverview = {
  profile: null | { id: string; code: string; display_name: string; status: string; created_at: string };
  attributions: Array<{ id: string; workshop_id: string; workshop_name?: string; attributed_at: string }>;
  commissions: Array<{ id: string; milestone: 'first_payment' | 'sixth_month'; amount: number; currency: string; status: 'pending' | 'paid' | 'cancelled'; due_at: string; paid_at: string | null; workshop_name?: string }>;
  totals: Array<{ currency: string; pending: number; paid: number }>;
  settings: {
    enabled: boolean;
    public_title: string;
    public_description: string;
    sixth_month_threshold_months: number;
  };
};

export async function getAffiliateOverview(onCached?: (cached: AffiliateOverview) => void) {
  if (onCached) {
    const cached = await cachedResponse<AffiliateOverview>('/more/affiliation').catch(() => null);
    if (cached) onCached(cached);
  }
  return apiRequest<AffiliateOverview>('/more/affiliation');
}

export async function joinAffiliateProgram(input: { code?: string; autoGenerate?: boolean } = {}) {
  if (isApiKnownOffline()) {
    throw new ApiError('Connexion requise pour creer le code.', 'offline_not_allowed', 0);
  }
  const result = await apiRequest<{ profile: NonNullable<AffiliateOverview['profile']>; overview: AffiliateOverview }>('/more/affiliation', { method: 'POST', body: JSON.stringify(input) });
  await saveResponse('/more/affiliation', result.overview).catch(() => undefined);
  return result;
}

export function getTeam(page = 1) {
  return apiRequest<TeamPage>(`/more/team?page=${page}`);
}

export function addTeamMember(input: { phone: string; role: 'owner' | 'collaborator'; canViewMoney: boolean }) {
  return apiRequest('/more/team', { method: 'POST', body: JSON.stringify(input) });
}

export function updateTeamMember(id: string, input: { role: 'owner' | 'collaborator'; status: 'active' | 'disabled'; canViewMoney: boolean }) {
  return apiRequest(`/more/team/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function getSubscription() {
  return apiRequest<SubscriptionOverview>('/more/subscription');
}

export type FaqResponse = { locale: 'fr' | 'en' | 'lg'; items: Array<{ id: string; question: string; answer: string }> };

export function getFaq(lang: 'fr' | 'en' | 'lg' = 'fr') {
  return apiRequest<FaqResponse>(`/faq?lang=${lang}`);
}

const PUBLIC_CONFIG_CACHE_KEY = 'fileo.public.config';

export type PublicConfig = {
  supportEmail: string;
  appVersion: string;
  companyName: string;
};

const DEFAULT_PUBLIC_CONFIG: PublicConfig = {
  supportEmail: 'support@fileo.app',
  appVersion: '1.0.0',
  companyName: 'Nzelobi',
};

function normalisePublicConfig(value: Partial<PublicConfig> | null | undefined): PublicConfig {
  return {
    supportEmail: value?.supportEmail?.trim() || DEFAULT_PUBLIC_CONFIG.supportEmail,
    appVersion: value?.appVersion?.trim() || DEFAULT_PUBLIC_CONFIG.appVersion,
    companyName: value?.companyName?.trim() || DEFAULT_PUBLIC_CONFIG.companyName,
  };
}

async function readCachedPublicConfig(): Promise<PublicConfig | null> {
  const cached = await Storage.getItem(PUBLIC_CONFIG_CACHE_KEY).catch(() => null);
  if (!cached) return null;
  try {
    return normalisePublicConfig(JSON.parse(cached) as Partial<PublicConfig>);
  } catch {
    return null;
  }
}

export async function getPublicConfig(onCached?: (config: PublicConfig) => void): Promise<PublicConfig> {
  const cached = await readCachedPublicConfig();
  if (cached) onCached?.(cached);
  try {
    const config = normalisePublicConfig(await apiRequest<PublicConfig>('/config/support'));
    await Storage.setItem(PUBLIC_CONFIG_CACHE_KEY, JSON.stringify(config)).catch(() => undefined);
    return config;
  } catch (error) {
    if (cached) return cached;
    return DEFAULT_PUBLIC_CONFIG;
  }
}

export async function getSupportEmail(onCached?: (email: string) => void): Promise<string> {
  return (await getPublicConfig((config) => onCached?.(config.supportEmail))).supportEmail;
}

export function declareSubscriptionPayment(input: { planId: string; channel: string; reference: string }) {
  return apiRequest<{ paymentId: string }>('/more/subscription', { method: 'POST', body: JSON.stringify(input) });
}

export async function listOrders(params: { page?: number; pageSize?: number; q?: string; filter?: OrderFilter } = {}, onCached?: (cached: OrderPage) => void): Promise<OrderPage> {
  if (onCached) {
    const cached = await hasCachedOrders().then((available) => available ? cachedOrders(params) : null).catch(() => null);
    if (cached) onCached(cached);
  }
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 1));
  query.set('pageSize', String(params.pageSize ?? 10));
  if (params.q?.trim()) query.set('q', params.q.trim());
  if (params.filter && params.filter !== 'all') query.set('filter', params.filter);
  try {
    const result = await apiRequest<OrderPage>(`/orders?${query.toString()}`, {}, { offlineFallback: false });
    await cacheOrders(result.items).catch(() => undefined);
    const history = await outboxEntries().catch(() => []);
    return history.some((entry) => entry.operation.entityKind !== 'client' && !['applied', 'superseded'].includes(entry.status))
      ? cachedOrders(params) : result;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'network_error') return cachedOrders(params);
    throw error;
  }
}

export type ReceivableOrder = { order: OrderSummary['order']; remainingDue: { amount: number; currency: string }; isLate: boolean };
export type ReceivableOrderPage = { items: ReceivableOrder[]; total: number; page: number; pageSize: number; pageCount: number };

export async function listReceivableOrders(params: { page?: number; q?: string } = {}): Promise<ReceivableOrderPage> {
  const page = params.page ?? 1;
  const pageSize = 20;
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), filter: 'a_encaisser' });
  if (params.q?.trim()) query.set('q', params.q.trim());
  try {
    return apiRequest<ReceivableOrderPage>(`/payments?${query}`);
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== 'network_error') throw error;
    const cached = await cachedOrders({ page: 1, pageSize: 100_000 });
    const term = params.q?.trim().toLocaleLowerCase('fr') ?? '';
    const rows = cached.items.filter((item) => !item.order.cancelled_at && (item.balance?.remainingDue.amount ?? 0) > 0 &&
      (!term || `${item.order.client_name} ${item.order.reference}`.toLocaleLowerCase('fr').includes(term)))
      .map((item) => ({ order: item.order, remainingDue: item.balance!.remainingDue, isLate: item.isLate }));
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
    const selectedPage = Math.min(page, pageCount);
    return { items: rows.slice((selectedPage - 1) * pageSize, selectedPage * pageSize), total: rows.length,
      page: selectedPage, pageSize, pageCount };
  }
}

export async function getOrder(id: string): Promise<OrderDetail> {
  const history = await outboxEntries().catch(() => []);
  const local = await cachedResponse<OrderDetail>(`/orders/${id}`).catch(() => null);
  if (local && history.some((entry) => !['applied', 'superseded'].includes(entry.status) &&
    (entry.operation.entityId === id || entry.operation.entityKind === 'order_item' && entry.operation.payload.orderId === id))) return local;
  return apiRequest<OrderDetail>(`/orders/${id}`);
}

export async function createOrder(payload: CreateOrderRequest): Promise<{ orderId: string; reference: string; order: OrderSummary; queued: boolean; issue?: string }> {
  let clientId = payload.clientId;
  if (!clientId && payload.client) {
    clientId = await queueClientOperation('create', null, { displayName: payload.client.displayName, phone: payload.client.phone ?? null,
      otherContact: null, guardianName: null, guardianPhone: null, notes: null });
  }
  if (!clientId) throw new ApiError('Client obligatoire.', 'validation_error', 400);
  const { client: _inlineClient, ...orderPayload } = payload;
  const queued = await queueOrderCreate({ ...orderPayload, clientId });
  let syncIssue: string | undefined;
  try { await sendQueuedMutation(); }
  catch (error) { syncIssue = error instanceof Error ? error.message : 'Synchronisation impossible.'; }
  const entry = (await outboxEntries()).find((row) => row.operation.operationId === queued.operationId);
  const detail = await getOrder(queued.id).catch(() => null);
  const order = detail ?? queued.summary;
  return { orderId: queued.id, reference: order.order.reference, order,
    queued: entry?.status !== 'applied', issue: syncIssue ??
      (entry?.status === 'rejected' || entry?.status === 'blocked' ? entry.receipt?.message : undefined) };
}

export async function updateOrderDetails(id: string, payload: { promisedDate: string | null; fittingDate: string | null; instructions: string | null }): Promise<OrderSummary> {
  const detail = await getOrder(id);
  const operationId = await queueOrderOperation(id, 'update', payload, detail.order.row_version);
  await sendQueuedMutation();
  const entry = (await outboxEntries()).find((row) => row.operation.operationId === operationId);
  if (entry?.status === 'rejected') throw new ApiError(entry.receipt?.message ?? 'Modification refusee.', 'sync_rejected', 400);
  return getOrder(id);
}

export async function cancelOrder(id: string, reason: string): Promise<OrderSummary> {
  const detail = await getOrder(id);
  const operationId = await queueOrderOperation(id, 'cancel', { reason }, detail.order.row_version);
  await sendQueuedMutation();
  const entry = (await outboxEntries()).find((row) => row.operation.operationId === operationId);
  if (entry?.status === 'rejected') throw new ApiError(entry.receipt?.message ?? 'Annulation refusee.', 'sync_rejected', 400);
  return getOrder(id);
}

export function closeOrder(id: string): Promise<{ result: 'closed' | 'already_closed'; order: OrderSummary }> {
  return apiRequest(`/orders/${id}/close`, {
    method: 'POST',
    body: JSON.stringify({ articlesHandedOver: true, paymentConfirmed: true }),
  });
}

export async function updateOrderItem(orderId: string, itemId: string, payload: { status: ItemStatus; dueDate: string | null; reason: string; rowVersion: number }): Promise<{ updated: true; queued: boolean }> {
  const id = await queueItemOperation(itemId, { orderId, ...payload });
  await sendQueuedMutation();
  const entry = (await outboxEntries()).find((row) => row.operation.operationId === id);
  if (entry?.status === 'rejected') throw new ApiError(entry.receipt?.message ?? 'Modification refusee.', 'sync_rejected', 400);
  return { updated: true, queued: entry?.status !== 'applied' };
}

export async function searchClients(q = ''): Promise<ClientOption[]> {
  const query = new URLSearchParams({ page: '1', pageSize: '30', sort: 'name' });
  if (q.trim()) query.set('q', q.trim());
  const page = await listClients({ page: 1, pageSize: 30, q, sort: 'name' });
  return page.items;
}

export async function listClients(params: { page?: number; pageSize?: number; q?: string; includeArchived?: boolean; sort?: ClientSort; direction?: SortDirection } = {}, onCached?: (cached: ClientPage) => void): Promise<ClientPage> {
  if (onCached) {
    const cached = await hasCachedClients().then((available) => available ? cachedClients(params) : null).catch(() => null);
    if (cached) onCached(cached);
  }
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 10),
    sort: params.sort ?? 'name',
    direction: params.direction ?? 'asc',
  });
  if (params.q?.trim()) query.set('q', params.q.trim());
  if (params.includeArchived) query.set('includeArchived', 'true');
  try {
    const page = await apiRequest<ClientPage>(`/clients?${query.toString()}`, {}, { offlineFallback: false });
    await cacheClients(page.items).catch(() => undefined);
    const history = await outboxEntries().catch(() => []);
    if (history.some((entry) => ['pending', 'conflict', 'rejected', 'blocked'].includes(entry.status))) {
      return cachedClients(params);
    }
    return page;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'network_error') return cachedClients(params);
    throw error;
  }
}

export async function getClient(id: string): Promise<Client> {
  const local = await cachedClient(id).catch(() => null);
  const history = await outboxEntries().catch(() => []);
  if (local && history.some((entry) => entry.operation.entityId === id && !['applied', 'superseded'].includes(entry.status))) return local;
  try {
    const client = await apiRequest<Client>(`/clients/${id}`);
    await cacheClients([client]).catch(() => undefined);
    return client;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'network_error' && local) return local;
    throw error;
  }
}

export async function createClient(payload: ClientInput): Promise<{ id: string }> {
  const id = await queueClientOperation('create', null, payload);
  await sendQueuedMutation();
  return { id };
}

export async function updateClient(id: string, payload: ClientInput): Promise<{ id: string }> {
  await queueClientOperation('update', id, payload);
  await sendQueuedMutation();
  return { id };
}

export async function deleteClient(id: string): Promise<{ id: string; deleted: true }> {
  await queueClientOperation('delete', id, {});
  await sendQueuedMutation();
  return { id, deleted: true };
}

export async function setClientArchived(id: string, archived: boolean): Promise<{ id: string; archived: boolean }> {
  await queueClientOperation('archive', id, { archived });
  await sendQueuedMutation();
  return { id, archived };
}

export async function listClientMeasurements(id: string): Promise<Measurement[]> {
  const path = `/clients/${id}/measurements`;
  const history = await outboxEntries().catch(() => []);
  const local = await cachedResponse<{ items: Measurement[] }>(path).catch(() => null);
  if (local && history.some((entry) => entry.operation.entityKind === 'measurement' &&
    entry.operation.payload.clientId === id && !['applied', 'superseded'].includes(entry.status))) return local.items;
  try { return (await apiRequest<{ items: Measurement[] }>(path, {}, { offlineFallback: false })).items; }
  catch (error) {
    if (error instanceof ApiError && error.code === 'network_error') {
      if (local) return local.items;
      if (await cachedClient(id)) return [];
    }
    throw error;
  }
}

export async function addClientMeasurement(id: string, payload: MeasurementInput): Promise<{ id: string }> {
  const measurementId = await queueMeasurement(id, payload);
  await sendQueuedMutation();
  const entry = (await outboxEntries()).find((row) => row.operation.entityId === measurementId);
  if (entry?.status === 'rejected') throw new ApiError(entry.receipt?.message ?? 'Mensuration refusee.', 'sync_rejected', 400);
  return { id: measurementId };
}

export async function recordOrderPayment(payload: PaymentDraft): Promise<{ movementId: string | null; queued: boolean }> {
  const key = await queuePayment(payload);
  await sendQueuedMutation();
  const entry = (await paymentEntries()).find((item) => item.idempotencyKey === key);
  if (entry?.status === 'rejected') throw new ApiError(entry.message ?? 'Encaissement refuse.', 'payment_rejected', 400);
  return { movementId: entry?.movementId ?? null, queued: entry?.status === 'pending' };
}

async function uploadAttachments(path: string, files: AttachmentDraft[]): Promise<{ items: unknown[]; queuedCount: number }> {
  if (Platform.OS !== 'web') {
    const ids: string[] = [];
    for (const file of files) ids.push(await queueAttachment(path, file, normaliseMimeType(file.name, file.mimeType)));
    await sendQueuedMutation();
    const entries = (await attachmentEntries()).filter((entry) => ids.includes(entry.id));
    const rejected = entries.find((entry) => entry.status === 'rejected');
    if (rejected) throw new ApiError(`${rejected.name} : ${rejected.message ?? 'Envoi refuse.'}`, 'upload_rejected', 400);
    return { items: [], queuedCount: entries.filter((entry) => entry.status === 'pending').length };
  }
  const items: unknown[] = [];
  for (const file of files) {
    try {
      const mimeType = normaliseMimeType(file.name, file.mimeType);
      let uploaded: { items: unknown[] };
      if (Platform.OS === 'web') {
        const form = new FormData();
        form.append('files', { uri: file.uri, name: file.name, type: mimeType } as unknown as Blob);
        uploaded = await apiRequest<{ items: unknown[] }>(path, { method: 'POST', body: form });
      } else {
        const dataBase64 = await new ExpoFile(file.uri).base64();
        uploaded = await apiRequest<{ items: unknown[] }>(path, {
          method: 'POST',
          body: JSON.stringify({ files: [{ name: file.name, mimeType, dataBase64 }] }),
        });
      }
      items.push(...uploaded.items);
    } catch (error) {
      const message = error instanceof Error ? error.message : "L'envoi a échoué.";
      throw new ApiError(`${file.name} : ${message}`, error instanceof ApiError ? error.code : 'upload_error', error instanceof ApiError ? error.status : 0);
    }
  }
  return { items, queuedCount: 0 };
}

function normaliseMimeType(name: string, mimeType?: string | null) {
  const value = mimeType?.toLowerCase();
  if (value && value !== 'application/octet-stream') return value === 'image/jpg' ? 'image/jpeg' : value;
  const extension = name.split('.').pop()?.toLowerCase();
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf' } as Record<string, string>)[extension ?? ''] ?? 'application/octet-stream';
}

export function uploadOrderAttachments(orderId: string, files: AttachmentDraft[]): Promise<{ items: unknown[]; queuedCount: number }> {
  return uploadAttachments(`/orders/${orderId}/attachments`, files);
}

export function deleteOrderAttachment(orderId: string, attachmentId: string): Promise<{ id: string; deleted: true }> {
  return apiRequest(`/orders/${orderId}/attachments/${attachmentId}`, { method: 'DELETE' });
}

export function uploadMeasurementAttachments(clientId: string, measurementId: string, files: AttachmentDraft[]): Promise<{ items: unknown[]; queuedCount: number }> {
  return uploadAttachments(`/clients/${clientId}/measurements/${measurementId}/attachments`, files);
}

export function deleteMeasurementAttachment(clientId: string, measurementId: string, attachmentId: string): Promise<{ id: string; deleted: true }> {
  return apiRequest(`/clients/${clientId}/measurements/${measurementId}/attachments/${attachmentId}`, { method: 'DELETE' });
}

export async function getPlanning(params: { q?: string; status?: PlanningStatusFilter; assignee?: PlanningAssigneeFilter } = {}, onCached?: (cached: PlanningResponse) => void): Promise<PlanningResponse> {
  if (onCached) {
    const cached = await cachedPlanning(params).catch(() => null);
    if (cached) onCached(cached);
  }
  const query = new URLSearchParams();
  if (params.q?.trim()) query.set('q', params.q.trim());
  query.set('status', params.status ?? 'active');
  query.set('assignee', params.assignee ?? 'all');
  try {
    const result = await apiRequest<PlanningResponse>(`/planning?${query.toString()}`, {}, { offlineFallback: false });
    if ((params.status ?? 'active') === 'all' && (params.assignee ?? 'all') === 'all' && !params.q) await cachePlanning(result).catch(() => undefined);
    const history = await outboxEntries().catch(() => []);
    if (history.some((entry) => (entry.operation.entityKind === 'order_item' ||
      entry.operation.entityKind === 'order' && entry.operation.action === 'create') &&
      !['applied', 'superseded'].includes(entry.status))) {
      const local = await cachedPlanning(params);
      if (local) return local;
    }
    return result;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'network_error') {
      const local = await cachedPlanning(params);
      if (local) return local;
    }
    throw error;
  }
}

export async function updatePlanningItem(itemId: string, payload: { orderId: string; status: ItemStatus; dueDate: string | null; assigneeId: string | null; reason: string; rowVersion: number }): Promise<{ updated: true; queued: boolean }> {
  const id = await queueItemOperation(itemId, payload);
  await sendQueuedMutation();
  const entry = (await outboxEntries()).find((row) => row.operation.operationId === id);
  if (entry?.status === 'rejected') throw new ApiError(entry.receipt?.message ?? 'Modification refusee.', 'sync_rejected', 400);
  return { updated: true, queued: entry?.status !== 'applied' };
}
