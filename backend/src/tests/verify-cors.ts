import { createApp } from '../app.js';
import prisma from '../config/database.js';

const PORT = 5577;
const BASE_URL = `http://localhost:${PORT}`;

interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}

async function request(path: string, options: RequestInit = {}): Promise<HttpResponse> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
  });

  const headers: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  let body: any = null;
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  return { status: res.status, headers, body };
}

async function runCorsTests() {
  console.log('🧪 Starting CORS Configuration Verification Suite...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, errorDetail?: unknown) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`, errorDetail ? JSON.stringify(errorDetail, null, 2) : '');
      failed++;
    }
  }

  const app = createApp();
  const server = app.listen(PORT);

  try {
    // 1. A request from https://ktea-quan-ly.vercel.app receives the correct CORS header
    const res1 = await request('/api/health', {
      headers: { Origin: 'https://ktea-quan-ly.vercel.app' },
    });
    assert(
      res1.status === 200 &&
      res1.headers['access-control-allow-origin'] === 'https://ktea-quan-ly.vercel.app' &&
      !res1.headers['access-control-allow-credentials'],
      '1. Request from https://ktea-quan-ly.vercel.app receives exact Access-Control-Allow-Origin'
    );

    // 2. A request from http://localhost:5173 is allowed
    const res2 = await request('/api/health', {
      headers: { Origin: 'http://localhost:5173' },
    });
    assert(
      res2.status === 200 &&
      res2.headers['access-control-allow-origin'] === 'http://localhost:5173',
      '2. Request from http://localhost:5173 is allowed'
    );

    // 3. An unapproved origin is NOT granted access (no Access-Control-Allow-Origin header)
    const res3 = await request('/api/health', {
      headers: { Origin: 'https://malicious-attacker.com' },
    });
    assert(
      res3.status === 200 &&
      !res3.headers['access-control-allow-origin'],
      '3. Unapproved origin (https://malicious-attacker.com) does NOT receive Access-Control-Allow-Origin'
    );

    // 4. An OPTIONS preflight request works for the allowed origin
    const res4 = await request('/api/customers', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://ktea-quan-ly.vercel.app',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Content-Type,Authorization',
      },
    });
    assert(
      res4.status === 204 &&
      res4.headers['access-control-allow-origin'] === 'https://ktea-quan-ly.vercel.app' &&
      res4.headers['access-control-allow-methods']?.includes('GET') &&
      res4.headers['access-control-allow-headers']?.includes('Content-Type'),
      '4. OPTIONS preflight request returns 204 with allowed methods and headers'
    );

    // 5. /api/health returns the expected response (and root /health also works)
    const res5Api = await request('/api/health');
    const res5Root = await request('/health');
    assert(
      res5Api.status === 200 &&
      res5Api.body.success === true &&
      (res5Api.body.data?.status === 'healthy' || res5Api.body.data?.status === 'degraded') &&
      res5Root.status === 200 &&
      res5Root.body.success === true,
      '5. GET /api/health and GET /health return expected health payload'
    );

    // 6. CORS headers are present on relevant error responses where the request origin is allowed
    const res6 = await request('/api/customers/non-existent-uuid-12345', {
      headers: { Origin: 'https://ktea-quan-ly.vercel.app' },
    });
    assert(
      res6.status === 404 &&
      res6.headers['access-control-allow-origin'] === 'https://ktea-quan-ly.vercel.app',
      '6. CORS headers are present on 404 error responses for allowed origin'
    );

    // 7. Request without Origin header (e.g. server probe) is accepted without error
    const res7 = await request('/api/health');
    assert(
      res7.status === 200 &&
      !res7.headers['access-control-allow-origin'],
      '7. Request without Origin header succeeds without setting Access-Control-Allow-Origin'
    );

    console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runCorsTests().catch((err) => {
  console.error('CORS test suite error:', err);
  process.exit(1);
});
