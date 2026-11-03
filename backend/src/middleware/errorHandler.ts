import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { sendError } from '../utils/response.js';
import { env } from '../config/env.js';

function isDatabaseConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;

  const errorObj = err as Record<string, unknown>;
  const name = typeof errorObj.name === 'string' ? errorObj.name : '';
  if (name === 'PrismaClientInitializationError' || name === 'PrismaClientRustPanicError') {
    return true;
  }

  const code = (errorObj.code || errorObj.errorCode) as unknown;
  if (typeof code === 'string') {
    if (['P1000', 'P1001', 'P1002', 'P1003', 'P1008', 'P1017', 'P2024'].includes(code)) {
      return true;
    }
  }

  const msg = typeof errorObj.message === 'string' ? errorObj.message : '';
  if (
    msg.includes("Can't reach database server") ||
    msg.includes('connection timed out') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('database server is running at')
  ) {
    return true;
  }

  return false;
}

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

  // 1.5 JSON Body Parser Syntax Errors
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400) {
    sendError(res, 400, 'BAD_REQUEST', 'Dữ liệu JSON gửi lên không đúng định dạng');
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

  // 2.5 Database Connection / Initialization Errors
  if (isDatabaseConnectionError(err)) {
    console.error('[DATABASE_CONNECTION_ERROR]', err instanceof Error ? err.message : err);
    sendError(
      res,
      503,
      'DATABASE_UNAVAILABLE',
      'Hệ thống cơ sở dữ liệu tạm thời không thể kết nối. Vui lòng kiểm tra lại dịch vụ database hoặc liên hệ Quản trị viên.'
    );
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
  const isDev = env.NODE_ENV === 'development';
  let message = 'Internal server error';
  if (isDev) {
    const rawMsg = err.message || '';
    if (rawMsg.includes('Prisma') || rawMsg.includes('database') || rawMsg.includes('mysql-')) {
      message = 'Hệ thống cơ sở dữ liệu tạm thời không thể kết nối.';
    } else {
      message = rawMsg;
    }
  }

  sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    message,
    isDev && !isDatabaseConnectionError(err) ? { stack: err.stack } : undefined
  );
};
