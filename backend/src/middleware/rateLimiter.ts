import rateLimit from 'express-rate-limit';

/**
 * Strict rate limiting for login attempts to prevent brute-force attacks.
 * Max 5 failed attempts within 15 minutes per IP.
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Successful logins do not count against limit
  message: {
    status: 'error',
    statusCode: 429,
    code: 'TOO_MANY_REQUESTS',
    message: 'Quá nhiều lần thử đăng nhập thất bại. Vui lòng thử lại sau 15 phút.',
  },
});

/**
 * General API rate limiting to protect against automated scraping and DoS.
 * 120 requests per minute per IP.
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip health checks, preflight requests, and cron-worker
    return (
      req.method === 'OPTIONS' ||
      req.path === '/health' ||
      req.path === '/api/health' ||
      req.path === '/notifications/cron-worker' ||
      req.path === '/api/notifications/cron-worker'
    );
  },
  message: {
    status: 'error',
    statusCode: 429,
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Tần suất gửi yêu cầu quá cao. Vui lòng thử lại sau giây lát.',
  },
});
