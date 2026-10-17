import { Request, Response, NextFunction } from 'express';
import { Role, UserStatus } from '@prisma/client';
import { verifySessionToken, SESSION_COOKIE_NAME, SessionPayload } from '../utils/session.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import prisma from '../config/database.js';

declare global {
  namespace Express {
    interface Request {
      user?: SessionPayload;
    }
  }
}

/**
 * Authentication Middleware: validates signed session cookie or Bearer token.
 * Also enforces custom header for anti-CSRF protection on cookie-authenticated requests.
 * Validates real-time user status in database to immediately invalidate revoked/suspended accounts.
 */
export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Allow OPTIONS preflight
    if (req.method === 'OPTIONS') {
      return next();
    }

    // 1. Extract session token from HttpOnly cookie or Authorization Bearer header
    const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    const rawToken = cookieToken || bearerToken;

    if (!rawToken) {
      throw new UnauthorizedError('Yêu cầu chưa được xác thực. Vui lòng đăng nhập.');
    }

    // 2. Verify signature and expiration
    const session = verifySessionToken(rawToken);
    if (!session) {
      throw new UnauthorizedError('Phiên làm việc không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.');
    }

    // 3. Verify user active status in database
    const dbUser = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, status: true, role: true, email: true, fullName: true },
    });

    if (!dbUser || dbUser.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedError('Tài khoản đã bị tạm khóa hoặc ngừng hoạt động.');
    }

    // 4. Anti-CSRF protection for cookie-authenticated mutating or protected requests
    if (cookieToken) {
      const csrfHeader = req.headers['x-ktea-request'];
      if (csrfHeader !== '1' && req.method !== 'GET' && req.method !== 'HEAD') {
        throw new ForbiddenError('Yêu cầu bị từ chối do thiếu header chống CSRF (X-KTEA-REQUEST).');
      }
    }

    // 5. Attach authenticated user payload to request (with up-to-date role from DB)
    req.user = {
      ...session,
      role: dbUser.role,
    };
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-Based Access Control (RBAC) Middleware.
 * Enforces that authenticated user possesses one of the allowed roles.
 */
export const requireRole = (...allowedRoles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Chưa xác thực danh tính người dùng');
    }

    if (!allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError('Bạn không có quyền thực hiện thao tác này');
    }

    next();
  };
};

/**
 * Convenience middleware for Admin-only routes.
 */
export const requireAdmin = requireRole(Role.ADMIN);
