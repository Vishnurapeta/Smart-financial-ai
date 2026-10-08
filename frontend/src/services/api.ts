import {
  AuthResponse,
  LoginPayload,
  RegisterPayload,
  User,
  UserSession,
  AuthTokens,
} from '../types/auth.ts';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

interface Subscriber {
  resolve: (token: string) => void;
  reject: (err: unknown) => void;
}

class ApiClient {
  private accessToken: string | null = null;
  private refreshTokenVal: string | null = null;
  private isRefreshing = false;
  private refreshSubscribers: Subscriber[] = [];

  constructor() {
    this.accessToken = localStorage.getItem('smartfin_access_token');
    this.refreshTokenVal = localStorage.getItem('smartfin_refresh_token');
  }

  public setAccessToken(token: string | null): void {
    this.accessToken = token;
    if (token) {
      localStorage.setItem('smartfin_access_token', token);
    } else {
      localStorage.removeItem('smartfin_access_token');
    }
  }

  public setRefreshToken(token: string | null): void {
    this.refreshTokenVal = token;
    if (token) {
      localStorage.setItem('smartfin_refresh_token', token);
    } else {
      localStorage.removeItem('smartfin_refresh_token');
    }
  }

  public setTokens(tokens: AuthTokens | null): void {
    if (tokens) {
      this.setAccessToken(tokens.accessToken);
      this.setRefreshToken(tokens.refreshToken);
    } else {
      this.setAccessToken(null);
      this.setRefreshToken(null);
    }
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public getRefreshToken(): string | null {
    return this.refreshTokenVal;
  }

  private onTokenRefreshed(token: string) {
    this.refreshSubscribers.forEach(({ resolve }) => resolve(token));
    this.refreshSubscribers = [];
  }

  private onTokenRefreshFailed(err: unknown) {
    this.refreshSubscribers.forEach(({ reject }) => reject(err));
    this.refreshSubscribers = [];
  }

  private addRefreshSubscriber(subscriber: Subscriber) {
    this.refreshSubscribers.push(subscriber);
  }

  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.accessToken && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const config: RequestInit = {
      ...options,
      headers,
      credentials: 'include', // Include HTTP-only cookies
    };

    let response: Response;
    try {
      response = await fetch(url, config);
    } catch (networkError) {
      throw new Error(
        networkError instanceof Error
          ? networkError.message
          : 'Network error: failed to communicate with backend server',
      );
    }

    // Handle token expiration & automatic refresh
    if (
      response.status === 401 &&
      !endpoint.includes('/auth/login') &&
      !endpoint.includes('/auth/register') &&
      !endpoint.includes('/auth/refresh-token')
    ) {
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        try {
          const newTokens = await this.refreshToken();
          this.isRefreshing = false;
          this.setTokens(newTokens);
          this.onTokenRefreshed(newTokens.accessToken);

          // Retry initial request with new token
          headers['Authorization'] = `Bearer ${newTokens.accessToken}`;
          const retryRes = await fetch(url, { ...config, headers });
          return this.handleResponse<T>(retryRes);
        } catch (err) {
          this.isRefreshing = false;
          this.setTokens(null);
          this.onTokenRefreshFailed(err);

          // Dispatch event to inform AuthContext that the session has expired
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('smartfin:auth_expired'));
          }

          throw err;
        }
      } else {
        // Wait for refresh to complete and retry or reject cleanly
        return new Promise((resolve, reject) => {
          this.addRefreshSubscriber({
            resolve: async (newToken: string) => {
              try {
                headers['Authorization'] = `Bearer ${newToken}`;
                const retryRes = await fetch(url, { ...config, headers });
                resolve(await this.handleResponse<T>(retryRes));
              } catch (err) {
                reject(err);
              }
            },
            reject: (err: unknown) => {
              reject(err);
            },
          });
        });
      }
    }

    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message =
        payload?.error?.message ||
        payload?.message ||
        `HTTP Request Failed with Status ${response.status}`;
      const error = new Error(message);
      // Attach status code for caller inspection
      (error as Error & { status?: number }).status = response.status;
      throw error;
    }

    return payload as T;
  }

  // Auth Methods
  public async register(data: RegisterPayload): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.data?.tokens) {
      this.setTokens(res.data.tokens);
    }
    return res;
  }

  public async login(data: LoginPayload): Promise<AuthResponse> {
    const res = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.data?.tokens) {
      this.setTokens(res.data.tokens);
    }
    return res;
  }

  public async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.refreshTokenVal || undefined }),
      });
    } finally {
      this.setTokens(null);
    }
  }

  public async refreshToken(): Promise<AuthTokens> {
    const url = `${API_BASE}/auth/refresh-token`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        refreshToken: this.refreshTokenVal || undefined,
      }),
    });

    let payload;
    try {
      payload = await res.json();
    } catch {
      payload = null;
    }

    if (!res.ok || !payload?.data?.tokens) {
      const msg = payload?.error?.message || payload?.message || 'Failed to refresh token';
      throw new Error(msg);
    }

    const tokens: AuthTokens = payload.data.tokens;
    this.setTokens(tokens);
    return tokens;
  }

  public async getCurrentUser(): Promise<User> {
    const res = await this.request<{ success: boolean; data: { user: User } }>('/auth/me');
    return res.data.user;
  }

  public async updateProfile(data: {
    defaultCurrency?: string;
    locale?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<User> {
    const res = await this.request<{ success: boolean; data: { user: User } }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return res.data.user;
  }

  public async getSessions(): Promise<UserSession[]> {
    const res = await this.request<{ success: boolean; data: { sessions: UserSession[] } }>(
      '/auth/sessions',
    );
    return res.data.sessions;
  }

  public async revokeSession(sessionId: string): Promise<void> {
    await this.request(`/auth/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiClient();
