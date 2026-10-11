import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { corsOptions } from './config/cors.js';
import apiRoutes from './routes/index.js';
import { getHealth } from './controllers/health.controller.js';
import { errorHandler } from './middleware/errorHandler.js';
import { NotFoundError } from './utils/errors.js';

export const createApp = (): Express => {
  const app = express();

  // 1. Core Middlewares: CORS configuration & preflight
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 2. Request Logger (clean single-line format)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
    next();
  });

  // 3. Direct Health Probes (supports root /health as well as /api/health)
  app.get('/health', getHealth);

  // 4. Mount API Routes
  app.use('/api', apiRoutes);

  // 5. Catch-all 404 Handler for undefined API routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Endpoint ${req.method} ${req.originalUrl} not found`));
  });

  // 6. Centralized Error Handler
  app.use(errorHandler);

  return app;
};

export default createApp;
