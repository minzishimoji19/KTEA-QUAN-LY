import { createApp } from '../app.js';
import prisma from '../config/database.js';

const PORT = 5566;
const BASE_URL = `http://localhost:${PORT}/api`;

interface ApiResponsePayload {
  success: boolean;
  data?: any;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  message?: string;
}

async function request(path: string, options: RequestInit = {}): Promise<{ status: number; body: ApiResponsePayload }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    },
    ...options,
  });

  const body = (await res.json()) as ApiResponsePayload;
  return { status: res.status, body };
}

async function runTests() {
  console.log('🧪 Starting Customer Source Filter Verification Suite...\n');

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
    // Look up real source entities from DB
    const kteaSource = await prisma.customerSource.findFirst({ where: { name: 'KTEA' } });
    const vibTimesCitySource = await prisma.customerSource.findFirst({ where: { name: 'VIB Times City' } });
    const emptySource = await prisma.customerSource.findFirst({ where: { name: 'VIB Ocean City' } });

    if (!kteaSource || !vibTimesCitySource) {
      throw new Error('Required test sources KTEA and VIB Times City must exist in DB');
    }

    const kteaExpectedCount = await prisma.customer.count({ where: { sourceId: kteaSource.id } });
    const vibExpectedCount = await prisma.customer.count({ where: { sourceId: vibTimesCitySource.id } });
    const totalCustomerCount = await prisma.customer.count();

    console.log(`DB Stats: Total Customers = ${totalCustomerCount}, KTEA = ${kteaExpectedCount}, VIB Times City = ${vibExpectedCount}\n`);

    // 1. No source filter -> returns all matching customers
    const res1 = await request('/customers?page=1&pageSize=10');
    assert(
      res1.status === 200 &&
      res1.body.pagination?.total === totalCustomerCount &&
      res1.body.data.length === Math.min(10, totalCustomerCount),
      '1. No source filter -> returns all matching customers'
    );

    // 2. sourceId = KTEA -> only KTEA customers
    const res2 = await request(`/customers?page=1&pageSize=25&sourceId=${kteaSource.id}`);
    assert(
      res2.status === 200 &&
      res2.body.pagination?.total === kteaExpectedCount &&
      res2.body.data.length === Math.min(25, kteaExpectedCount) &&
      res2.body.data.every((c: any) => c.sourceId === kteaSource.id),
      '2. sourceId = KTEA -> only KTEA customers'
    );

    // 3. sourceId = VIB Times City -> only VIB Times City customers
    const res3 = await request(`/customers?page=1&pageSize=25&sourceId=${vibTimesCitySource.id}`);
    assert(
      res3.status === 200 &&
      res3.body.pagination?.total === vibExpectedCount &&
      res3.body.data.length === Math.min(25, vibExpectedCount) &&
      res3.body.data.every((c: any) => c.sourceId === vibTimesCitySource.id),
      '3. sourceId = VIB Times City -> only VIB Times City customers'
    );

    // 4. Invalid sourceId -> proper validation error
    const res4InvalidFormat = await request('/customers?sourceId=invalid-non-uuid-string');
    assert(
      res4InvalidFormat.status === 400 &&
      res4InvalidFormat.body.error?.code === 'BAD_REQUEST',
      '4a. Invalid sourceId format -> 400 BAD_REQUEST validation error'
    );

    const res4NotFound = await request('/customers?sourceId=00000000-0000-0000-0000-000000000000');
    assert(
      res4NotFound.status === 404 &&
      res4NotFound.body.error?.code === 'NOT_FOUND',
      '4b. Non-existent sourceId UUID -> 404 NOT_FOUND error'
    );

    // 5. Source + status -> AND behavior
    const kteaLeadMoiCount = await prisma.customer.count({
      where: { sourceId: kteaSource.id, overallStatus: 'LEAD_MOI' },
    });
    const res5 = await request(`/customers?sourceId=${kteaSource.id}&status=LEAD_MOI`);
    assert(
      res5.status === 200 &&
      res5.body.pagination?.total === kteaLeadMoiCount &&
      res5.body.data.every((c: any) => c.sourceId === kteaSource.id && c.overallStatus === 'LEAD_MOI'),
      `5. Source + status -> AND behavior (found ${res5.body.pagination?.total} items matching both conditions)`
    );

    // 6. Source + search -> AND behavior
    // Pick a search query that exists in KTEA
    const kteaCustomer = await prisma.customer.findFirst({ where: { sourceId: kteaSource.id } });
    const searchPart = kteaCustomer ? kteaCustomer.fullName.slice(0, 4) : 'Nguyen';
    const dbSearchAndSourceCount = await prisma.customer.count({
      where: {
        sourceId: kteaSource.id,
        OR: [
          { fullName: { contains: searchPart } },
          { phone: { contains: searchPart } },
          { email: { contains: searchPart } },
        ],
      },
    });
    const res6 = await request(`/customers?sourceId=${kteaSource.id}&search=${encodeURIComponent(searchPart)}`);
    assert(
      res6.status === 200 &&
      res6.body.pagination?.total === dbSearchAndSourceCount &&
      res6.body.data.every((c: any) => c.sourceId === kteaSource.id),
      `6. Source + search -> AND behavior (Total: ${res6.body.pagination?.total}, all match sourceId)`
    );

    // 7. Source + pagination -> correct total count and page data
    const res7Page1 = await request(`/customers?sourceId=${vibTimesCitySource.id}&page=1&pageSize=10`);
    const res7Page2 = await request(`/customers?sourceId=${vibTimesCitySource.id}&page=2&pageSize=10`);
    const page1Ids = new Set(res7Page1.body.data.map((c: any) => c.id));
    const page2Ids = new Set(res7Page2.body.data.map((c: any) => c.id));
    const hasOverlap = [...page1Ids].some((id) => page2Ids.has(id));

    assert(
      res7Page1.status === 200 &&
      res7Page2.status === 200 &&
      res7Page1.body.pagination?.total === vibExpectedCount &&
      res7Page2.body.pagination?.total === vibExpectedCount &&
      res7Page1.body.data.length === 10 &&
      res7Page2.body.data.length === 10 &&
      !hasOverlap,
      '7. Source + pagination -> correct total count, limit, offset across pages'
    );

    // 8. Source + sorting -> sorting still works
    const res8Asc = await request(`/customers?sourceId=${kteaSource.id}&sortBy=fullName&sortOrder=asc&pageSize=25`);
    const res8Desc = await request(`/customers?sourceId=${kteaSource.id}&sortBy=fullName&sortOrder=desc&pageSize=25`);
    const namesAsc: string[] = res8Asc.body.data.map((c: any) => c.fullName);
    const namesDesc: string[] = res8Desc.body.data.map((c: any) => c.fullName);
    const isSortedAsc = [...namesAsc].sort().join(',') === namesAsc.join(',');

    assert(
      res8Asc.status === 200 &&
      res8Desc.status === 200 &&
      res8Asc.body.data.every((c: any) => c.sourceId === kteaSource.id) &&
      res8Desc.body.data.every((c: any) => c.sourceId === kteaSource.id) &&
      namesAsc[0] !== namesDesc[0] &&
      isSortedAsc,
      '8. Source + sorting -> sorting still works alongside source filter'
    );

    // 9. No matching customers -> empty result, not all customers
    if (emptySource) {
      const res9 = await request(`/customers?sourceId=${emptySource.id}`);
      assert(
        res9.status === 200 &&
        res9.body.pagination?.total === 0 &&
        res9.body.data.length === 0,
        '9. No matching customers -> returns empty result (total=0, data=[]), not all customers'
      );
    } else {
      console.log('  ⚠️ Skipping test 9: no empty source in DB');
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test suite execution error:', err);
  process.exit(1);
});
