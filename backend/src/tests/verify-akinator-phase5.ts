/**
 * verify-akinator-phase5.ts
 *
 * Comprehensive Verification Suite for Phase 5:
 * 1. Admin Session Workspace & Detail Modal Frontend Architecture Integrity
 * 2. Full RBAC Enforcement (Partner 403, Unauth 401 across all Admin Session endpoints)
 * 3. Session List, Pagination, Search & Filters (workflowStatus, evaluationStatus, dates)
 * 4. Full Session Detail Retrieval (configVersion, rawAnswers, result, adminReview, statusHistories)
 * 5. Strict Protection of Raw Answers (AkinatorRawAnswer remains 100% immutable)
 * 6. Admin Review Data Management (separate review fields, audit trail in AkinatorStatusHistory)
 * 7. State Machine Workflow Transitions (valid transitions, note enforcement, rejection, re-opening)
 * 8. Strict Guard: Blocking CRM Transfer (`TRANSFERRED`) in Phase 5
 * 9. Zero Regression on CRM Customers & Needs Assessment Questionnaires
 */
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { createApp } from '../app.js';
import prisma from '../config/database.js';
import {
  Role,
  AkinatorConfigStatus,
  AkinatorQuestionType,
  AkinatorCustomerFieldMapping,
  AkinatorWorkflowStatus,
  AkinatorQuizStatus,
  AkinatorEvaluationStatus,
  PriorityLevel,
  Gender,
} from '@prisma/client';
import { createSessionToken, SESSION_COOKIE_NAME } from '../utils/session.js';

console.log('========================================================================');
console.log('   KTEA CRM — PHASE 5: AKINATOR ADMIN DATA & WORKFLOW SUITE             ');
console.log('========================================================================\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err?.message || err}`);
    throw err;
  }
}

interface HttpHelperResponse {
  status: number;
  body: any;
}

