export type UserRole = 'ADMIN' | 'PARTNER';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status?: UserStatus;
  phone?: string | null;
  assignedCustomersCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginResponse {
  user: AuthUser;
}

export interface SessionResponse {
  authenticated: boolean;
  user?: AuthUser;
}

export interface CustomerAssignmentItem {
  id: string;
  customerId: string;
  userId: string;
  assignedAt: string;
  notes?: string | null;
  customer?: {
    id: string;
    fullName: string;
    phone: string;
    overallStatus: string;
  };
}

export interface AuditLogItem {
  id: string;
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}
