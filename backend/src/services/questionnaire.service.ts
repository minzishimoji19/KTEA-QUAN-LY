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
import { auditLogService } from './auditLog.service.js';

export interface VersionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ActorContext {
  userId?: string | null;
  email?: string | null;
}

function enrichQuestionnaireDeletionMeta(q: any) {
  if (!q) return q;
  const versions = Array.isArray(q.versions) ? q.versions : [];
  const hasPublishedOrArchivedVersion = versions.some(
    (v: any) => v.status !== QuestionnaireVersionStatus.DRAFT
  );
  const totalAssessments = versions.reduce(
    (sum: number, v: any) => sum + (v._count?.assessments || 0),
    0
  );
  return {
    ...q,
    hasPublishedOrArchivedVersion,
    totalAssessments,
    canHardDelete: !hasPublishedOrArchivedVersion && totalAssessments === 0,
  };
}

export const questionnaireService = {
  async getAllQuestionnaires(activeOnly = false) {
    const list = await questionnaireRepository.findAll(activeOnly);
    return list.map((q) => enrichQuestionnaireDeletionMeta(q));
  },

  async getQuestionnaireById(id: string) {
    const questionnaire = await questionnaireRepository.findById(id);
    if (!questionnaire) {
      throw new NotFoundError(`Không tìm thấy bộ câu hỏi với ID: ${id}`);
    }
    return enrichQuestionnaireDeletionMeta(questionnaire);
  },

  async getQuestionnaireByCode(code: string) {
    const questionnaire = await questionnaireRepository.findByCode(code);
    if (!questionnaire) {
      throw new NotFoundError(`Không tìm thấy bộ câu hỏi với mã: ${code}`);
    }
    return enrichQuestionnaireDeletionMeta(questionnaire);
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

    const created = await questionnaireRepository.create(data);
    return enrichQuestionnaireDeletionMeta(created);
  },

  async updateQuestionnaire(id: string, data: UpdateQuestionnaireRepoInput, actor?: ActorContext) {
    const existing = await this.getQuestionnaireById(id);

    const cleanData: UpdateQuestionnaireRepoInput = {};
    if (data.title !== undefined) {
      const trimmedTitle = data.title.trim();
      if (trimmedTitle.length < 3 || trimmedTitle.length > 255) {
        throw new BadRequestError('Tiêu đề bộ câu hỏi phải từ 3 đến 255 ký tự');
      }
      cleanData.title = trimmedTitle;
    }
    if (data.description !== undefined) {
      cleanData.description = data.description === null ? null : data.description.trim();
    }
    if (data.active !== undefined) {
      cleanData.active = Boolean(data.active);
    }

    const updated = await questionnaireRepository.update(id, cleanData);

    await auditLogService.log({
      actorId: actor?.userId || undefined,
      actorEmail: actor?.email || undefined,
      action:
        cleanData.active !== undefined && cleanData.active !== existing.active
          ? cleanData.active
            ? 'RESTORE_QUESTIONNAIRE'
            : 'ARCHIVE_QUESTIONNAIRE'
          : 'UPDATE_QUESTIONNAIRE',
      entityType: 'QUESTIONNAIRE',
      entityId: id,
      details: {
        code: existing.code,
        previousTitle: existing.title,
        newTitle: updated.title,
        previousActive: existing.active,
        newActive: updated.active,
      },
    });

    return enrichQuestionnaireDeletionMeta(updated);
  },

  async deleteQuestionnaire(id: string, actor?: ActorContext) {
    const questionnaire = await this.getQuestionnaireById(id);
    const safety = await questionnaireRepository.getDeletionSafetyCounts(id);

    if (!safety.canHardDelete) {
      const reasons: string[] = [];
      if (safety.nonDraftVersionCount > 0) {
        reasons.push(`${safety.nonDraftVersionCount} phiên bản đã xuất bản/lưu trữ`);
      }
      if (safety.assessmentCount > 0) {
        reasons.push(`${safety.assessmentCount} bài khảo sát khách hàng`);
      }
      if (safety.answerCount > 0) {
        reasons.push(`${safety.answerCount} câu trả lời khảo sát`);
      }
      if (safety.recommendationRunCount > 0) {
        reasons.push(`${safety.recommendationRunCount} lượt chạy gợi ý sản phẩm`);
      }
      if (safety.publicSurveyLinkCount > 0) {
        reasons.push(`${safety.publicSurveyLinkCount} đường link khảo sát`);
      }

      throw new BadRequestError(
        `Không thể xóa vĩnh viễn bộ câu hỏi "${questionnaire.title}" [${questionnaire.code}] vì đang có dữ liệu lịch sử cần bảo toàn (${reasons.join(', ')}). Vui lòng sử dụng chức năng "Ngừng sử dụng (Lưu trữ)" để ẩn khỏi danh sách tạo mới mà vẫn giữ nguyên toàn bộ lịch sử khảo sát khách hàng.`
      );
    }

    await questionnaireRepository.delete(id);

    await auditLogService.log({
      actorId: actor?.userId || undefined,
      actorEmail: actor?.email || undefined,
      action: 'DELETE_DRAFT_QUESTIONNAIRE',
      entityType: 'QUESTIONNAIRE',
      entityId: id,
      details: {
        code: questionnaire.code,
        title: questionnaire.title,
      },
    });

    return { id, deleted: true };
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
      const current = questionnaire.versions.find(
        (v: any) => v.isCurrent && v.status === QuestionnaireVersionStatus.PUBLISHED
      );
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

  async deleteDraftVersion(questionnaireId: string, versionId: string, actor?: ActorContext) {
    const questionnaire = await this.getQuestionnaireById(questionnaireId);
    const version = await this.getVersionById(questionnaireId, versionId);

    if (version.status !== QuestionnaireVersionStatus.DRAFT) {
      throw new ForbiddenError(
        'Không thể xóa phiên bản đã xuất bản hoặc đã lưu trữ. Chỉ được xóa bản nháp.'
      );
    }

    const versionSafety = await questionnaireRepository.getVersionDeletionSafetyCounts(versionId);
    if (!versionSafety.canHardDelete) {
      throw new BadRequestError(
        `Không thể xóa phiên bản nháp v${version.versionNumber} vì đã có dữ liệu khảo sát hoặc câu trả lời tham chiếu đến phiên bản này.`
      );
    }

    if (questionnaire.versions.length <= 1) {
      throw new BadRequestError(
        'Đây là phiên bản duy nhất của bộ câu hỏi nháp. Vui lòng chọn "Xóa bộ câu hỏi nháp" nếu muốn xóa toàn bộ bộ câu hỏi này.'
      );
    }

    const res = await questionnaireRepository.deleteVersion(versionId);

    await auditLogService.log({
      actorId: actor?.userId || undefined,
      actorEmail: actor?.email || undefined,
      action: 'DELETE_DRAFT_QUESTIONNAIRE_VERSION',
      entityType: 'QUESTIONNAIRE_VERSION',
      entityId: versionId,
      details: {
        questionnaireId,
        code: questionnaire.code,
        versionNumber: version.versionNumber,
      },
    });

    return res;
  },
};
