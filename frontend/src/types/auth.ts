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
  caretaker?: {
    id: string;
    name: string;
    active: boolean;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginResponse {
  user: AuthUser;
  token?: string;
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
  sources?: {
    hasDirect: boolean;
    hasCareSchedule: boolean;
    isLegacyDirect?: boolean;
    careSchedulesCount: number;
    careSchedules?: Array<{
      id: string;
      title: string;
      dueAt: string;
      status: string;
    }>;
    grantCount: number;
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
