import prisma from '../config/database.js';
import { settingsService } from './settings.service.js';

export interface DatabaseStatus {
  status: 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED';
  dialect: string;
  pingLatencyMs: number;
  tables: {
    customers: number;
    products: number;
    cases: number;
    needs: number;
    activities: number;
    notes: number;
    tags: number;
    followUps: number;
    recommendations: number;
    pushRecords: number;
  };
  connectedAt: string;
}

export interface DemoModeStatus {
  isDemoMode: boolean;
  demoCustomerCount: number;
  totalCustomers: number;
  detectedSeedIndicators: string[];
  guidanceNote: string;
}

export interface BackupGuidance {
  logicalBackup: {
    command: string;
    description: string;
  };
  restoreGuidance: {
    command: string;
    description: string;
  };
  recommendedCadence: string[];
  retentionPolicy: string;
}

export class DataGovernanceService {
  async getDatabaseStatus(): Promise<DatabaseStatus> {
    const start = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const pingLatencyMs = Date.now() - start;

    const [
      customers,
      products,
      cases,
      needs,
      activities,
      notes,
      tags,
      followUps,
      recommendations,
      pushRecords,
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.product.count(),
      prisma.customerCase.count(),
      prisma.customerNeed.count(),
      prisma.customerActivity.count(),
      prisma.customerNote.count(),
      prisma.tag.count(),
      prisma.followUp.count(),
      prisma.recommendation.count(),
      prisma.pushRecord.count(),
    ]);

    return {
      status: 'HEALTHY',
      dialect: 'MySQL / MariaDB',
      pingLatencyMs,
      tables: {
        customers,
        products,
        cases,
        needs,
        activities,
        notes,
        tags,
        followUps,
        recommendations,
        pushRecords,
      },
      connectedAt: new Date().toISOString(),
    };
  }

  async getDemoModeStatus(): Promise<DemoModeStatus> {
    const totalCustomers = await prisma.customer.count();
    // In seed.ts, sample customers have standard Vietnamese names and initial tags/needs
    const sampleCustomer = await prisma.customer.findFirst({
      where: {
        fullName: { in: ['Nguyen Van An', 'Tran Thi Bich', 'Le Hoang Minh'] },
      },
    });

    const isDemoMode = Boolean(sampleCustomer && totalCustomers > 0);
    const indicators: string[] = [];

    if (sampleCustomer) {
      indicators.push('Standard benchmark demonstration customers detected');
    }
    if (totalCustomers >= 30) {
      indicators.push('Catalog includes comprehensive multi-stage application lifecycles');
    }

    return {
      isDemoMode,
      demoCustomerCount: isDemoMode ? totalCustomers : 0,
      totalCustomers,
      detectedSeedIndicators: indicators,
      guidanceNote: isDemoMode
        ? 'Current database is loaded with realistic demonstration client profiles for testing operational workflows.'
        : 'Production database mode: customer records are operational client accounts.',
    };
  }

  getBackupGuidance(): BackupGuidance {
    return {
      logicalBackup: {
        command: 'mysqldump -u root -p crm_db > crm_backup_$(date +%Y%m%d_%H%M%S).sql',
        description: 'Creates a full logical SQL dump containing schema definitions, customer profiles, cases, and audit logs.',
      },
      restoreGuidance: {
        command: 'mysql -u root -p crm_db < crm_backup_YYYYMMDD_HHMMSS.sql',
        description: 'Restores the relational schema and records from an authentic timestamped dump.',
      },
      recommendedCadence: [
        'Daily: Run automated logical backup after business hours to a secured local or network folder.',
        'Weekly: Retain an offline / cold backup snapshot.',
        'Pre-migration: Always capture a point-in-time SQL dump before running schema migrations or batch imports.',
      ],
      retentionPolicy: 'Recommended 30-day rolling retention for operational point-in-time recovery.',
    };
  }

  async exportAllData(filters?: { status?: string; startDate?: string; endDate?: string }) {
    const customerWhere: Record<string, unknown> = {};
    if (filters?.status) {
      customerWhere.overallStatus = filters.status;
    }
    if (filters?.startDate || filters?.endDate) {
      const dateFilter: Record<string, Date> = {};
      if (filters.startDate) dateFilter.gte = new Date(filters.startDate);
      if (filters.endDate) dateFilter.lte = new Date(filters.endDate);
      customerWhere.createdAt = dateFilter;
    }

    const [
      customers,
      products,
      cases,
      needs,
      activities,
      notes,
      tags,
      followUps,
      recommendations,
      pushRecords,
      settings,
    ] = await Promise.all([
      prisma.customer.findMany({
        where: customerWhere,
        include: {
          customerTags: { include: { tag: true } },
        },
      }),
      prisma.product.findMany(),
      prisma.customerCase.findMany(),
      prisma.customerNeed.findMany(),
      prisma.customerActivity.findMany(),
      prisma.customerNote.findMany(),
      prisma.tag.findMany(),
      prisma.followUp.findMany(),
      prisma.recommendation.findMany(),
      prisma.pushRecord.findMany(),
      settingsService.getSettings(),
    ]);

    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        system: 'K-TEA CRM & Intelligence Workspace',
        counts: {
          customers: customers.length,
          products: products.length,
          cases: cases.length,
          needs: needs.length,
          activities: activities.length,
          notes: notes.length,
          tags: tags.length,
          followUps: followUps.length,
          recommendations: recommendations.length,
          pushRecords: pushRecords.length,
        },
      },
      data: {
        customers,
        products,
        cases,
        needs,
        activities,
        notes,
        tags,
        followUps,
        recommendations,
        pushRecords,
      },
      settings,
    };
  }
}

export const dataGovernanceService = new DataGovernanceService();
export default dataGovernanceService;
