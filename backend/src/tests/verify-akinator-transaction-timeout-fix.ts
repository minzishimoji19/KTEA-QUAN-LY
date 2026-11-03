/**
 * verify-akinator-transaction-timeout-fix.ts
 *
 * Verification suite for Prisma interactive transaction timeout fix and batching optimization
 * in Akinator repository:
 * 1. Successful creation of representative Akinator question config (25 questions)
 * 2. Correct persistence of question ordering and fields
 * 3. Mixed batch (update + create + delete) within single transaction
 * 4. Rollback atomicity on transaction failure (e.g. deletion of answered question)
 * 5. Large configuration batch (50 questions) executes rapidly without timeout
 * 6. Version cloning (createDraftConfig with sourceVersionId) runs cleanly
 */
import assert from 'assert';
import prisma from '../config/database.js';
import {
  AkinatorConfigStatus,
  AkinatorQuestionType,
  AkinatorCustomerFieldMapping,
  AkinatorQuizStatus,
} from '@prisma/client';
import { akinatorRepository, SaveAkinatorQuestionInput } from '../repositories/akinator.repository.js';
import { BadRequestError } from '../utils/errors.js';

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

async function main() {
  console.log('========================================================================');
  console.log('  AKINATOR PRISMA TRANSACTION BATCHING & TIMEOUT FIX VERIFICATION SUITE ');
  console.log('========================================================================\n');

  const createdVersionIds: string[] = [];

  try {
    // -----------------------------------------------------------------------
    // TEST 1: Representative configuration with 25 questions in draft
    // -----------------------------------------------------------------------
    let testDraftVersionId: string = '';

    await runTest('1. Create representative draft config with 25 questions via batch insert', async () => {
      const draft = await akinatorRepository.createDraftConfig({
        title: 'TEST_TX_BATCHING_DRAFT_V1',
        description: 'Test draft for batch transaction performance',
        maxQuestionsPerSession: 25,
      });
      testDraftVersionId = draft.id;
      createdVersionIds.push(draft.id);

      const questionsToSave: SaveAkinatorQuestionInput[] = Array.from({ length: 25 }, (_, i) => ({
        code: `q_test_${String(i + 1).padStart(2, '0')}`,
        questionText: `Câu hỏi kiểm thử số ${i + 1}?`,
        description: `Mô tả câu hỏi ${i + 1}`,
        questionType: i % 2 === 0 ? AkinatorQuestionType.SINGLE_CHOICE : AkinatorQuestionType.YES_NO,
        isEntryQuestion: i === 0,
        isRequiredForEval: i < 5,
        priorityWeight: 100 - i * 2,
        mapsToCustomerField: AkinatorCustomerFieldMapping.NONE,
        options: [
          { label: 'Lựa chọn A', value: 'A', score: 1 },
          { label: 'Lựa chọn B', value: 'B', score: 2 },
        ],
        validationConfig: { required: true },
        visibilityConditions: null,
        nextQuestionRules: null,
        active: true,
      }));

      const startTime = Date.now();
      const updated = await akinatorRepository.saveDraftQuestions(testDraftVersionId, questionsToSave);
      const durationMs = Date.now() - startTime;

      console.log(`    [Perf] 25 questions batch-saved in ${durationMs}ms`);
      assert.strictEqual(updated.questions.length, 25, 'Expected 25 questions saved');
      assert.ok(durationMs < 5000, `Expected duration under 5000ms, actual: ${durationMs}ms`);
    });

    // -----------------------------------------------------------------------
    // TEST 2: Correct persistence of ordering and relationships
    // -----------------------------------------------------------------------
    await runTest('2. Verify question ordering (isEntryQuestion desc, priorityWeight desc, code asc)', async () => {
      const loaded = await akinatorRepository.findConfigVersionById(testDraftVersionId);
      assert.ok(loaded, 'Config should exist');
      assert.strictEqual(loaded!.questions.length, 25);

      // First question should be the entry question
      assert.strictEqual(loaded!.questions[0].isEntryQuestion, true);
      assert.strictEqual(loaded!.questions[0].code, 'q_test_01');

      // Verify strict descending ordering of subsequent priorityWeights
      for (let i = 1; i < loaded!.questions.length - 1; i++) {
        const current = loaded!.questions[i];
        const next = loaded!.questions[i + 1];
        assert.ok(
          current.priorityWeight >= next.priorityWeight,
          `Ordering violation at index ${i}: ${current.priorityWeight} vs ${next.priorityWeight}`
        );
      }
    });

    // -----------------------------------------------------------------------
    // TEST 3: Mixed update + create + delete in a single batch
    // -----------------------------------------------------------------------
    await runTest('3. Mixed batch (update existing, create new, remove absent)', async () => {
      // Keep q_test_01 through q_test_15 (update their text)
      // Drop q_test_16 through q_test_25 (10 questions removed)
      // Add q_new_01 through q_new_05 (5 new questions created)
      const mixedQuestions: SaveAkinatorQuestionInput[] = [
        ...Array.from({ length: 15 }, (_, i) => ({
          code: `q_test_${String(i + 1).padStart(2, '0')}`,
          questionText: `Câu hỏi cập nhật số ${i + 1}`,
          questionType: AkinatorQuestionType.TEXT,
          isEntryQuestion: i === 0,
          priorityWeight: 90 - i,
          active: true,
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          code: `q_new_${String(i + 1).padStart(2, '0')}`,
          questionText: `Câu hỏi mới số ${i + 1}`,
          questionType: AkinatorQuestionType.YES_NO,
          priorityWeight: 50 - i,
          active: true,
        })),
      ];

      const startTime = Date.now();
      const updated = await akinatorRepository.saveDraftQuestions(testDraftVersionId, mixedQuestions);
      const durationMs = Date.now() - startTime;

      console.log(`    [Perf] Mixed batch (15 updates, 5 creates, 10 deletes) completed in ${durationMs}ms`);
      assert.strictEqual(updated.questions.length, 20, 'Expected 20 questions total');

      // Check updated question text
      const q1 = updated.questions.find((q) => q.code === 'q_test_01');
      assert.strictEqual(q1?.questionText, 'Câu hỏi cập nhật số 1');
      assert.strictEqual(q1?.questionType, AkinatorQuestionType.TEXT);

      // Check new question exists
      const qNew1 = updated.questions.find((q) => q.code === 'q_new_01');
      assert.ok(qNew1, 'New question q_new_01 must exist');

      // Check removed question does not exist
      const qOld16 = updated.questions.find((q) => q.code === 'q_test_16');
      assert.strictEqual(qOld16, undefined, 'q_test_16 must have been removed');
    });

    // -----------------------------------------------------------------------
    // TEST 4: Rollback atomicity on failure
    // -----------------------------------------------------------------------
    await runTest('4. Atomicity: rollback entire transaction when deleting answered question', async () => {
      // Find a question in draft
      const loaded = await akinatorRepository.findConfigVersionById(testDraftVersionId);
      const targetQuestion = loaded!.questions.find((q) => q.code === 'q_test_02')!;

      // Create a test session and a raw answer linked to targetQuestion
      const session = await prisma.akinatorSession.create({
        data: {
          sessionTokenHash: `test_token_hash_${Date.now()}`,
          configVersionId: testDraftVersionId,
          quizStatus: AkinatorQuizStatus.IN_PROGRESS,
        },
      });

      const rawAnswer = await prisma.akinatorRawAnswer.create({
        data: {
          sessionId: session.id,
          questionId: targetQuestion.id,
          questionCode: targetQuestion.code,
          questionTextSnapshot: targetQuestion.questionText,
          answerValue: { value: 'test' },
          stepOrder: 1,
        },
      });

      // Now attempt to save questions WITHOUT q_test_02 (which will attempt to delete it)
      // and ALSO includes a new question 'q_should_not_exist'.
      const failingBatch: SaveAkinatorQuestionInput[] = [
        {
          code: 'q_test_01',
          questionText: 'Should be rolled back',
          questionType: AkinatorQuestionType.YES_NO,
        },
        {
          code: 'q_should_not_exist',
          questionText: 'This must NOT be committed',
          questionType: AkinatorQuestionType.YES_NO,
        },
      ];

      let thrown = false;
      try {
        await akinatorRepository.saveDraftQuestions(testDraftVersionId, failingBatch);
      } catch (err: any) {
        thrown = true;
        assert.ok(
          err instanceof BadRequestError,
          `Expected BadRequestError, got: ${err.constructor.name}`
        );
        assert.ok(
          err.message.includes("Không thể xóa câu hỏi 'q_test_02'"),
          `Expected message regarding q_test_02, got: ${err.message}`
        );
      }
      assert.strictEqual(thrown, true, 'saveDraftQuestions must throw when deleting answered question');

      // VERIFY ROLLBACK: 'q_should_not_exist' must NOT exist in the database!
      const afterRollback = await akinatorRepository.findConfigVersionById(testDraftVersionId);
      const ghostQuestion = afterRollback!.questions.find((q) => q.code === 'q_should_not_exist');
      assert.strictEqual(ghostQuestion, undefined, 'Ghost question must not exist after rollback');

      // Target question must still exist
      const preservedQuestion = afterRollback!.questions.find((q) => q.code === 'q_test_02');
      assert.ok(preservedQuestion, 'q_test_02 must remain intact');

      // Clean up test answer and session
      await prisma.akinatorRawAnswer.delete({ where: { id: rawAnswer.id } });
      await prisma.akinatorSession.delete({ where: { id: session.id } });
    });

    // -----------------------------------------------------------------------
    // TEST 5: Large configuration batch (50 questions) without timeout
    // -----------------------------------------------------------------------
    await runTest('5. Large configuration (50 questions) executes rapidly without timeout', async () => {
      const largeDraft = await akinatorRepository.createDraftConfig({
        title: 'TEST_TX_LARGE_50_QUESTIONS',
        description: 'Stress testing 50 questions bulk create',
        maxQuestionsPerSession: 50,
      });
      createdVersionIds.push(largeDraft.id);

      const largeQuestions: SaveAkinatorQuestionInput[] = Array.from({ length: 50 }, (_, i) => ({
        code: `stress_q_${String(i + 1).padStart(2, '0')}`,
        questionText: `Stress question ${i + 1}?`,
        questionType: AkinatorQuestionType.SINGLE_CHOICE,
        isEntryQuestion: i === 0,
        priorityWeight: 100 - i,
        options: [{ label: 'Opt 1', value: '1' }],
        active: true,
      }));

      const startTime = Date.now();
      const updated = await akinatorRepository.saveDraftQuestions(largeDraft.id, largeQuestions);
      const durationMs = Date.now() - startTime;

      console.log(`    [Perf] 50 questions bulk inserted in ${durationMs}ms`);
      assert.strictEqual(updated.questions.length, 50, 'All 50 questions must be saved');
      // Must finish in well under 3 seconds (timeout is 15s, old code timed out at 5s on 20 questions)
      assert.ok(durationMs < 3000, `Expected 50 questions to save in < 3000ms, actual: ${durationMs}ms`);
    });

    // -----------------------------------------------------------------------
    // TEST 6: Version cloning with questions and rules
    // -----------------------------------------------------------------------
    await runTest('6. Clone version with questions and rules via createDraftConfig', async () => {
      // Source version is largeDraft (50 questions)
      const cloned = await akinatorRepository.createDraftConfig({
        title: 'TEST_TX_CLONED_VERSION',
        sourceVersionId: createdVersionIds[createdVersionIds.length - 1],
      });
      createdVersionIds.push(cloned.id);

      assert.strictEqual(cloned.questions.length, 50, 'Cloned version must have all 50 questions');
      assert.strictEqual(cloned.versionNumber > 0, true);
    });

    console.log(`\n========================================================================`);
    console.log(`   ALL TESTS PASSED: ${passedTests}/${totalTests}`);
    console.log(`========================================================================\n`);
  } finally {
    // Cleanup created test versions and their questions
    for (const vId of createdVersionIds) {
      try {
        await prisma.akinatorRawAnswer.deleteMany({
          where: { question: { configVersionId: vId } },
        });
        await prisma.akinatorSession.deleteMany({
          where: { configVersionId: vId },
        });
        await prisma.akinatorQuestion.deleteMany({
          where: { configVersionId: vId },
        });
        await prisma.akinatorRule.deleteMany({
          where: { configVersionId: vId },
        });
        await prisma.akinatorConfigVersion.delete({
          where: { id: vId },
        });
      } catch (e) {
        // ignore cleanup errors
      }
    }
  }
}

main()
  .catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
