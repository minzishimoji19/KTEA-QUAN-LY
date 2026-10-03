import { CustomerFeatures } from './types.js';

export function extractCustomerFeatures(customer: any): CustomerFeatures {
  const now = Date.now();

  const needs = Array.isArray(customer.needs) ? customer.needs : [];
  const activeNeeds = needs
    .filter((n: any) => n.status === 'OPEN' || n.status === 'IN_PROGRESS')
    .map((n: any) => ({
      id: n.id,
      needType: n.needType,
      status: n.status,
      notes: n.notes || null,
      detectedAt: new Date(n.detectedAt || n.createdAt),
    }));

  const resolvedNeeds = needs
    .filter((n: any) => n.status === 'RESOLVED' || n.status === 'DROPPED')
    .map((n: any) => ({
      id: n.id,
      needType: n.needType,
      status: n.status,
      resolvedAt: n.resolvedAt ? new Date(n.resolvedAt) : null,
    }));

  const cases = Array.isArray(customer.cases) ? customer.cases : [];
  const applicationHistory = cases.map((c: any) => ({
    id: c.id,
    productId: c.productId,
    productCode: c.product?.code || '',
    productName: c.product?.name || '',
    status: c.caseStatus,
    failureReason: c.failureReason || null,
    createdAt: new Date(c.createdAt),
  }));

  const activities = Array.isArray(customer.activities) ? customer.activities : [];
  const sortedActivities = [...activities].sort(
    (a: any, b: any) =>
      new Date(b.occurredAt || b.createdAt).getTime() -
      new Date(a.occurredAt || a.createdAt).getTime()
  );

  const recentActivities = sortedActivities.slice(0, 10).map((act: any) => ({
    id: act.id,
    type: act.type,
    title: act.title,
    occurredAt: new Date(act.occurredAt || act.createdAt),
  }));

  let daysSinceLastActivity: number | null = null;
  if (recentActivities.length > 0) {
    const diffMs = now - recentActivities[0].occurredAt.getTime();
    daysSinceLastActivity = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  const pushes = Array.isArray(customer.pushRecords) ? customer.pushRecords : [];
  const existingPushes = pushes.map((p: any) => ({
    id: p.id,
    targetProductId: p.targetProductId,
    status: p.status,
    pushedAt: new Date(p.pushedAt || p.createdAt),
  }));

  const recommendations = Array.isArray(customer.recommendations)
    ? customer.recommendations
    : [];
  const existingRecommendations = recommendations.map((r: any) => ({
    id: r.id,
    targetProductId: r.targetProductId,
    status: r.status,
    generatedAt: new Date(r.generatedAt || r.createdAt),
  }));

  return {
    customerId: customer.id,
    fullName: customer.fullName || '',
    phone: customer.phone || '',
    overallStatus: customer.overallStatus,
    priority: customer.priority || null,
    activeNeeds,
    resolvedNeeds,
    applicationHistory,
    recentActivities,
    daysSinceLastActivity,
    existingPushes,
    existingRecommendations,
  };
}
