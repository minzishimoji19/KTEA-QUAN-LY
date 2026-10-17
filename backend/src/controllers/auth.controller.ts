import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service.js';
import {
  createSessionToken,
  getSessionCookieOptions,
  getClearCookieOptions,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from '../utils/session.js';
import { sendSuccess } from '../utils/response.js';
import { BadRequestError } from '../utils/errors.js';
import { auditLogService } from '../services/auditLog.service.js';

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      throw new BadRequestError('Vui lòng cung cấp email và mật khẩu');
    }

    const user = await userService.authenticate(email, password);
    const sessionToken = createSessionToken(user);

    // Set signed HttpOnly secure session cookie
    res.cookie(SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions());

    await auditLogService.log({
      actorId: user.id,
      actorEmail: user.email,
      action: 'LOGIN_SUCCESS',
      entityType: 'User',
      entityId: user.id,
      ipAddress: req.ip,
    });

    sendSuccess(
      res,
      {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        },
        token: sessionToken,
      },
      'Đăng nhập thành công'
    );
  } catch (error) {
    next(error);
  }
};

export const getSession = async (req: Request, res: Response): Promise<void> => {
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const token = cookieToken || bearerToken;

  if (!token) {
    sendSuccess(res, { authenticated: false });
    return;
  }

  const session = verifySessionToken(token);
  if (!session) {
    sendSuccess(res, { authenticated: false });
    return;
  }

  sendSuccess(res, {
    authenticated: true,
    user: {
      id: session.userId,
      email: session.email,
      fullName: session.fullName,
      role: session.role,
    },
  });
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  const cookieToken = req.cookies?.[SESSION_COOKIE_NAME];
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  const token = cookieToken || bearerToken;

  if (token) {
    const session = verifySessionToken(token);
    if (session) {
      await auditLogService.log({
        actorId: session.userId,
        actorEmail: session.email,
        action: 'LOGOUT',
        entityType: 'User',
        entityId: session.userId,
        ipAddress: req.ip,
      });
    }
  }

  res.clearCookie(SESSION_COOKIE_NAME, getClearCookieOptions());
  sendSuccess(res, { success: true }, 'Đăng xuất thành công');
};

export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      sendSuccess(res, { authenticated: false });
      return;
    }

    sendSuccess(res, {
      user: {
        id: req.user.userId,
        email: req.user.email,
        fullName: req.user.fullName,
        role: req.user.role,
      },
    });
  } catch (error) {
    next(error);
  }
};
