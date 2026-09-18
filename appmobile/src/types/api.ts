export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type LoginRequest = {
  country: string;
  phone: string;
  password: string;
  workshopId?: string | null;
};

export type SessionPayload = {
  user: Record<string, unknown>;
  workshop: Record<string, unknown>;
  capabilities: {
    canViewMoney: boolean;
    role: string;
  };
};

export type LoginResponse = SessionPayload & {
  token: string;
  tokenType: 'Bearer';
  expiresAt: string;
};

export type BootstrapResponse = SessionPayload & {
  dashboard: {
    counts?: Record<string, number>;
    agenda?: unknown[];
    finance?: Record<string, unknown> | null;
  };
};