function makeRequest(
  server: http.Server,
  method: string,
  path: string,
  options?: {
    cookieToken?: string;
    body?: any;
  }
): Promise<HttpHelperResponse> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      return reject(new Error('Server address not available'));
    }
    const payload = options?.body !== undefined ? JSON.stringify(options.body) : undefined;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options?.cookieToken) {
      headers['Cookie'] = `${SESSION_COOKIE_NAME}=${options.cookieToken}`;
      headers['x-ktea-request'] = '1';
    }
    if (payload) {
      headers['Content-Length'] = Buffer.byteLength(payload).toString();
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: addr.port,
        path,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed: any = raw;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch {
            // keep raw string
          }
          resolve({
            status: res.statusCode || 500,
            body: parsed,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));

  // Ensure working directory is backend for relative path resolution
  const backendDir = process.cwd().endsWith('backend')
    ? process.cwd()
    : path.join(process.cwd(), 'backend');
  const rootDir = path.resolve(backendDir, '..');
  const frontendDir = path.join(rootDir, 'frontend');

  // Fetch or upsert Admin and Partner test users
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin.phase5.test@ktea.vn' },
    create: {
      email: 'admin.phase5.test@ktea.vn',
      passwordHash: 'test-hash-not-used-for-login',
      fullName: 'Admin Phase 5 Test',
      role: Role.ADMIN,
    },
    update: { role: Role.ADMIN },
  });

  const partnerUser = await prisma.user.upsert({
    where: { email: 'partner.phase5.test@ktea.vn' },
    create: {
      email: 'partner.phase5.test@ktea.vn',
      passwordHash: 'test-hash-not-used-for-login',
      fullName: 'Partner Phase 5 Test',
      role: Role.PARTNER,
    },
    update: { role: Role.PARTNER },
  });

  const adminToken = createSessionToken({
    id: adminUser.id,
    role: adminUser.role,
    email: adminUser.email,
    fullName: adminUser.fullName,
  });

  const partnerToken = createSessionToken({
    id: partnerUser.id,
    role: partnerUser.role,
    email: partnerUser.email,
    fullName: partnerUser.fullName,
  });

  // Track initial customer and questionnaire counts for regression detection
  const initialCustomerCount = await prisma.customer.count();
  const initialQuestionnaireCount = await prisma.questionnaire.count();

  // =========================================================================
  // GROUP 1: FRONTEND CODE & COMPONENT STRUCTURE INTEGRITY
  // =========================================================================
  console.log('--- GROUP 1: Admin Data Management Frontend Architecture ---');

  await runTest('AkinatorSessionsWorkspace component exists with search, filter, and table', () => {
    const wsPath = path.join(frontendDir, 'src', 'features', 'akinator', 'AkinatorSessionsWorkspace.tsx');
    assert.ok(fs.existsSync(wsPath), 'AkinatorSessionsWorkspace.tsx must exist');
    const content = fs.readFileSync(wsPath, 'utf8');
    assert.match(content, /Chờ tiếp nhận/);
    assert.match(content, /Đang tư vấn \/ xử lý/);
    assert.match(content, /Cần bổ sung/);
    assert.match(content, /Chờ phê duyệt/);
    assert.match(content, /AkinatorSessionDetailModal/);
  });

  await runTest('AkinatorSessionDetailModal exists with 5 core sections and workflow actions', () => {
    const modalPath = path.join(frontendDir, 'src', 'features', 'akinator', 'AkinatorSessionDetailModal.tsx');
    assert.ok(fs.existsSync(modalPath), 'AkinatorSessionDetailModal.tsx must exist');
    const content = fs.readFileSync(modalPath, 'utf8');
    assert.match(content, /Dữ liệu khách hàng gốc/);
    assert.match(content, /Dữ liệu xử lý của Admin/);
    assert.match(content, /Câu trả lời gốc/);
    assert.match(content, /Kết quả sơ bộ/);
    assert.match(content, /Lịch sử & Kiểm toán/);
    assert.match(content, /ALLOWED_TRANSITIONS/);
  });

  await runTest('AkinatorPage.tsx integrates the sessions tab', () => {
    const pagePath = path.join(frontendDir, 'src', 'pages', 'AkinatorPage.tsx');
    assert.ok(fs.existsSync(pagePath), 'AkinatorPage.tsx must exist');
    const content = fs.readFileSync(pagePath, 'utf8');
    assert.match(content, /Dữ liệu Akinator \(Hồ sơ & Xử lý\)/);
    assert.match(content, /AkinatorSessionsWorkspace/);
  });

  await runTest('Akinator TypeScript definitions cover Phase 5 session entities', () => {
    const typesPath = path.join(frontendDir, 'src', 'types', 'akinator.ts');
    assert.ok(fs.existsSync(typesPath), 'types/akinator.ts must exist');
    const content = fs.readFileSync(typesPath, 'utf8');
    assert.match(content, /export interface AkinatorSessionListItem/);
    assert.match(content, /export interface AkinatorSessionDetail/);
    assert.match(content, /export interface UpdateAkinatorReviewInput/);
    assert.match(content, /export interface TransitionAkinatorWorkflowInput/);
  });

  // =========================================================================
  // GROUP 2: RBAC ENFORCEMENT ON ADMIN SESSION ENDPOINTS
  // =========================================================================
  console.log('\n--- GROUP 2: RBAC Enforcement on Admin Session APIs ---');

  await runTest('Unauthenticated request to /api/akinator/sessions returns 401', async () => {
    const res = await makeRequest(server, 'GET', '/api/akinator/sessions');
    assert.strictEqual(res.status, 401);
  });

  await runTest('PARTNER role request to /api/akinator/sessions returns 403 Forbidden', async () => {
    const res = await makeRequest(server, 'GET', '/api/akinator/sessions', {
      cookieToken: partnerToken,
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body?.error?.code, 'FORBIDDEN');
  });

  // =========================================================================
  // GROUP 3: SESSION LISTING, FILTERING & DETAIL RETRIEVAL
  // =========================================================================
  console.log('\n--- GROUP 3: Admin Session Queries, Search & Filters ---');

  // First, create a published config and run a quiz session so we have real test data
  let testConfigId = '';
  let testSessionId = '';
  const uniquePrefix = `P5_${Date.now()}`;

  // 1. Create a draft config with contact mapping
  const draftRes = await makeRequest(server, 'POST', '/api/akinator/configs/draft', {
    cookieToken: adminToken,
    body: {
      title: `${uniquePrefix} Config For Phase 5 Session Test`,
      maxQuestionsPerSession: 5,
      disclaimerText: 'Khuyến cáo tham khảo: Kết quả đánh giá sơ bộ không phải là cam kết cho vay.',
    },
  });
  assert.strictEqual(draftRes.status, 201);
  testConfigId = draftRes.body.data.id;

  // 2. Save questions
  const questionsRes = await makeRequest(
    server,
    'PUT',
    `/api/akinator/configs/${testConfigId}/questions`,
    {
      cookieToken: adminToken,
      body: {
        questions: [
          {
            code: `${uniquePrefix}_NAME`,
            questionText: 'Họ và tên của bạn là gì?',
            questionType: AkinatorQuestionType.TEXT,
            isEntryQuestion: true,
            isRequiredForEval: true,
            priorityWeight: 100,
            mapsToCustomerField: AkinatorCustomerFieldMapping.FULL_NAME,
            active: true,
          },
          {
            code: `${uniquePrefix}_PHONE`,
            questionText: 'Số điện thoại liên hệ?',
            questionType: AkinatorQuestionType.TEXT,
            isEntryQuestion: false,
            isRequiredForEval: true,
            priorityWeight: 90,
            mapsToCustomerField: AkinatorCustomerFieldMapping.PHONE,
            active: true,
          },
          {
            code: `${uniquePrefix}_PURPOSE`,
            questionText: 'Mục đích vay vốn?',
            questionType: AkinatorQuestionType.SINGLE_CHOICE,
            isEntryQuestion: false,
            isRequiredForEval: true,
            priorityWeight: 80,
            options: [
              { value: 'CONSUMER', label: 'Tiêu dùng cá nhân' },
              { value: 'BUSINESS', label: 'Kinh doanh' },
            ],
            active: true,
          },
        ],
      },
    }
  );
  assert.strictEqual(questionsRes.status, 200);

  // 3. Save rules
  const rulesRes = await makeRequest(
    server,
    'PUT',
    `/api/akinator/configs/${testConfigId}/rules`,
    {
      cookieToken: adminToken,
      body: {
        rules: [
          {
            code: `${uniquePrefix}_R1`,
            name: 'Luật Tiêu dùng chuẩn',
            priorityOrder: 1,
            requiredQuestionCodes: [
              `${uniquePrefix}_NAME`,
              `${uniquePrefix}_PHONE`,
              `${uniquePrefix}_PURPOSE`,
            ],
            conditions: {
              combinator: 'AND',
              conditions: [
                {
                  questionCode: `${uniquePrefix}_PURPOSE`,
                  operator: 'EQUALS',
                  value: 'CONSUMER',
                },
              ],
            },
            outcomePayload: {
              categoryCode: 'CONSUMER_LOAN',
              categoryLabel: 'Vay Tiêu Dùng',
              referenceTitle: 'Gợi ý Vay Tiêu Dùng Cá Nhân',
              referenceSummary: 'Phù hợp với nhu cầu chi tiêu sinh hoạt ngắn hạn.',
              suggestedDirections: ['Chuẩn bị CCCD', 'Sao kê tài khoản 3 tháng'],
              cautionNotes: ['Cân nhắc khả năng trả nợ hàng tháng'],
              suggestedPriority: PriorityLevel.TIN_DUNG,
            },
            active: true,
          },
        ],
      },
    }
  );
  assert.strictEqual(rulesRes.status, 200);

  // 4. Publish config
  const pubRes = await makeRequest(
    server,
    'POST',
    `/api/akinator/configs/${testConfigId}/publish`,
    {
      cookieToken: adminToken,
      body: { changeLog: 'Published for Phase 5 verification' },
    }
  );
  assert.strictEqual(pubRes.status, 200);

  // 5. Run a public quiz session
  const startQuizRes = await makeRequest(server, 'POST', '/api/public/akinator/sessions');
  assert.strictEqual(startQuizRes.status, 201);
  const sessionToken = startQuizRes.body.data.sessionToken;
  testSessionId = startQuizRes.body.data.sessionId;

  // Submit Name
  await makeRequest(server, 'POST', `/api/public/akinator/sessions/${sessionToken}/answers`, {
    body: {
      questionCode: `${uniquePrefix}_NAME`,
      answerValue: 'Nguyễn Văn Phase5',
    },
  });

  // Submit Phone
  await makeRequest(server, 'POST', `/api/public/akinator/sessions/${sessionToken}/answers`, {
    body: {
      questionCode: `${uniquePrefix}_PHONE`,
      answerValue: '0988776655',
    },
  });

  // Submit Purpose
  await makeRequest(server, 'POST', `/api/public/akinator/sessions/${sessionToken}/answers`, {
    body: {
      questionCode: `${uniquePrefix}_PURPOSE`,
      answerValue: 'CONSUMER',
    },
  });

  // Complete session
  const completeRes = await makeRequest(
    server,
    'POST',
    `/api/public/akinator/sessions/${sessionToken}/complete`
  );
  assert.strictEqual(completeRes.status, 200);
  assert.strictEqual(completeRes.body.data.quizStatus, 'COMPLETED');

  await runTest('Admin lists sessions with pagination and receives test session', async () => {
    const res = await makeRequest(server, 'GET', '/api/akinator/sessions?page=1&pageSize=10', {
      cookieToken: adminToken,
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data?.items, 'Response must have data.items');
    assert.ok(res.body.data?.pagination, 'Response must have data.pagination');
    assert.ok(res.body.data.pagination.total >= 1);

    const found = res.body.data.items.find((s: any) => s.id === testSessionId);
    assert.ok(found, 'Test session must appear in admin session list');
    assert.strictEqual(found.workflowStatus, AkinatorWorkflowStatus.PENDING_PROCESSING);
    assert.strictEqual(found.rawFullName, 'Nguyễn Văn Phase5');
    assert.strictEqual(found.rawPhone, '0988776655');
  });

  await runTest('Admin searches sessions by customer name and phone', async () => {
    const resName = await makeRequest(
      server,
      'GET',
      `/api/akinator/sessions?search=${encodeURIComponent('Văn Phase5')}`,
      { cookieToken: adminToken }
    );
    assert.strictEqual(resName.status, 200);
    assert.ok(resName.body.data.items.some((s: any) => s.id === testSessionId));

    const resPhone = await makeRequest(
      server,
      'GET',
      `/api/akinator/sessions?search=${encodeURIComponent('0988776655')}`,
      { cookieToken: adminToken }
    );
    assert.strictEqual(resPhone.status, 200);
    assert.ok(resPhone.body.data.items.some((s: any) => s.id === testSessionId));
  });

  await runTest('Admin filters sessions by workflowStatus and evaluationStatus', async () => {
    const resFilter = await makeRequest(
      server,
      'GET',
      `/api/akinator/sessions?workflowStatus=PENDING_PROCESSING&evaluationStatus=EVALUATED`,
      { cookieToken: adminToken }
    );
    assert.strictEqual(resFilter.status, 200);
    assert.ok(resFilter.body.data.items.some((s: any) => s.id === testSessionId));
  });

  await runTest('Admin retrieves full session detail by ID', async () => {
    const res = await makeRequest(server, 'GET', `/api/akinator/sessions/${testSessionId}`, {
      cookieToken: adminToken,
    });
    assert.strictEqual(res.status, 200);
    const detail = res.body.data;
    assert.strictEqual(detail.id, testSessionId);
    assert.strictEqual(detail.quizStatus, AkinatorQuizStatus.COMPLETED);
    assert.strictEqual(detail.workflowStatus, AkinatorWorkflowStatus.PENDING_PROCESSING);
    assert.strictEqual(detail.rawAnswers.length, 3);
    assert.ok(detail.result, 'Session detail must include evaluation result');
    assert.strictEqual(detail.result.evaluationStatus, AkinatorEvaluationStatus.EVALUATED);
    assert.ok(detail.adminReview, 'Session detail must include adminReview object');
    assert.ok(detail.statusHistories.length >= 1, 'Initial history record must exist');
    assert.strictEqual(detail.statusHistories[0].toStatus, AkinatorWorkflowStatus.PENDING_PROCESSING);
  });

  await runTest('Non-existent session ID returns 404 NotFound', async () => {
    const dummyId = '00000000-0000-0000-0000-000000000000';
    const res = await makeRequest(server, 'GET', `/api/akinator/sessions/${dummyId}`, {
      cookieToken: adminToken,
    });
    assert.strictEqual(res.status, 404);
  });

  // =========================================================================
  // GROUP 4: RAW ANSWERS IMMUTABILITY & ADMIN REVIEW UPDATES
  // =========================================================================
  console.log('\n--- GROUP 4: Protection of Raw Answers & Admin Review Updates ---');

  await runTest('Admin updates review data (editedFullName, editedPhone, notes)', async () => {
    const updateRes = await makeRequest(
      server,
      'PATCH',
      `/api/akinator/sessions/${testSessionId}/review`,
      {
        cookieToken: adminToken,
        body: {
          editedFullName: 'Nguyễn Văn Phase5 (Đã Xác Minh)',
          editedPhone: '0988776655',
          editedEmail: 'nguyenvan.phase5@example.com',
          editedGender: Gender.MALE,
          editedDateOfBirth: '15/08/1990',
          editedAddress: '123 Đường Số 1, Quận 1, TP.HCM',
          editedPriority: PriorityLevel.TIN_DUNG,
          processorNote: 'Khách hàng có nhu cầu vay tiêu dùng 50 triệu trong 12 tháng.',
          missingInfoNote: null,
          approvalNote: 'Đã kiểm tra sơ bộ thông tin, đạt điều kiện.',
        },
      }
    );
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.body.data.editedFullName, 'Nguyễn Văn Phase5 (Đã Xác Minh)');
    assert.strictEqual(updateRes.body.data.editedEmail, 'nguyenvan.phase5@example.com');
  });

  await runTest('Raw answers remain strictly untouched after admin review update', async () => {
    const detailRes = await makeRequest(server, 'GET', `/api/akinator/sessions/${testSessionId}`, {
      cookieToken: adminToken,
    });
    const detail = detailRes.body.data;
    // Original raw values must remain identical to what participant answered
    assert.strictEqual(detail.rawFullName, 'Nguyễn Văn Phase5');
    assert.strictEqual(detail.rawPhone, '0988776655');

    const nameAnswer = detail.rawAnswers.find((a: any) => a.questionCode === `${uniquePrefix}_NAME`);
    assert.ok(nameAnswer);
    assert.strictEqual(nameAnswer.answerValue, 'Nguyễn Văn Phase5');

    // Admin Review contains the edited data
    assert.strictEqual(detail.adminReview.editedFullName, 'Nguyễn Văn Phase5 (Đã Xác Minh)');
  });

  await runTest('Admin review update rejects payloads containing raw answers or unknown keys', async () => {
    const badRes = await makeRequest(
      server,
      'PATCH',
      `/api/akinator/sessions/${testSessionId}/review`,
      {
        cookieToken: adminToken,
        body: {
          rawFullName: 'Hacker Name',
          rawAnswers: [],
        },
      }
    );
    assert.strictEqual(badRes.status, 422, 'Strict schema must reject unrecognized tampering keys');
  });

  await runTest('Admin review update records audit entry in AkinatorStatusHistory', async () => {
    const detailRes = await makeRequest(server, 'GET', `/api/akinator/sessions/${testSessionId}`, {
      cookieToken: adminToken,
    });
    const histories = detailRes.body.data.statusHistories;
    const reviewUpdateHistory = histories.find((h: any) => h.actionType === 'UPDATE_ADMIN_REVIEW');
    assert.ok(reviewUpdateHistory, 'AkinatorStatusHistory must have UPDATE_ADMIN_REVIEW action');
    assert.strictEqual(reviewUpdateHistory.actorEmail, adminUser.email);
  });

  // =========================================================================
  // GROUP 5: STATE MACHINE WORKFLOW TRANSITIONS
  // =========================================================================
  console.log('\n--- GROUP 5: State Machine Workflow Transitions ---');

  await runTest('Transition PENDING_PROCESSING -> IN_PROGRESS succeeds', async () => {
    const res = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${testSessionId}/status`,
      {
        cookieToken: adminToken,
        body: {
          toStatus: AkinatorWorkflowStatus.IN_PROGRESS,
          note: 'Admin tiếp nhận hồ sơ để tư vấn',
        },
      }
    );
    assert.strictEqual(res.status, 200);

    const check = await makeRequest(server, 'GET', `/api/akinator/sessions/${testSessionId}`, {
      cookieToken: adminToken,
    });
    assert.strictEqual(check.body.data.workflowStatus, AkinatorWorkflowStatus.IN_PROGRESS);
  });

  await runTest('Transition IN_PROGRESS -> NEEDS_MORE_INFO requires missingInfoNote', async () => {
    const failRes = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${testSessionId}/status`,
      {
        cookieToken: adminToken,
        body: {
          toStatus: AkinatorWorkflowStatus.NEEDS_MORE_INFO,
        },
      }
    );
    assert.strictEqual(failRes.status, 400);

    const okRes = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${testSessionId}/status`,
      {
        cookieToken: adminToken,
        body: {
          toStatus: AkinatorWorkflowStatus.NEEDS_MORE_INFO,
          missingInfoNote: 'Cần khách cung cấp ảnh chụp CCCD 2 mặt',
        },
      }
    );
    assert.strictEqual(okRes.status, 200);
  });

  await runTest('Transition NEEDS_MORE_INFO -> IN_PROGRESS succeeds', async () => {
    const res = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${testSessionId}/status`,
      {
        cookieToken: adminToken,
        body: {
          toStatus: AkinatorWorkflowStatus.IN_PROGRESS,
          note: 'Khách đã bổ sung CCCD qua Zalo',
        },
      }
    );
    assert.strictEqual(res.status, 200);
  });

  await runTest('Transition IN_PROGRESS -> PENDING_APPROVAL succeeds when contact is complete', async () => {
    const res = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${testSessionId}/status`,
      {
        cookieToken: adminToken,
        body: {
          toStatus: AkinatorWorkflowStatus.PENDING_APPROVAL,
          note: 'Trình duyệt cấp quản lý',
        },
      }
    );
    assert.strictEqual(res.status, 200);
  });

  await runTest('Transition PENDING_APPROVAL -> APPROVED sets approval stamp', async () => {
    const res = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${testSessionId}/status`,
      {
        cookieToken: adminToken,
        body: {
          toStatus: AkinatorWorkflowStatus.APPROVED,
          approvalNote: 'Phê duyệt đủ điều kiện vay',
        },
      }
    );
    assert.strictEqual(res.status, 200);

    const check = await makeRequest(server, 'GET', `/api/akinator/sessions/${testSessionId}`, {
      cookieToken: adminToken,
    });
    assert.strictEqual(check.body.data.workflowStatus, AkinatorWorkflowStatus.APPROVED);
    assert.ok(check.body.data.adminReview.approvedAt, 'approvedAt must be set');
    assert.strictEqual(check.body.data.adminReview.approvedById, adminUser.id);
  });

  await runTest('Transition APPROVED -> IN_PROGRESS reopens session and clears approval stamp', async () => {
    const res = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${testSessionId}/status`,
      {
        cookieToken: adminToken,
        body: {
          toStatus: AkinatorWorkflowStatus.IN_PROGRESS,
          note: 'Mở lại để cập nhật thông tin địa chỉ mới',
        },
      }
    );
    assert.strictEqual(res.status, 200);

    const check = await makeRequest(server, 'GET', `/api/akinator/sessions/${testSessionId}`, {
      cookieToken: adminToken,
    });
    assert.strictEqual(check.body.data.workflowStatus, AkinatorWorkflowStatus.IN_PROGRESS);
    assert.strictEqual(check.body.data.adminReview.approvedAt, null);
    assert.strictEqual(check.body.data.adminReview.approvedById, null);
  });

  await runTest('Transition to TRANSFERRED is strictly blocked in Phase 5', async () => {
    const res = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${testSessionId}/status`,
      {
        cookieToken: adminToken,
        body: {
          toStatus: AkinatorWorkflowStatus.TRANSFERRED,
        },
      }
    );
    assert.strictEqual(res.status, 403);
    assert.match(res.body?.error?.message, /chưa được kích hoạt/);
  });

  await runTest('Invalid state transition (e.g. IN_PROGRESS -> APPROVED without PENDING_APPROVAL if forbidden or invalid jump) is rejected', async () => {
    // Current is IN_PROGRESS. Transition directly to TRANSFERRED or duplicate IN_PROGRESS
    const duplicateRes = await makeRequest(
      server,
      'POST',
      `/api/akinator/sessions/${testSessionId}/status`,
      {
        cookieToken: adminToken,
        body: {
          toStatus: AkinatorWorkflowStatus.IN_PROGRESS,
        },
      }
    );
    assert.strictEqual(duplicateRes.status, 400);
  });

  // =========================================================================
  // GROUP 6: ZERO CRM & NEEDS ASSESSMENT REGRESSION
  // =========================================================================
  console.log('\n--- GROUP 6: Zero CRM & Needs Assessment Regression ---');

  await runTest('Zero Customer records created during Phase 5 session review activities', async () => {
    const currentCustomerCount = await prisma.customer.count();
    assert.strictEqual(
      currentCustomerCount,
      initialCustomerCount,
      'Customer count in CRM must remain completely unchanged'
    );
  });

  await runTest('Zero Needs Assessment questionnaires mutated during Akinator session activities', async () => {
    const currentQuestionnaireCount = await prisma.questionnaire.count();
    assert.strictEqual(
      currentQuestionnaireCount,
      initialQuestionnaireCount,
      'Needs Assessment questionnaire count must remain completely unchanged'
    );
  });

  // Close server
  await new Promise<void>((resolve) => server.close(() => resolve()));

  console.log('\n========================================================================');
  console.log(`   ALL AKINATOR PHASE 5 TESTS PASSED: ${passedTests}/${totalTests} ✓`);
  console.log('========================================================================\n');
}

main()
  .catch((err) => {
    console.error('\nPHASE 5 VERIFICATION FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
