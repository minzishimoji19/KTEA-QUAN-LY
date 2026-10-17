import http from 'http';
import { createApp } from '../app.js';
import prisma from '../config/database.js';
import { Role, UserStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { SESSION_COOKIE_NAME, createSessionToken } from '../utils/session.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failed++;
  }
}

async function runAuthVerification() {
  console.log('===============================================================');
  console.log('       KTEA CRM AUTHENTICATION & SESSION VERIFICATION SUITE    ');
  console.log('===============================================================');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as { address: string; port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;
  console.log(`[Test Server] Running at ${baseUrl}\n`);

  async function api(
    path: string,
    options: {
      method?: string;
      body?: any;
      cookie?: string;
      headers?: Record<string, string>;
    } = {}
  ) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    };
    if (options.cookie) {
      headers['Cookie'] = options.cookie;
    }
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    let body: any = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return {
      status: res.status,
      headers: res.headers,
      body,
    };
  }

  // Test credentials (internal test only, never production)
  const TEST_ADMIN_EMAIL = `test_admin_${Date.now()}@authtest.internal`;
  const TEST_PARTNER_EMAIL = `test_partner_${Date.now()}@authtest.internal`;
  const TEST_PASSWORD = 'TestPassword123!@#';

  let testAdminUser: any = null;
  let testPartnerUser: any = null;

  try {
    // Setup test users
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    testAdminUser = await prisma.user.create({
      data: {
        email: TEST_ADMIN_EMAIL,
        passwordHash,
        fullName: 'Test Admin User',
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    testPartnerUser = await prisma.user.create({
      data: {
        email: TEST_PARTNER_EMAIL,
        passwordHash,
        fullName: 'Test Partner User',
        role: Role.PARTNER,
        status: UserStatus.ACTIVE,
      },
    });

    console.log('--- 1. Testing Credential Verification ---');

    // 1.1 Wrong password -> 401
    const wrongPassRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: TEST_ADMIN_EMAIL, password: 'WrongPassword999!' },
    });
    assert(wrongPassRes.status === 401, 'Wrong password returns HTTP 401');
    assert(wrongPassRes.body.success === false, 'Wrong password response body has success: false');

    // 1.2 Non-existent user -> 401
    const wrongUserRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: 'nonexistent@authtest.internal', password: TEST_PASSWORD },
    });
    assert(wrongUserRes.status === 401, 'Non-existent user returns HTTP 401');

    // 1.3 Missing email/password -> 400
    const missingFieldRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: TEST_ADMIN_EMAIL },
    });
    assert(missingFieldRes.status === 400, 'Missing password field returns HTTP 400');

    // 1.4 Valid credentials -> 200 with cookie and session token
    const loginRes = await api('/api/auth/login', {
      method: 'POST',
      headers: { Origin: 'https://ktea-quan-ly.vercel.app' },
      body: { email: TEST_ADMIN_EMAIL, password: TEST_PASSWORD },
    });
    assert(loginRes.status === 200, 'Valid credentials login returns HTTP 200');
    assert(loginRes.body.success === true, 'Login response has success: true');
    assert(!!loginRes.body.data.token, 'Login response includes session token');
    assert(loginRes.body.data.user.email === TEST_ADMIN_EMAIL, 'Login response includes correct user');
    assert(!loginRes.body.data.user.passwordHash, 'Login response does NOT expose passwordHash');

    // Check Set-Cookie header
    const cookieHeader = loginRes.headers.get('set-cookie');
    assert(!!cookieHeader, 'Login response sets session cookie header');
    assert(cookieHeader!.includes(SESSION_COOKIE_NAME), 'Set-Cookie contains ktea_session cookie');

    const adminSessionToken = loginRes.body.data.token;
    const sessionCookie = cookieHeader ? cookieHeader.split(';')[0] : '';

    console.log('\n--- 2. Testing Session Verification (/api/auth/me) ---');

    // 2.1 Unauthenticated /me -> 401
    const unauthMe = await api('/api/auth/me');
    assert(unauthMe.status === 401, 'Unauthenticated /api/auth/me returns HTTP 401');

    // 2.2 /me with valid Cookie -> 200
    const cookieMe = await api('/api/auth/me', {
      cookie: sessionCookie,
    });
    assert(cookieMe.status === 200, '/api/auth/me with session Cookie returns HTTP 200');
    assert(cookieMe.body.data.user.email === TEST_ADMIN_EMAIL, '/api/auth/me returns admin user');
    assert(cookieMe.body.data.user.role === 'ADMIN', '/api/auth/me returns role ADMIN');
    assert(!cookieMe.body.data.user.passwordHash, '/api/auth/me does not expose passwordHash');

    // 2.3 /me with valid Bearer Token -> 200
    const bearerMe = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${adminSessionToken}` },
    });
    assert(bearerMe.status === 200, '/api/auth/me with Bearer token returns HTTP 200');
    assert(bearerMe.body.data.user.id === testAdminUser.id, '/api/auth/me Bearer returns matching user ID');

    // 2.4 /me with invalid / tampered token -> 401
    const tamperedMe = await api('/api/auth/me', {
      headers: { Authorization: 'Bearer invalid.tampered.token' },
    });
    assert(tamperedMe.status === 401, 'Tampered token returns HTTP 401');

    // 2.5 /me with expired token -> 401
    const expiredToken = createSessionToken(testAdminUser, -3600); // expired 1h ago
    const expiredMe = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(expiredMe.status === 401, 'Expired session token returns HTTP 401');

    console.log('\n--- 3. Testing Dashboard Access & RBAC ---');

    // 3.1 Unauthenticated dashboard -> 401
    const unauthDash = await api('/api/dashboard');
    assert(unauthDash.status === 401, 'Unauthenticated /api/dashboard returns HTTP 401');

    // 3.2 Authenticated ADMIN dashboard -> 200
    const adminDash = await api('/api/dashboard', {
      headers: { Authorization: `Bearer ${adminSessionToken}` },
    });
    assert(adminDash.status === 200, 'ADMIN access to /api/dashboard returns HTTP 200');
    assert(typeof adminDash.body.data?.overview?.totalCustomers === 'number', 'Dashboard returns overview metrics');

    // 3.3 Authenticated PARTNER login & dashboard attempt -> Scoped, cannot see system-wide data
    const partnerLoginRes = await api('/api/auth/login', {
      method: 'POST',
      body: { email: TEST_PARTNER_EMAIL, password: TEST_PASSWORD },
    });
    const partnerToken = partnerLoginRes.body.data.token;

    const partnerDash = await api('/api/dashboard', {
      headers: { Authorization: `Bearer ${partnerToken}` },
    });
    assert(partnerDash.status === 200, 'PARTNER call to /api/dashboard returns HTTP 200');
    assert(
      partnerDash.body.data?.overview?.totalCustomers === 0,
      'PARTNER cannot see system-wide customers (totalCustomers is 0, strictly scoped)'
    );

    console.log('\n--- 4. Testing CORS & Anti-CSRF Policies ---');

    // 4.1 Production origin allowed with credentials
    const corsRes = await api('/api/auth/session', {
      headers: { Origin: 'https://ktea-quan-ly.vercel.app' },
    });
    assert(
      corsRes.headers.get('access-control-allow-origin') === 'https://ktea-quan-ly.vercel.app',
      'CORS header correctly echoes allowed production origin'
    );
    assert(
      corsRes.headers.get('access-control-allow-credentials') === 'true',
      'CORS header has credentials: true'
    );

    // 4.2 Malicious/unauthorized origin rejected
    const unauthCors = await api('/api/auth/session', {
      headers: { Origin: 'https://evil-hacker-site.com' },
    });
    assert(
      !unauthCors.headers.get('access-control-allow-origin'),
      'Unauthorized origin does NOT receive access-control-allow-origin'
    );

    // 4.3 Anti-CSRF on mutating request with Cookie
    const noCsrfRes = await api('/api/users', {
      method: 'POST',
      cookie: sessionCookie,
      body: { email: 'csrf_test@authtest.internal', fullName: 'CSRF Test', password: 'Password123!' },
    });
    assert(noCsrfRes.status === 403, 'Cookie mutating request without X-KTEA-REQUEST rejected with HTTP 403');

    console.log('\n--- 5. Testing Logout ---');

    // 5.1 Logout with cookie
    const logoutRes = await api('/api/auth/logout', {
      method: 'POST',
      cookie: sessionCookie,
      headers: { 'X-KTEA-REQUEST': '1' },
    });
    assert(logoutRes.status === 200, 'Logout returns HTTP 200');

    console.log('\n===============================================================');
    console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('===============================================================');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    // Cleanup test users
    console.log('\n[Cleanup] Cleaning up internal test fixture accounts...');
    if (testAdminUser?.id) {
      await prisma.user.deleteMany({ where: { email: TEST_ADMIN_EMAIL } });
    }
    if (testPartnerUser?.id) {
      await prisma.user.deleteMany({ where: { email: TEST_PARTNER_EMAIL } });
    }
    await prisma.$disconnect();
    server.close();
    console.log('[Cleanup] Completed. Real customer and admin records untouched.');
  }
}

runAuthVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
