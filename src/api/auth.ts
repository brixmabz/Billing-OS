import type { LoginCredentials, AuthResponse, User } from '../types';
import { tokenStorage } from '../utils/tokenStorage';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

class AuthAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = tokenStorage.getToken();

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      // FastAPI returns 'detail', but check both for compatibility
      const message = error.detail || error.message || 'Invalid username or password';
      throw new Error(message);
    }

    return response.json();
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    // Backend returns different field names, so we need to transform
    const rawResponse = await this.request<{
      access_token: string;
      refresh_token?: string;
      token_type: string;
      expires_in: number;
      user: {
        id: number;
        username: string;
        email: string;
        full_name: string;
        role: string;
        team?: string;
        avatar_url?: string;
        is_active: boolean;
        is_verified: boolean;
        created_at: string;
        last_login_at?: string;
      };
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: credentials.username,
        password: credentials.password,
        remember_me: credentials.rememberMe || false,
      }),
    });

    // Transform to frontend format
    const response: AuthResponse = {
      user: {
        id: String(rawResponse.user.id),
        username: rawResponse.user.username,
        name: rawResponse.user.full_name,
        email: rawResponse.user.email,
        role: rawResponse.user.role as 'collector' | 'admin' | 'supervisor',
        team: rawResponse.user.team,
        avatar: rawResponse.user.avatar_url,
      },
      token: rawResponse.access_token,
      refreshToken: rawResponse.refresh_token,
    };

    // Store tokens using appropriate storage based on rememberMe
    if (response.token) {
      tokenStorage.setRememberMe(credentials.rememberMe || false);
      tokenStorage.setToken(response.token);
      if (response.refreshToken) {
        tokenStorage.setRefreshToken(response.refreshToken);
      }
    }

    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      tokenStorage.clear();
    }
  }

  async getCurrentUser(): Promise<User> {
    const rawUser = await this.request<{
      id: number;
      username: string;
      email: string;
      full_name: string;
      role: string;
      team?: string;
      avatar_url?: string;
      is_active: boolean;
      is_verified: boolean;
      created_at: string;
      last_login_at?: string;
    }>('/auth/me');

    return {
      id: String(rawUser.id),
      username: rawUser.username,
      name: rawUser.full_name,
      email: rawUser.email,
      role: rawUser.role as 'collector' | 'admin' | 'supervisor',
      team: rawUser.team,
      avatar: rawUser.avatar_url,
    };
  }

  async refreshToken(): Promise<AuthResponse> {
    const storedRefreshToken = tokenStorage.getRefreshToken();

    if (!storedRefreshToken) {
      throw new Error('No refresh token available');
    }

    const rawResponse = await this.request<{
      access_token: string;
      refresh_token?: string;
      token_type: string;
      expires_in: number;
      user: {
        id: number;
        username: string;
        email: string;
        full_name: string;
        role: string;
        team?: string;
        avatar_url?: string;
        is_active: boolean;
        is_verified: boolean;
        created_at: string;
        last_login_at?: string;
      };
    }>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: storedRefreshToken }),
    });

    const response: AuthResponse = {
      user: {
        id: String(rawResponse.user.id),
        username: rawResponse.user.username,
        name: rawResponse.user.full_name,
        email: rawResponse.user.email,
        role: rawResponse.user.role as 'collector' | 'admin' | 'supervisor',
        team: rawResponse.user.team,
        avatar: rawResponse.user.avatar_url,
      },
      token: rawResponse.access_token,
      refreshToken: rawResponse.refresh_token,
    };

    if (response.token) {
      tokenStorage.setToken(response.token);
    }

    return response;
  }

  getStoredToken(): string | null {
    return tokenStorage.getToken();
  }

  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
}

export const authAPI = new AuthAPI();
export default authAPI;
