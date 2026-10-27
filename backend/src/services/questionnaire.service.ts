import {
  questionnaireRepository,
  CreateQuestionnaireRepoInput,
  UpdateQuestionnaireRepoInput,
} from '../repositories/questionnaire.repository.js';
import {
  QuestionDefinitionInput,
  validateQuestionnaireDependencyGraph,
} from '../validations/questionnaire.validation.js';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from '../utils/errors.js';
import { QuestionnaireVersionStatus, QuestionType } from '@prisma/client';

export interface VersionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export const questionnaireService = {
  async getAllQuestionnaires(activeOnly = false) {
    return questionnaireRepository.findAll(activeOnly);
  },

  async getQuestionnaireById(id: string) {
    const questionnaire = await questionnaireRepository.findById(id);
    if (!questionnaire) {
      throw new NotFoundError(`Không tìm thấy bộ câu hỏi với ID: ${id}`);
    }
    return questionnaire;
  },

  async getQuestionnaireByCode(code: string) {
    const questionnaire = await questionnaireRepository.findByCode(code);
    if (!questionnaire) {
      throw new NotFoundError(`Không tìm thấy bộ câu hỏi với mã: ${code}`);
    }
    return questionnaire;
  },

  async createQuestionnaire(data: CreateQuestionnaireRepoInput) {
    const existing = await questionnaireRepository.findByCode(data.code);
    if (existing) {
      throw new ConflictError(`Mã bộ câu hỏi '${data.code}' đã tồn tại trong hệ thống`);
    }

    if (data.initialQuestions && data.initialQuestions.length > 0) {
      const graphCheck = validateQuestionnaireDependencyGraph(data.initialQuestions);
      if (!graphCheck.isValid) {
        throw new BadRequestError(graphCheck.error || 'Logic điều kiện của câu hỏi không hợp lệ');
      }
    }

    return questionnaireRepository.create(data);
  },

  async updateQuestionnaire(id: string, data: UpdateQuestionnaireRepoInput) {
    await this.getQuestionnaireById(id);
    return questionnaireRepository.update(id, data);
  },

  async deleteQuestionnaire(id: string) {
    const questionnaire = await this.getQuestionnaireById(id);
    // Check if any version is published and has active dependencies
    const hasPublished = questionnaire.versions.some(
      (v) => v.status === QuestionnaireVersionStatus.PUBLISHED
    );
    if (hasPublished) {
      // Soft-archive by setting active = false rather than hard delete to preserve history
      return questionnaireRepository.update(id, { active: false });
    }
    return questionnaireRepository.delete(id);
  },

  async getVersionById(questionnaireId: string, versionId: string) {
    await this.getQuestionnaireById(questionnaireId);
    const version = await questionnaireRepository.findVersionById(versionId);
    if (!version || version.questionnaireId !== questionnaireId) {
      throw new NotFoundError(`Không tìm thấy phiên bản với ID: ${versionId}`);
    }
    return version;
  },

  async getCurrentPublishedVersion(questionnaireId: string) {
    await this.getQuestionnaireById(questionnaireId);
    const version = await questionnaireRepository.findCurrentPublishedVersion(questionnaireId);
    if (!version) {
      throw new NotFoundError(`Bộ câu hỏi này chưa có phiên bản nào được xuất bản`);
    }
    return version;
  },

  async createDraftVersion(
    questionnaireId: string,
    options: {
      title?: string | null;
      description?: string | null;
      changeLog?: string | null;
      sourceVersionId?: string;
    },
    userEmail?: string
  ) {
    const questionnaire = await this.getQuestionnaireById(questionnaireId);

    // If an open DRAFT version already exists, return it or inform user
    const existingDraft = await questionnaireRepository.findDraftVersion(questionnaireId);
    if (existingDraft) {
      return existingDraft;
    }

    // Determine source version to clone: either explicitly passed, or current published, or latest
    let sourceId = options.sourceVersionId;
    if (!sourceId) {
      const current = questionnaire.versions.find((v) => v.isCurrent && v.status === QuestionnaireVersionStatus.PUBLISHED);
      sourceId = current?.id || questionnaire.versions[0]?.id;
    }

    return questionnaireRepository.createDraftVersion({
      questionnaireId,
      title: options.title,
      description: options.description,
      changeLog: options.changeLog,
      createdBy: userEmail,
      sourceVersionId: sourceId,
    });
  },

