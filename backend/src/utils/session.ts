import crypto from 'crypto';
import { env } from '../config/env.js';
import { Role } from '@prisma/client';

export interface SessionPayload {
  userId: string;
  email: string;
  role: Role;
  fullName: string;
  iat: number;
  exp: number;
}

export const SESSION_COOKIE_NAME = 'ktea_session';
export const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 3600; // 7 days

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(input: string): string {
  let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Creates a stateless signed session token (HMAC-SHA256).
 */
export function createSessionToken(
  user: { id: string; email: string; role: Role; fullName: string },
  ttlSeconds: number = DEFAULT_SESSION_TTL_SECONDS
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    iat: now,
    exp: now + ttlSeconds,
  };

  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', env.SESSION_SECRET)
    .update(payloadEncoded)
    .digest();
  const signatureEncoded = base64UrlEncode(signature);

  return `${payloadEncoded}.${signatureEncoded}`;
}

/**
 * Verifies a signed session token, checking constant-time signature and expiration.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadEncoded, signatureEncoded] = parts;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', env.SESSION_SECRET)
      .update(payloadEncoded)
      .digest();
    const expectedSignatureEncoded = base64UrlEncode(expectedSignature);

    const bufExpected = Buffer.from(expectedSignatureEncoded);
    const bufReceived = Buffer.from(signatureEncoded);

    if (bufExpected.length !== bufReceived.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(bufExpected, bufReceived)) {
      return null;
    }

    const payloadJson = base64UrlDecode(payloadEncoded);
    const payload: SessionPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= now) {
      return null;
    }

    if (!payload.userId || !payload.role) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Cookie options matching architecture requirements (Cross-site Vercel <-> Render in production).
 */
export function getSessionCookieOptions() {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: DEFAULT_SESSION_TTL_SECONDS * 1000,
  };
}

export function getClearCookieOptions() {
  const isProd = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
  };
}
