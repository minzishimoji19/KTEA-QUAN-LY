import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';
import { env } from '../config/env.js';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // If response headers already sent, delegate to default Express handler
  if (res.headersSent) {
    return _next(err);
  }

  // 1. Handled Operational Errors
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // 2. Direct Zod Validation Errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 422, 'VALIDATION_ERROR', 'Request validation failed', details);
    return;
  }

  // 3. Prisma Known Errors
  if ('code' in err && typeof (err as { code: unknown }).code === 'string') {
    const prismaErr = err as { code: string; meta?: Record<string, unknown> };
    if (prismaErr.code === 'P2002') {
      sendError(res, 409, 'UNIQUE_CONSTRAINT_VIOLATION', 'A record with this unique value already exists.', prismaErr.meta);
      return;
    }
    if (prismaErr.code === 'P2025') {
      sendError(res, 404, 'RECORD_NOT_FOUND', 'Requested database record was not found.', prismaErr.meta);
      return;
    }
  }

  // 4. Unhandled / Unexpected Server Errors
  console.error('Unhandled Server Error:', err);
  const message = env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    message,
    env.NODE_ENV === 'development' ? { stack: err.stack } : undefined
  );
};
