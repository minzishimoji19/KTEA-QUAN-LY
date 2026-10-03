import { CustomerStatus, PriorityLevel, FollowUp, Recommendation, CustomerActivity } from './models';

export interface DashboardOverview {
  totalCustomers: number;
  activeCustomers: number;
  openCases: number;
  pendingPushes: number;
  overdueFollowUpsCount: number;
  todayFollowUpsCount: number;
  newRecommendationsCount: number;
  highPotentialCount: number;
}

export interface DashboardFollowUp extends FollowUp {
  customer?: {
    id: string;
    fullName: string;
    phone: string;
    overallStatus: CustomerStatus;
    priority?: PriorityLevel | null;
  };
}

export interface DashboardRecommendation extends Omit<Recommendation, 'targetProduct' | 'score'> {
  score: number;
  customer?: {
    id: string;
    fullName: string;
    phone: string;
    overallStatus: CustomerStatus;
    priority?: PriorityLevel | null;
  };
  targetProduct?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface DashboardActivity extends CustomerActivity {
  customer?: {
    id: string;
    fullName: string;
    phone: string;
  };
}

export interface DashboardData {
  overview: DashboardOverview;
  criticalToday: {
    overdueFollowUps: DashboardFollowUp[];
    todayFollowUps: DashboardFollowUp[];
  };
  highPotentialCustomers: DashboardRecommendation[];
  newRecommendations: DashboardRecommendation[];
  recentActivities: DashboardActivity[];
}
