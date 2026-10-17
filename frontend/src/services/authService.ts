import apiClient from './apiClient';
import {
  AuthUser,
  LoginResponse,
  SessionResponse,
  CustomerAssignmentItem,
  AuditLogItem,
  UserRole,
  UserStatus,
} from '../types/auth';

export const authService = {
  login: async (credentials: { email: string; password: string }): Promise<AuthUser> => {
    const res = await apiClient.post<LoginResponse>('/auth/login', credentials);
    return res.user;
  },

  getSession: async (): Promise<SessionResponse> => {
    return apiClient.get<SessionResponse>('/auth/session');
  },

  getMe: async (): Promise<AuthUser | null> => {
    try {
      const res = await apiClient.get<{ user: AuthUser }>('/auth/me');
      return res.user;
    } catch {
      return null;
    }
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout');
  },

  getUsers: async (): Promise<AuthUser[]> => {
    return apiClient.get<AuthUser[]>('/users');
  },

  createUser: async (data: {
    email: string;
    password: string;
    fullName: string;
    role?: UserRole;
    phone?: string;
  }): Promise<AuthUser> => {
    return apiClient.post<AuthUser>('/users', data);
  },

  updateUser: async (
    id: string,
    data: {
      fullName?: string;
      role?: UserRole;
      status?: UserStatus;
      phone?: string;
      password?: string;
    }
  ): Promise<AuthUser> => {
    return apiClient.patch<AuthUser>(`/users/${id}`, data);
  },

  assignCustomers: async (data: {
    partnerUserId: string;
    customerIds: string[];
    notes?: string;
  }): Promise<{ affected: number }> => {
    return apiClient.post<{ affected: number }>('/users/assignments', data);
  },

  unassignCustomer: async (data: {
    partnerUserId: string;
    customerId: string;
  }): Promise<{ unassigned: boolean }> => {
    return apiClient.post<{ unassigned: boolean }>('/users/unassign', data);
  },

  getUserAssignments: async (partnerUserId: string): Promise<CustomerAssignmentItem[]> => {
    return apiClient.get<CustomerAssignmentItem[]>(`/users/${partnerUserId}/assignments`);
  },

  getAuditLogs: async (filters?: {
    limit?: number;
    action?: string;
    entityType?: string;
  }): Promise<AuditLogItem[]> => {
    const params = new URLSearchParams();
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.action) params.set('action', filters.action);
    if (filters?.entityType) params.set('entityType', filters.entityType);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<AuditLogItem[]>(`/users/audit-logs${queryString}`);
  },
};

export default authService;
