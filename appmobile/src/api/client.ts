import type { ApiResponse, BootstrapResponse, LoginRequest, LoginResponse } from '@/src/types/api';

const FALLBACK_API_URL = 'http://localhost:3000/api/mobile/v1';

let bearerToken: string | null = null;

export function getApiBaseUrl() {
  return process.env.EXPO_PUBLIC_FILEO_API_URL ?? FALLBACK_API_URL;
}

export function setBearerToken(token: string | null) {
  bearerToken = token;
}

export async function login(payload: LoginRequest) {
  const response = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setBearerToken(response.token);
  return response;
}

export async function getBootstrap() {
  return request<BootstrapResponse>('/bootstrap');
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (bearerToken) headers.set('authorization', `Bearer ${bearerToken}`);

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers,
  });
  const payload = (await response.json()) as ApiResponse<T>;

  if (!payload.ok) {
    throw new Error(payload.error.message);
  }

  return payload.data;
}
