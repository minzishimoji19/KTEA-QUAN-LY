import { assessmentRepository } from '../repositories/assessment.repository.js';
import { questionnaireRepository } from '../repositories/questionnaire.repository.js';
import prisma from '../config/database.js';
import { customerAccessService } from './customerAccess.service.js';
import {
  validateAssessmentAnswers,
  QuestionEvalContext,
} from '../validations/assessment.validation.js';
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from '../utils/errors.js';
import { AssessmentStatus, QuestionnaireVersionStatus, Role } from '@prisma/client';

export interface UserContext {
  id: string;
  role: Role;
  email?: string;
}

export const assessmentService = {
  async getAssessmentsByCustomerId(customerId: string, user: UserContext) {
    await customerAccessService.assertCustomerAccess(user, customerId);

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundError(`Khách hàng không tồn tại`);
    }

    return assessmentRepository.findByCustomerId(customerId);
  },

  async getAssessmentById(assessmentId: string, user: UserContext) {
    const assessment = await assessmentRepository.findById(assessmentId);
    if (!assessment) {
      throw new NotFoundError(`Không tìm thấy bài đánh giá nhu cầu với ID: ${assessmentId}`);
    }

    await customerAccessService.assertCustomerAccess(user, assessment.customerId);

    return assessment;
  },

  async startAssessment(
    customerId: string,
    user: UserContext,
    input: {
      questionnaireId?: string;
      questionnaireVersionId?: string;
      notes?: string | null;
    }
  ) {
    await customerAccessService.assertCustomerAccess(user, customerId);

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, fullName: true },
    });
    if (!customer) {
      throw new NotFoundError(`Khách hàng không tồn tại`);
    }

    let versionId = input.questionnaireVersionId;

    if (versionId) {
      const version = await questionnaireRepository.findVersionById(versionId);
      if (!version) {
        throw new NotFoundError(`Phiên bản câu hỏi không tồn tại`);
      }
      if (version.status !== QuestionnaireVersionStatus.PUBLISHED) {
        throw new BadRequestError('Chỉ có thể bắt đầu khảo sát từ phiên bản câu hỏi đã xuất bản (PUBLISHED)');
      }
    } else if (input.questionnaireId) {
      const currentPub = await questionnaireRepository.findCurrentPublishedVersion(input.questionnaireId);
      if (!currentPub) {
        throw new BadRequestError('Bộ câu hỏi này chưa có phiên bản nào được xuất bản chính thức');
      }
      versionId = currentPub.id;
    } else {
      throw new BadRequestError('Cần cung cấp questionnaireId hoặc questionnaireVersionId');
    }

    return assessmentRepository.create({
      customerId,
      questionnaireVersionId: versionId,
      performedById: user.id,
      notes: input.notes,
    });
  },

  async saveAnswers(
    assessmentId: string,
    user: UserContext,
    answers: Array<{ questionCode: string; questionId?: string | null; answerValue: any }>,
    notes?: string | null
  ) {
    const assessment = await this.getAssessmentById(assessmentId, user);

    // IMMUTABILITY GUARD: Completed assessments cannot be modified!
    if (assessment.status === AssessmentStatus.COMPLETED) {
      throw new BadRequestError(
        'Khảo sát nhu cầu này đã hoàn thành và được khóa bất biến. Không thể chỉnh sửa câu trả lời.'
      );
    }
    if (assessment.status === AssessmentStatus.CANCELLED) {
      throw new BadRequestError('Khảo sát này đã bị hủy, không thể cập nhật.');
    }

    const questions: QuestionEvalContext[] = (assessment.questionnaireVersion.questions || []).map(
      (q) => ({
        id: q.id,
        code: q.code,
        questionText: q.questionText,
        questionType: q.questionType,
        isRequired: q.isRequired,
        displayOrder: q.displayOrder,
        options: q.options as any,
        validationConfig: q.validationConfig as any,
        conditionalLogic: q.conditionalLogic as any,
        active: q.active,
      })
    );

    // Run draft validation (lenient, allows partial progress save)
    const validationResult = validateAssessmentAnswers(questions, answers, 'DRAFT');
    if (!validationResult.isValid) {
      throw new BadRequestError(
        `Lỗi xác thực câu trả lời: ${validationResult.errors.join('; ')}`
      );
    }

    return assessmentRepository.saveAnswers(assessmentId, validationResult.cleanAnswers, notes);
  },

  async completeAssessment(
    assessmentId: string,
    user: UserContext,
    submittedAnswers?: Array<{ questionCode: string; questionId?: string | null; answerValue: any }>,
    notes?: string | null
  ) {
    const assessment = await this.getAssessmentById(assessmentId, user);

    if (assessment.status === AssessmentStatus.COMPLETED) {
      return assessment; // Idempotent
    }
    if (assessment.status === AssessmentStatus.CANCELLED) {
      throw new BadRequestError('Khảo sát này đã bị hủy, không thể hoàn thành.');
    }

    // Merge already saved answers with any newly submitted answers in request
    const answerMap = new Map<string, { questionCode: string; questionId?: string | null; answerValue: any }>();

    for (const a of assessment.answers || []) {
      answerMap.set(a.questionCode, {
        questionCode: a.questionCode,
        questionId: a.questionId,
        answerValue: a.answerValue,
      });
    }

    if (submittedAnswers && submittedAnswers.length > 0) {
      for (const sa of submittedAnswers) {
        answerMap.set(sa.questionCode, sa);
      }
    }

    const allAnswers = Array.from(answerMap.values());

    const questions: QuestionEvalContext[] = (assessment.questionnaireVersion.questions || []).map(
      (q) => ({
        id: q.id,
        code: q.code,
        questionText: q.questionText,
        questionType: q.questionType,
        isRequired: q.isRequired,
        displayOrder: q.displayOrder,
        options: q.options as any,
        validationConfig: q.validationConfig as any,
        conditionalLogic: q.conditionalLogic as any,
        active: q.active,
      })
    );

    // Run strict complete validation (checks all visible required questions)
    const validationResult = validateAssessmentAnswers(questions, allAnswers, 'COMPLETE');
    if (!validationResult.isValid) {
      throw new BadRequestError(
        `Không thể hoàn thành khảo sát do còn thiếu hoặc sai thông tin: ${validationResult.errors.join('; ')}`
      );
    }

    // Save cleaned answers (with stale answers stripped out)
    await assessmentRepository.saveAnswers(assessmentId, validationResult.cleanAnswers, notes);

    // Mark completed
    return assessmentRepository.complete(assessmentId, notes);
  },

  async cancelAssessment(assessmentId: string, user: UserContext) {
    const assessment = await this.getAssessmentById(assessmentId, user);

    if (assessment.status === AssessmentStatus.COMPLETED) {
      throw new BadRequestError('Không thể hủy bài khảo sát đã hoàn thành.');
    }

    return assessmentRepository.cancel(assessmentId);
  },
};
