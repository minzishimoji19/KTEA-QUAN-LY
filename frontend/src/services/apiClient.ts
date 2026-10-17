import { ApiResponse, ApiErrorResponse } from '../types/api';

export class ApiClientError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function normalizeApiUrl(rawUrl?: string): string {
  let url = (rawUrl || '/api').trim().replace(/\/+$/, '');
  if (/^https?:\/\/[^/]+$/.test(url)) {
    url = `${url}/api`;
  }
  return url;
}

export function getApiBaseUrl(): string {
  return normalizeApiUrl(import.meta.env.VITE_API_BASE_URL);
}

export type AuthErrorHandler = (status: number) => void;
let onAuthError: AuthErrorHandler | null = null;
let inMemoryToken: string | null = null;

export function setAuthErrorHandler(handler: AuthErrorHandler | null): void {
  onAuthError = handler;
}

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      try {
        localStorage.setItem('ktea_auth_token', token);
      } catch (_) {}
    } else {
      try {
        localStorage.removeItem('ktea_auth_token');
      } catch (_) {}
    }
  }
}

export function getAuthToken(): string | null {
  if (!inMemoryToken && typeof window !== 'undefined') {
    try {
      inMemoryToken = localStorage.getItem('ktea_auth_token');
    } catch (_) {}
  }
  return inMemoryToken;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = normalizeApiUrl(baseUrl || import.meta.env.VITE_API_BASE_URL);
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-KTEA-REQUEST': '1',
      ...((options.headers as Record<string, string>) || {}),
    };

    const authToken = getAuthToken();
    if (authToken && !headers.Authorization) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    try {
      const response = await fetch(url, {
        credentials: 'include',
        ...options,
        headers,
      });

      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      const data = isJson ? await response.json() : await response.text();

      if (!response.ok) {
        if (response.status === 401) {
          // If 401 is received, clear in-memory token
          inMemoryToken = null;

          // Notify auth handler for operational endpoints (exclude passive auth checks)
          if (
            onAuthError &&
            typeof window !== 'undefined' &&
            !window.location.pathname.startsWith('/login') &&
            !endpoint.includes('/auth/me') &&
            !endpoint.includes('/auth/login') &&
            !endpoint.includes('/auth/session')
          ) {
            onAuthError(401);
          }
        }

        const errorData = data as ApiErrorResponse;
        throw new ApiClientError(
          response.status,
          errorData?.error?.code || 'HTTP_ERROR',
          errorData?.error?.message || `Request failed with status ${response.status}`,
          errorData?.error?.details
        );
      }

      // If wrapped in standard ApiResponse envelope, return extracted data or response
      const apiResponse = data as ApiResponse<T>;
      if (apiResponse && typeof apiResponse === 'object' && 'data' in apiResponse) {
        if ('pagination' in apiResponse) {
          return apiResponse as unknown as T;
        }
        return apiResponse.data;
      }
      return data as T;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }
      throw new ApiClientError(
        0,
        'NETWORK_ERROR',
        error instanceof Error ? error.message : 'Network request failed'
      );
    }
  }

  public get<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  public post<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public put<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public patch<T>(endpoint: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  public delete<T>(endpoint: string, options?: RequestInit): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
