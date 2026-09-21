import Constants from 'expo-constants';
import { File as ExpoFile } from 'expo-file-system';
import { Platform } from 'react-native';

import { clearAuthSession, getAuthSession, saveAuthSession } from '../auth/session';
import type {
  LoginRequest,
  LoginResponse,
  RefreshResponse,
  RegisterRequest,
  RegisterResponse,
} from '../types/auth';
import type { BootstrapResponse } from '../types/dashboard';
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
  const headers = new Headers(init.headers);
  const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
  if (init.body && !isFormData && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (token) headers.set('authorization', `Bearer ${token}`);

  try {
    return await fetch(`${getApiBaseUrl()}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Serveur inaccessible. Vérifiez votre connexion.', 'network_error', 0);
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

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getAuthSession();
  let response = await fetchApi(path, init, session?.token);

  if (response.status === 401 && !path.startsWith('/auth/')) {
    const token = await refreshAccessToken();
    response = await fetchApi(path, init, token);
  }

  const payload = await readPayload<T>(response);
  if (!response.ok || !payload?.ok) throw responseError(response, payload);
  return payload.data;
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

export function getBootstrap(): Promise<BootstrapResponse> {
  return apiRequest<BootstrapResponse>('/bootstrap');
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

export function updateWorkshop(name: string, city: string) {
  return apiRequest<{ name: string; city: string | null }>('/more/workshop', { method: 'PATCH', body: JSON.stringify({ name, city }) });
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

export function declareSubscriptionPayment(input: { planId: string; channel: string; reference: string }) {
  return apiRequest<{ paymentId: string }>('/more/subscription', { method: 'POST', body: JSON.stringify(input) });
}

export function listOrders(params: { page?: number; pageSize?: number; q?: string; filter?: OrderFilter } = {}): Promise<OrderPage> {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 1));
  query.set('pageSize', String(params.pageSize ?? 10));
  if (params.q?.trim()) query.set('q', params.q.trim());
  if (params.filter && params.filter !== 'all') query.set('filter', params.filter);
  return apiRequest<OrderPage>(`/orders?${query.toString()}`);
}

export function getOrder(id: string): Promise<OrderDetail> {
  return apiRequest<OrderDetail>(`/orders/${id}`);
}

export function createOrder(payload: CreateOrderRequest): Promise<{ orderId: string; reference: string; order: OrderSummary }> {
  return apiRequest('/orders', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateOrderDetails(id: string, payload: { promisedDate: string | null; fittingDate: string | null; instructions: string | null }): Promise<OrderSummary> {
  return apiRequest(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'update', ...payload }) });
}

export function cancelOrder(id: string, reason: string): Promise<OrderSummary> {
  return apiRequest(`/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ action: 'cancel', reason }) });
}

export function closeOrder(id: string): Promise<{ result: 'closed' | 'already_closed'; order: OrderSummary }> {
  return apiRequest(`/orders/${id}/close`, {
    method: 'POST',
    body: JSON.stringify({ articlesHandedOver: true, paymentConfirmed: true }),
  });
}