  async saveDraftQuestions(
    questionnaireId: string,
    versionId: string,
    questions: QuestionDefinitionInput[]
  ) {
    const version = await this.getVersionById(questionnaireId, versionId);

    // IMMUTABILITY GUARD: Cannot edit published or archived versions!
    if (version.status !== QuestionnaireVersionStatus.DRAFT) {
      throw new BadRequestError(
        'Không thể chỉnh sửa câu hỏi của phiên bản đã xuất bản hoặc đã lưu trữ. Vui lòng tạo bản nháp mới để thay đổi.'
      );
    }

    // Validate duplicate codes
    const codes = questions.map((q) => q.code);
    const uniqueCodes = new Set(codes);
    if (uniqueCodes.size !== codes.length) {
      throw new BadRequestError('Mã câu hỏi (code) không được trùng lặp trong cùng một phiên bản');
    }

    // Validate dependency graph for circular logic or non-existent question refs
    const graphCheck = validateQuestionnaireDependencyGraph(questions);
    if (!graphCheck.isValid) {
      throw new BadRequestError(graphCheck.error || 'Logic điều kiện hiển thị không hợp lệ');
    }

    // Validate options for choice questions
    for (const q of questions) {
      if (q.questionType === QuestionType.SINGLE_CHOICE || q.questionType === QuestionType.MULTIPLE_CHOICE) {
        if (!q.options || q.options.length < 2) {
          throw new BadRequestError(`Câu hỏi '${q.code}' (${q.questionText}) phải có ít nhất 2 phương án lựa chọn`);
        }
      }
    }

    return questionnaireRepository.saveDraftQuestions(versionId, questions);
  },

  async reorderQuestions(
    questionnaireId: string,
    versionId: string,
    orders: Array<{ id: string; displayOrder: number }>
  ) {
    const version = await this.getVersionById(questionnaireId, versionId);

    if (version.status !== QuestionnaireVersionStatus.DRAFT) {
      throw new BadRequestError('Chỉ có thể sắp xếp lại câu hỏi trong phiên bản bản nháp (DRAFT)');
    }

    return questionnaireRepository.reorderQuestions(versionId, orders);
  },

  async validateVersion(questionnaireId: string, versionId: string): Promise<VersionValidationResult> {
    const version = await this.getVersionById(questionnaireId, versionId);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!version.questions || version.questions.length === 0) {
      errors.push('Phiên bản chưa có bất kỳ câu hỏi nào. Cần có ít nhất 1 câu hỏi để xuất bản.');
      return { isValid: false, errors, warnings };
    }

    // Duplicate code check
    const codes = version.questions.map((q) => q.code);
    const codeSet = new Set<string>();
    for (const code of codes) {
      if (codeSet.has(code)) {
        errors.push(`Mã câu hỏi '${code}' bị trùng lặp trong phiên bản`);
      }
      codeSet.add(code);
    }

    // Graph check
    const graphCheck = validateQuestionnaireDependencyGraph(
      version.questions.map((q) => ({
        code: q.code,
        conditionalLogic: q.conditionalLogic as any,
      }))
    );
    if (!graphCheck.isValid) {
      errors.push(graphCheck.error || 'Logic điều kiện có chu trình phụ thuộc vòng quanh hoặc tham chiếu không hợp lệ');
    }

    // Question-specific checks
    for (const q of version.questions) {
      if (q.questionType === QuestionType.SINGLE_CHOICE || q.questionType === QuestionType.MULTIPLE_CHOICE) {
        const options = (q.options as any) || [];
        if (options.length < 2) {
          errors.push(`Câu hỏi '${q.code}' phải có ít nhất 2 phương án lựa chọn`);
        }
      }

      if (!q.active) {
        warnings.push(`Câu hỏi '${q.code}' đang ở trạng thái TẮT (sẽ không hiển thị cho người trả lời)`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  },

  async publishVersion(
    questionnaireId: string,
    versionId: string,
    publishedBy: string,
    changeLog?: string | null
  ) {
    const version = await this.getVersionById(questionnaireId, versionId);

    if (version.status === QuestionnaireVersionStatus.PUBLISHED && version.isCurrent) {
      throw new BadRequestError('Phiên bản này đã được xuất bản và đang là phiên bản hiện hành');
    }

    // Validate version before publishing
    const validation = await this.validateVersion(questionnaireId, versionId);
    if (!validation.isValid) {
      throw new BadRequestError(
        `Không thể xuất bản phiên bản do có lỗi cấu hình: ${validation.errors.join('; ')}`
      );
    }

    return questionnaireRepository.publishVersion(questionnaireId, versionId, publishedBy, changeLog);
  },

  async deleteDraftVersion(questionnaireId: string, versionId: string) {
    const version = await this.getVersionById(questionnaireId, versionId);

    if (version.status !== QuestionnaireVersionStatus.DRAFT) {
      throw new ForbiddenError(
        'Không thể xóa phiên bản đã xuất bản hoặc đã lưu trữ. Chỉ được xóa bản nháp.'
      );
    }

    return questionnaireRepository.deleteVersion(versionId);
  },
};
