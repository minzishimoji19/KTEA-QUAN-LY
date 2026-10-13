import cors from 'cors';
import { env } from './env.js';

/**
 * Explicit default allowed origins for production and local development.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'https://ktea-quan-ly.vercel.app',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

/**
 * Normalizes an origin string by trimming whitespace and removing trailing slashes.
 */
export function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

/**
 * Parses and returns the set of valid allowed origins from configuration and defaults.
 * Supports single origins, comma-separated lists, and handles trailing slashes/whitespace.
 */
export function getAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  // 1. Add baseline production & development origins
  for (const o of DEFAULT_ALLOWED_ORIGINS) {
    origins.add(normalizeOrigin(o));
  }

  // 2. Parse CORS_ORIGIN from environment (handles comma-separated and whitespace)
  if (env.CORS_ORIGIN) {
    env.CORS_ORIGIN.split(',').forEach((item) => {
      const trimmed = normalizeOrigin(item);
      if (trimmed) origins.add(trimmed);
    });
  }

  // 3. Parse FRONTEND_API_URL from environment
  if (env.FRONTEND_API_URL) {
    env.FRONTEND_API_URL.split(',').forEach((item) => {
      const trimmed = normalizeOrigin(item);
      if (trimmed) origins.add(trimmed);
    });
  }

  return origins;
}

const allowedOrigins = getAllowedOrigins();

/**
 * Production-ready CORS configuration options.
 */
export const corsOptions: cors.CorsOptions = {
  origin: (requestOrigin, callback) => {
    // Allow non-browser requests without Origin header (e.g., curl, Render health probes, server-side monitoring)
    if (!requestOrigin) {
      return callback(null, true);
    }

    const normalized = normalizeOrigin(requestOrigin);

    // Exact match against allowed origins
    if (allowedOrigins.has(normalized)) {
      return callback(null, true);
    }

    // Match Vercel preview deployment URLs for ktea-quan-ly
    if (/^https:\/\/ktea-quan-ly-[a-zA-Z0-9_-]+\.vercel\.app$/.test(normalized)) {
      return callback(null, true);
    }

    // Do not reflect unapproved origins; omit Access-Control-Allow-Origin
    return callback(null, false);
  },
  credentials: false, // CRM uses token/header auth, not cross-origin cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-passkey',
    'x-cron-secret',
    'Cache-Control',
    'Pragma',
    'If-Modified-Since',
  ],
  optionsSuccessStatus: 204,
  maxAge: 86400, // 24 hours
};
