import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { corsOptions } from './config/cors.js';
import apiRoutes from './routes/index.js';
import { getHealth } from './controllers/health.controller.js';
import { errorHandler } from './middleware/errorHandler.js';
import { NotFoundError } from './utils/errors.js';
import { apiLimiter } from './middleware/rateLimiter.js';

export const createApp = (): Express => {
  const app = express();

  // 1. Trust proxy for Render/Vercel reverse proxies
  app.set('trust proxy', 1);

  // 2. Security Headers via Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // 3. Core Middlewares: CORS configuration & preflight
  app.use(cors(corsOptions));
  app.options('*', cors(corsOptions));

  // 4. Cookie parsing for session cookies
  app.use(cookieParser());

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // 5. Request Logger (clean single-line format)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
    next();
  });

  // 6. Direct Health Probes (supports root /health as well as /api/health)
  app.get('/health', getHealth);

  // 7. Mount API Routes with Global API rate limiter
  app.use('/api', apiLimiter, apiRoutes);

  // 8. Catch-all 404 Handler for undefined API routes
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`Endpoint ${req.method} ${req.originalUrl} not found`));
  });

  // 9. Centralized Error Handler
  app.use(errorHandler);

  return app;
};

export default createApp;
