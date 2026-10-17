import apiClient, { setAuthToken } from './apiClient';
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
    if (res.token) {
      setAuthToken(res.token);
    }
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
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setAuthToken(null);
    }
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
    sourceType?: 'DIRECT' | 'CARE_SCHEDULE' | 'ALL';
    sourceId?: string;
  }): Promise<{ success: boolean; completelyRevoked: boolean; remainingSourcesCount: number; revokedSource?: string; message: string }> => {
    return apiClient.post<{ success: boolean; completelyRevoked: boolean; remainingSourcesCount: number; revokedSource?: string; message: string }>('/users/unassign', data);
  },

  bulkUnassignCustomers: async (data: {
    partnerUserId: string;
    customerIds: string[];
    sourceType?: 'DIRECT' | 'CARE_SCHEDULE' | 'ALL';
  }): Promise<{ total: number; succeeded: string[]; failed: Array<{ id: string; reason: string }>; message: string }> => {
    return apiClient.post<{ total: number; succeeded: string[]; failed: Array<{ id: string; reason: string }>; message: string }>('/users/bulk-unassign', data);
  },

  bulkReassignCustomers: async (data: {
    fromUserId?: string;
    toUserId: string;
    customerIds: string[];
    notes?: string;
  }): Promise<{ total: number; succeeded: string[]; failed: Array<{ id: string; reason: string }>; message: string }> => {
    return apiClient.post<{ total: number; succeeded: string[]; failed: Array<{ id: string; reason: string }>; message: string }>('/users/bulk-reassign', data);
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

  linkCaretaker: async (
    userId: string,
    caretakerId: string | null
  ): Promise<any> => {
    return apiClient.post(`/users/${userId}/link-caretaker`, { caretakerId });
  },

  getEligibleCaregivers: async (): Promise<AuthUser[]> => {
    return apiClient.get<AuthUser[]>('/users/caregivers');
  },
};

export default authService;
