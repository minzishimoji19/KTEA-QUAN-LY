import { Request, Response, NextFunction } from 'express';
import { settingsService } from '../services/settings.service.js';
import { dataGovernanceService } from '../services/dataGovernance.service.js';
import { sendSuccess } from '../utils/response.js';

export const getSettings = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const settings = await settingsService.getSettings();
    sendSuccess(res, settings, 'Application settings loaded');
  } catch (error) {
    next(error);
  }
};

export const updateGeneralSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updated = await settingsService.updateGeneral(req.body);
    sendSuccess(res, updated, 'General settings updated');
  } catch (error) {
    next(error);
  }
};

export const updateNeedCategories = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updated = await settingsService.updateNeedCategories(req.body);
    sendSuccess(res, updated, 'Need categories updated');
  } catch (error) {
    next(error);
  }
};

export const updateStatusSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updated = await settingsService.updateStatuses(req.body);
    sendSuccess(res, updated, 'Status business configurations updated');
  } catch (error) {
    next(error);
  }
};

export const updateRecommendationSettings = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updated = await settingsService.updateRecommendationSettings(req.body);
    sendSuccess(res, updated, 'Recommendation rule weights & settings updated');
  } catch (error) {
    next(error);
  }
};

export const getDataStatus = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const [database, demoMode] = await Promise.all([
      dataGovernanceService.getDatabaseStatus(),
      dataGovernanceService.getDemoModeStatus(),
    ]);
    const backupGuidance = dataGovernanceService.getBackupGuidance();

    sendSuccess(
      res,
      {
        database,
        demoMode,
        backupGuidance,
      },
      'Data governance status loaded'
    );
  } catch (error) {
    next(error);
  }
};

export const exportData = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status, startDate, endDate } = req.query;
    const filters = {
      status: typeof status === 'string' ? status : undefined,
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
    };
    const exportBundle = await dataGovernanceService.exportAllData(filters);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="crm_export_${new Date().toISOString().slice(0, 10)}.json"`
    );
    sendSuccess(res, exportBundle, 'Database export generated successfully');
  } catch (error) {
    next(error);
  }
};
