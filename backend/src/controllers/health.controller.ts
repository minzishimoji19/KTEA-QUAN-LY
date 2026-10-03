import { Request, Response } from 'express';
import { sendSuccess } from '../utils/response.js';
import { env } from '../config/env.js';
import { checkDatabaseHealth } from '../utils/db.js';

export const getHealth = async (_req: Request, res: Response): Promise<Response> => {
  const dbHealth = await checkDatabaseHealth();

  const healthData = {
    status: dbHealth.connected ? 'healthy' : 'degraded',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    service: 'ktea-crm-backend',
    version: '1.0.0',
    database: dbHealth,
  };

  return sendSuccess(res, healthData, 'Service operational');
};
