export interface PaginationMeta {
  page: number;
  pageSize?: number;
  limit?: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
  message?: string;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[] | unknown;
  };
}

export interface HealthStatus {
  status: string;
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
  service: string;
  version: string;
}