export function updateOrderItem(orderId: string, itemId: string, payload: { status: ItemStatus; dueDate: string | null; reason: string; rowVersion: number }): Promise<{ updated: true }> {
  return apiRequest(`/orders/${orderId}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export async function searchClients(q = ''): Promise<ClientOption[]> {
  const query = new URLSearchParams({ page: '1', pageSize: '30', sort: 'name' });
  if (q.trim()) query.set('q', q.trim());
  const page = await apiRequest<{ items: ClientOption[] }>(`/clients?${query.toString()}`);
  return page.items;
}

export function listClients(params: { page?: number; pageSize?: number; q?: string; includeArchived?: boolean; sort?: ClientSort; direction?: SortDirection } = {}): Promise<ClientPage> {
  const query = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 10),
    sort: params.sort ?? 'name',
    direction: params.direction ?? 'asc',
  });
  if (params.q?.trim()) query.set('q', params.q.trim());
  if (params.includeArchived) query.set('includeArchived', 'true');
  return apiRequest<ClientPage>(`/clients?${query.toString()}`);
}

export function getClient(id: string): Promise<Client> {
  return apiRequest<Client>(`/clients/${id}`);
}

export function createClient(payload: ClientInput): Promise<{ id: string }> {
  return apiRequest('/clients', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateClient(id: string, payload: ClientInput): Promise<{ id: string }> {
  return apiRequest(`/clients/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
}

export function deleteClient(id: string): Promise<{ id: string; deleted: true }> {
  return apiRequest(`/clients/${id}`, { method: 'DELETE' });
}

export function setClientArchived(id: string, archived: boolean): Promise<{ id: string; archived: boolean }> {
  return apiRequest(`/clients/${id}/archive`, { method: 'PATCH', body: JSON.stringify({ archived }) });
}

export async function listClientMeasurements(id: string): Promise<Measurement[]> {
  const result = await apiRequest<{ items: Measurement[] }>(`/clients/${id}/measurements`);
  return result.items;
}

export function addClientMeasurement(id: string, payload: MeasurementInput): Promise<{ id: string }> {
  return apiRequest(`/clients/${id}/measurements`, { method: 'POST', body: JSON.stringify(payload) });
}

export function recordOrderPayment(payload: { orderId: string; amount: number; method: string; reference?: string | null; effectiveDate: string }): Promise<{ movementId: string }> {
  return apiRequest('/payments/record', { method: 'POST', body: JSON.stringify(payload) });
}

async function uploadAttachments(path: string, files: AttachmentDraft[]): Promise<{ items: unknown[] }> {
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
  return { items };
}

function normaliseMimeType(name: string, mimeType?: string | null) {
  const value = mimeType?.toLowerCase();
  if (value && value !== 'application/octet-stream') return value === 'image/jpg' ? 'image/jpeg' : value;
  const extension = name.split('.').pop()?.toLowerCase();
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf' } as Record<string, string>)[extension ?? ''] ?? 'application/octet-stream';
}

export function uploadOrderAttachments(orderId: string, files: AttachmentDraft[]): Promise<{ items: unknown[] }> {
  return uploadAttachments(`/orders/${orderId}/attachments`, files);
}

export function deleteOrderAttachment(orderId: string, attachmentId: string): Promise<{ id: string; deleted: true }> {
  return apiRequest(`/orders/${orderId}/attachments/${attachmentId}`, { method: 'DELETE' });
}

export function uploadMeasurementAttachments(clientId: string, measurementId: string, files: AttachmentDraft[]): Promise<{ items: unknown[] }> {
  return uploadAttachments(`/clients/${clientId}/measurements/${measurementId}/attachments`, files);
}

export function deleteMeasurementAttachment(clientId: string, measurementId: string, attachmentId: string): Promise<{ id: string; deleted: true }> {
  return apiRequest(`/clients/${clientId}/measurements/${measurementId}/attachments/${attachmentId}`, { method: 'DELETE' });
}

export function getPlanning(params: { q?: string; status?: PlanningStatusFilter; assignee?: PlanningAssigneeFilter } = {}): Promise<PlanningResponse> {
  const query = new URLSearchParams();
  if (params.q?.trim()) query.set('q', params.q.trim());
  query.set('status', params.status ?? 'active');
  query.set('assignee', params.assignee ?? 'all');
  return apiRequest<PlanningResponse>(`/planning?${query.toString()}`);
}

export function updatePlanningItem(itemId: string, payload: { status: ItemStatus; dueDate: string | null; assigneeId: string | null; reason: string; rowVersion: number }): Promise<{ updated: true }> {
  return apiRequest(`/planning/${itemId}`, { method: 'PATCH', body: JSON.stringify(payload) });
}
