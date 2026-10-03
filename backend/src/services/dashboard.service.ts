import { dashboardRepository } from '../repositories/dashboard.repository.js';
import BaseService from './base.service.js';

export class DashboardService extends BaseService {
  async getDashboard() {
    const raw = await dashboardRepository.getDashboardData();

    const normalizeScore = (score: any): number => {
      if (score === null || score === undefined) return 0;
      const num = Number(score);
      return num <= 1.0 ? Math.round(num * 100) : Math.round(num);
    };

    const highPotentialCustomers = raw.highPotentialCustomers.map((rec) => ({
      ...rec,
      score: normalizeScore(rec.score),
    }));

    const newRecommendations = raw.newRecommendations.map((rec) => ({
      ...rec,
      score: normalizeScore(rec.score),
    }));

    return {
      ...raw,
      highPotentialCustomers,
      newRecommendations,
    };
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
