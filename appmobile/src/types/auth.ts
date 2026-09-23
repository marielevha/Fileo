export type CountryCode = 'CG' | 'CD';

export type LoginRequest = {
  country: CountryCode;
  phone: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresAt: string;
  user: { id: string; fullName: string; phone: string };
  workshop: { id: string; name: string; currency: string; countryCode: string; measurementUnits?: string[] };
  capabilities: { canViewMoney: boolean; role: 'owner' | 'collaborator' };
};

export type RefreshResponse = LoginResponse;

export type RegisterRequest = {
  fullName: string;
  country: CountryCode;
  phone: string;
  password: string;
  workshopName: string;
  city?: string;
  currency: 'XAF' | 'CDF';
  termsAccepted: true;
};

export type RegisterResponse = {
  userId: string;
  workshopId: string;
  phone: string;
  requiresVerification: boolean;
  resendAfter: string;
};
