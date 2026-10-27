import prisma from '../config/database.js';
import { NEEDS_ASSESSMENT_QUESTIONNAIRES } from './data/needsAssessmentQuestionnaires.js';
import {
  createQuestionnaireSchema,
  validateQuestionnaireDependencyGraph,
} from '../validations/questionnaire.validation.js';
import { QuestionnaireVersionStatus, Prisma } from '@prisma/client';

export interface SeedOptions {
  dryRun?: boolean;
  verbose?: boolean;
}

export interface SeedResultItem {
  code: string;
  title: string;
  action: 'CREATED' | 'SKIPPED_EXISTING' | 'DRY_RUN_VALIDATED';
  questionnaireId?: string;
  versionId?: string;
  questionCount: number;
  status: QuestionnaireVersionStatus;
}

/**
 * Seed 5 bộ khảo sát nhu cầu khách hàng vào hệ thống theo cơ chế an toàn, lũy tiến (idempotent).
 * - Trạng thái mặc định: DRAFT (Phiên bản khởi tạo v1, chưa xuất bản).
 * - Nhận diện qua `code`: nếu bộ câu hỏi đã tồn tại trong DB, bỏ qua (không ghi đè dữ liệu cũ).
 * - Kiểm tra Zod schema và chu trình DAG phụ thuộc trước khi tạo.
 */
export async function seedNeedsAssessmentQuestionnaires(
  options: SeedOptions = {}
): Promise<SeedResultItem[]> {
  const { dryRun = false, verbose = true } = options;
  const results: SeedResultItem[] = [];

  for (const qData of NEEDS_ASSESSMENT_QUESTIONNAIRES) {
    // 1. Zod schema validation
    const parsed = createQuestionnaireSchema.safeParse({
      code: qData.code,
      title: qData.title,
      description: qData.description,
      active: true,
      initialQuestions: qData.questions,
    });

    if (!parsed.success) {
      const errMsgs = parsed.error.issues.map((i) => `[${i.path.join('.')}] ${i.message}`).join('; ');
      throw new Error(`Dữ liệu bộ câu hỏi '${qData.code}' không hợp lệ: ${errMsgs}`);
    }

    // 2. DAG cycle check
    const graphCheck = validateQuestionnaireDependencyGraph(qData.questions);
    if (!graphCheck.isValid) {
      throw new Error(`Lỗi logic phụ thuộc trong bộ câu hỏi '${qData.code}': ${graphCheck.error}`);
    }

    // 3. Dry-run mode: chỉ kiểm tra tính hợp lệ
    if (dryRun) {
      results.push({
        code: qData.code,
        title: qData.title,
        action: 'DRY_RUN_VALIDATED',
        questionCount: qData.questions.length,
        status: QuestionnaireVersionStatus.DRAFT,
      });
      if (verbose) {
        console.log(`[DRY-RUN] ✓ Bộ câu hỏi hợp lệ: ${qData.code} (${qData.questions.length} câu hỏi)`);
      }
      continue;
    }

    // 4. Kiểm tra tồn tại trong DB
    const existing = await prisma.questionnaire.findUnique({
      where: { code: qData.code },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
          include: {
            _count: { select: { questions: true } },
          },
        },
      },
    });

    if (existing) {
      const latestVer = existing.versions[0];
      results.push({
        code: qData.code,
        title: qData.title,
        action: 'SKIPPED_EXISTING',
        questionnaireId: existing.id,
        versionId: latestVer?.id,
        questionCount: latestVer?._count.questions ?? 0,
        status: latestVer?.status ?? QuestionnaireVersionStatus.DRAFT,
      });
      if (verbose) {
        console.log(`[SEED] ↷ Đã tồn tại, bỏ qua: ${qData.code} (ID: ${existing.id})`);
      }
      continue;
    }

    // 5. Tạo mới Questionnaire + Bản nháp v1 + Danh sách câu hỏi trong transaction
    const created = await prisma.$transaction(async (tx) => {
      const questionnaire = await tx.questionnaire.create({
        data: {
          code: qData.code,
          title: qData.title,
          description: qData.description,
          active: true,
        },
      });

      const version = await tx.questionnaireVersion.create({
        data: {
          questionnaireId: questionnaire.id,
          versionNumber: 1,
          status: QuestionnaireVersionStatus.DRAFT,
          isCurrent: false,
          title: 'Phiên bản khởi tạo (Bản nháp)',
          description: qData.description,
          createdBy: 'Hệ thống (Seed Khảo sát nhu cầu)',
        },
      });

      for (let i = 0; i < qData.questions.length; i++) {
        const q = qData.questions[i];
        await tx.questionDefinition.create({
          data: {
            versionId: version.id,
            code: q.code,
            questionText: q.questionText,
            description: q.description || null,
            questionType: q.questionType,
            isRequired: q.isRequired ?? false,
            displayOrder: q.displayOrder ?? i + 1,
            options: q.options ? (q.options as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
            validationConfig: q.validationConfig
              ? (q.validationConfig as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            conditionalLogic: q.conditionalLogic
              ? (q.conditionalLogic as unknown as Prisma.InputJsonValue)
              : Prisma.JsonNull,
            active: q.active ?? true,
          },
        });
      }

      return { questionnaire, version };
    });

    results.push({
      code: qData.code,
      title: qData.title,
      action: 'CREATED',
      questionnaireId: created.questionnaire.id,
      versionId: created.version.id,
      questionCount: qData.questions.length,
      status: QuestionnaireVersionStatus.DRAFT,
    });

    if (verbose) {
      console.log(
        `[SEED] ✓ Đã tạo thành công: ${qData.code} - "${qData.title}" (${qData.questions.length} câu hỏi, Bản nháp v1)`
      );
    }
  }

  return results;
}

// Khi chạy trực tiếp qua CLI: `tsx src/scripts/seedNeedsAssessmentQuestionnaires.ts [--dry-run]`
if (process.argv[1]?.endsWith('seedNeedsAssessmentQuestionnaires.ts')) {
  const isDryRun = process.argv.includes('--dry-run');
  console.log(`========================================================================`);
  console.log(`   KTEA CRM — KHỞI TẠO 5 BỘ CÂU HỎI KHẢO SÁT NHU CẦU KHÁCH HÀNG       `);
  console.log(`   Chế độ: ${isDryRun ? 'DRY-RUN (Kiểm tra hợp lệ)' : 'THỰC THI GHI VÀO CƠ SỞ DỮ LIỆU'}`);
  console.log(`========================================================================`);

  seedNeedsAssessmentQuestionnaires({ dryRun: isDryRun })
    .then((res) => {
      console.log(`\nTổng kết kết quả:`);
      for (const item of res) {
        console.log(`  - [${item.action}] ${item.code}: ${item.questionCount} câu hỏi (${item.status})`);
      }
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n❌ Lỗi khi khởi tạo bộ câu hỏi:', err);
      process.exit(1);
    });
}
