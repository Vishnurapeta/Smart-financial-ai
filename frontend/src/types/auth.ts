export type RoleName =
  'USER' | 'ADMIN' | 'PREMIUM_USER' | 'FINANCIAL_ANALYST' | 'COMPLIANCE_OFFICER' | 'SUPER_ADMIN';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleName;
  isEmailVerified: boolean;
  defaultCurrency: string;
  locale: string;
  createdAt: string;
}

export interface UserSession {
  id: string;
  deviceName?: string;
  ipAddress: string;
  userAgent: string;
  lastActiveAt: string;
  createdAt: string;
  isCurrent: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    tokens: AuthTokens;
    verificationToken?: string;
  };
  message?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: RoleName;
  defaultCurrency?: string;
}
