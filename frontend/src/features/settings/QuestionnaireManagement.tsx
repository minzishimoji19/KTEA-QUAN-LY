import React, { useState, useEffect, useMemo } from 'react';
import {
  HelpCircle,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Eye,
  Send,
  Lock,
  FileText,
  ChevronRight,
  ListOrdered,
  Layers,
  Search,
  X,
  Copy,
} from 'lucide-react';
import {
  Questionnaire,
  QuestionnaireVersion,
  QuestionDefinition,
  QuestionType,
  QuestionOption,
  QuestionConditionalLogic,
} from '../../types/questionnaire';
import questionnaireService from '../../services/questionnaireService';
import { useToast } from '../../context/ToastContext';
import { Skeleton } from '../../components/ui/Skeleton';

// Question Type Labels & Badge Colors
const QUESTION_TYPE_INFO: Record<
  QuestionType,
  { label: string; badgeClass: string; desc: string }
> = {
  SINGLE_CHOICE: {
    label: 'Một lựa chọn (Radio)',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    desc: 'Người dùng chọn 1 phương án duy nhất trong danh sách',
  },
  MULTIPLE_CHOICE: {
    label: 'Nhiều lựa chọn (Checkbox)',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    desc: 'Người dùng có thể chọn một hoặc nhiều phương án',
  },
  YES_NO: {
    label: 'Có / Không (Yes-No)',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    desc: 'Câu hỏi xác nhận nhị phân Đúng/Sai hoặc Có/Không',
  },
  CURRENCY: {
    label: 'Số tiền (VND)',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    desc: 'Nhập số tiền tài chính định dạng chuẩn Việt Nam',
  },
  NUMBER: {
    label: 'Số nguyên / Định lượng',
    badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    desc: 'Nhập số liệu số học (tuổi, số tháng, số lượng)',
  },
  TEXT: {
    label: 'Văn bản ngắn',
    badgeClass: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
    desc: 'Nhập thông tin văn bản ngắn 1 dòng',
  },
  LONG_TEXT: {
    label: 'Đoạn văn bản dài',
    badgeClass: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    desc: 'Nhập nội dung mô tả chi tiết nhiều dòng',
  },
  DATE: {
    label: 'Ngày tháng (Date)',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    desc: 'Chọn mốc thời gian / ngày sinh / ngày giải ngân',
  },
};

export const QuestionnaireManagement: React.FC = () => {
  const { toast } = useToast();

  // State: Data
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // State: Selected Questionnaire & Version Workspace
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<QuestionnaireVersion | null>(null);
  const [isVersionLoading, setIsVersionLoading] = useState<boolean>(false);

  // State: Working Draft Questions (in-memory buffer for draft editing)
  const [draftQuestions, setDraftQuestions] = useState<QuestionDefinition[]>([]);
  const [isSavingDraft, setIsSavingDraft] = useState<boolean>(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // State: Modals & Drawers
  const [isCreateQModalOpen, setIsCreateQModalOpen] = useState<boolean>(false);
  const [isEditQuestionModalOpen, setIsEditQuestionModalOpen] = useState<boolean>(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionDefinition | null>(null);
  const [isEditingNewQuestion, setIsEditingNewQuestion] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);
  const [publishChangeLog, setPublishChangeLog] = useState<string>('');
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  // State: Create Questionnaire Form
  const [newQCode, setNewQCode] = useState<string>('');
  const [newQTitle, setNewQTitle] = useState<string>('');
  const [newQDesc, setNewQDesc] = useState<string>('');
  const [isCreatingQ, setIsCreatingQ] = useState<boolean>(false);

  // Load Questionnaires list
  const loadQuestionnaires = async () => {
    setIsLoading(true);
    try {
      const data = await questionnaireService.getQuestionnaires();
      setQuestionnaires(data);
      if (data.length > 0 && !selectedQuestionnaireId) {
        setSelectedQuestionnaireId(data[0].id);
      }
    } catch (err: any) {
      toast.error('Không thể tải danh sách bộ câu hỏi: ' + (err.message || 'Lỗi kết nối'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadQuestionnaires();
  }, []);

  // Currently selected questionnaire object
  const activeQuestionnaire = useMemo(() => {
    return questionnaires.find((q) => q.id === selectedQuestionnaireId) || null;
  }, [questionnaires, selectedQuestionnaireId]);

  // Load specific version when selectedQuestionnaire or selectedVersionId changes
  const loadVersionDetail = async (qId: string, vId: string) => {
    setIsVersionLoading(true);
    try {
      const version = await questionnaireService.getVersionById(qId, vId);
      setCurrentVersion(version);
      setDraftQuestions(version.questions || []);
      setHasUnsavedChanges(false);
    } catch (err: any) {
      toast.error('Lỗi khi tải chi tiết phiên bản câu hỏi: ' + (err.message || ''));
    } finally {
      setIsVersionLoading(false);
    }
  };

  // When selectedQuestionnaire changes, pick its draft or current published version
  useEffect(() => {
    if (!activeQuestionnaire) {
      setCurrentVersion(null);
      setDraftQuestions([]);
      return;
    }

    const versions = activeQuestionnaire.versions || [];
    // Priority: DRAFT version first, else current published, else first version
    const draft = versions.find((v) => v.status === 'DRAFT');
    const currentPub = versions.find((v) => v.isCurrent && v.status === 'PUBLISHED');
    const initialV = draft || currentPub || versions[0];

    if (initialV) {
      setSelectedVersionId(initialV.id);
      loadVersionDetail(activeQuestionnaire.id, initialV.id);
    } else {
      setCurrentVersion(null);
      setDraftQuestions([]);
    }
  }, [selectedQuestionnaireId]);

  // Handle switching version
  const handleSelectVersion = (vId: string) => {
    if (hasUnsavedChanges) {
      if (!window.confirm('Bạn có thay đổi chưa lưu trong bản nháp hiện tại. Bạn có chắc muốn chuyển phiên bản?')) {
        return;
      }
    }
    setSelectedVersionId(vId);
    if (selectedQuestionnaireId) {
      loadVersionDetail(selectedQuestionnaireId, vId);
    }
  };

  // Create new Questionnaire
  const handleCreateQuestionnaire = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQCode || !newQTitle) return;
    setIsCreatingQ(true);
    try {
      const created = await questionnaireService.createQuestionnaire({
        code: newQCode.trim().toUpperCase(),
        title: newQTitle.trim(),
        description: newQDesc.trim() || null,
      });
      toast.success('Đã tạo bộ câu hỏi mới thành công');
      setIsCreateQModalOpen(false);
      setNewQCode('');
      setNewQTitle('');
      setNewQDesc('');
      await loadQuestionnaires();
      setSelectedQuestionnaireId(created.id);
    } catch (err: any) {
      toast.error('Lỗi tạo bộ câu hỏi: ' + (err.message || ''));
    } finally {
      setIsCreatingQ(false);
    }
  };

  // Create Draft Version from current version
  const handleCreateDraftFromCurrent = async () => {
    if (!activeQuestionnaire) return;
    try {
      const draft = await questionnaireService.createDraftVersion(activeQuestionnaire.id, {
        title: `Bản nháp v${(activeQuestionnaire.versions?.length || 0) + 1}`,
        sourceVersionId: selectedVersionId || undefined,
      });
      toast.success('Đã tạo bản nháp mới thành công. Bạn có thể bắt đầu chỉnh sửa.');
      await loadQuestionnaires();
      setSelectedVersionId(draft.id);
      loadVersionDetail(activeQuestionnaire.id, draft.id);
    } catch (err: any) {
      toast.error('Lỗi tạo bản nháp: ' + (err.message || ''));
    }
  };

  // Reorder questions
  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    if (currentVersion?.status !== 'DRAFT') return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= draftQuestions.length) return;

    const updated = [...draftQuestions];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);

    // Update display orders
    const reordered = updated.map((q, idx) => ({
      ...q,
      displayOrder: idx + 1,
    }));

    setDraftQuestions(reordered);
    setHasUnsavedChanges(true);
  };

  // Delete question from draft
  const handleDeleteQuestion = (code: string) => {
    if (currentVersion?.status !== 'DRAFT') return;
    if (!window.confirm(`Bạn có chắc chắn muốn xóa câu hỏi '${code}' khỏi bản nháp?`)) return;

    const filtered = draftQuestions.filter((q) => q.code !== code);
    const reordered = filtered.map((q, idx) => ({ ...q, displayOrder: idx + 1 }));
    setDraftQuestions(reordered);
    setHasUnsavedChanges(true);
    toast.success(`Đã xóa câu hỏi '${code}' khỏi danh sách bản nháp`);
  };

  // Open Edit/Add Question Modal
  const handleOpenAddQuestion = () => {
    if (currentVersion?.status !== 'DRAFT') return;
    const nextOrder = draftQuestions.length + 1;
    setEditingQuestion({
      code: `q_${nextOrder}`,
      questionText: '',
      description: '',
      questionType: 'SINGLE_CHOICE',
      isRequired: true,
      displayOrder: nextOrder,
      active: true,
      options: [
        { id: 'opt_1', label: 'Lựa chọn 1', value: 'OPT_1' },
        { id: 'opt_2', label: 'Lựa chọn 2', value: 'OPT_2' },
      ],
      validationConfig: null,
      conditionalLogic: null,
    });
    setIsEditingNewQuestion(true);
    setIsEditQuestionModalOpen(true);
  };

  const handleOpenEditQuestion = (q: QuestionDefinition) => {
    if (currentVersion?.status !== 'DRAFT') return;
    setEditingQuestion(JSON.parse(JSON.stringify(q)));
    setIsEditingNewQuestion(false);
    setIsEditQuestionModalOpen(true);
  };

  // Save question inside modal
  const handleSaveQuestionModal = (savedQuestion: QuestionDefinition) => {
    let updated: QuestionDefinition[];
    if (isEditingNewQuestion) {
      // Check duplicate code
      if (draftQuestions.some((q) => q.code === savedQuestion.code)) {
        toast.error(`Mã câu hỏi '${savedQuestion.code}' đã tồn tại trong phiên bản này!`);
        return;
      }
      updated = [...draftQuestions, savedQuestion];
    } else {
      updated = draftQuestions.map((q) => (q.code === savedQuestion.code ? savedQuestion : q));
    }

    setDraftQuestions(updated);
    setHasUnsavedChanges(true);
    setIsEditQuestionModalOpen(false);
    toast.success('Đã cập nhật câu hỏi vào bộ nhớ bản nháp (Hãy nhớ bấm Lưu bản nháp)');
  };

  // Save draft questions to backend
  const handleSaveDraftToBackend = async () => {
    if (!activeQuestionnaire || !selectedVersionId) return;
    setIsSavingDraft(true);
    try {
      const saved = await questionnaireService.saveDraftQuestions(
        activeQuestionnaire.id,
        selectedVersionId,
        draftQuestions
      );
      setCurrentVersion(saved);
      setDraftQuestions(saved.questions || []);
      setHasUnsavedChanges(false);
      toast.success('Đã lưu các câu hỏi vào bản nháp trên hệ thống thành công');
    } catch (err: any) {
      toast.error('Lỗi khi lưu bản nháp: ' + (err.message || ''));
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Publish draft version
  const handlePublishVersion = async () => {
    if (!activeQuestionnaire || !selectedVersionId) return;
    setIsPublishing(true);
    try {
      await questionnaireService.publishVersion(activeQuestionnaire.id, selectedVersionId, {
        changeLog: publishChangeLog.trim() || null,
      });
      toast.success('Xuất bản phiên bản câu hỏi thành công! Phiên bản này giờ là hiện hành.');
      setIsPublishModalOpen(false);
      setPublishChangeLog('');
      await loadQuestionnaires();
      loadVersionDetail(activeQuestionnaire.id, selectedVersionId);
    } catch (err: any) {
      toast.error('Lỗi xuất bản: ' + (err.message || ''));
    } finally {
      setIsPublishing(false);
    }
  };

  // Filtered questionnaires list
  const filteredQuestionnaires = questionnaires.filter((q) =>
    q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Layers className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-slate-100">
                  Khảo sát nhu cầu khách hàng (Dynamic Questionnaire)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Cấu hình bộ câu hỏi động, phân loại nhu cầu, điều kiện hiển thị thông minh và quản lý phiên bản bất biến.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateQModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo bộ câu hỏi mới</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Questionnaire Selector List (col-4) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Danh sách bộ câu hỏi ({questionnaires.length})
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Tìm mã hoặc tên bộ câu hỏi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {isLoading ? (
              <div className="space-y-2 pt-2">
                <Skeleton className="h-16 w-full rounded-lg bg-slate-800/60" />
                <Skeleton className="h-16 w-full rounded-lg bg-slate-800/60" />
              </div>
            ) : filteredQuestionnaires.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Chưa có bộ câu hỏi nào được cấu hình
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                {filteredQuestionnaires.map((q) => {
                  const isSelected = q.id === selectedQuestionnaireId;
                  const currentPub = q.versions?.find((v) => v.isCurrent && v.status === 'PUBLISHED');
                  const draftV = q.versions?.find((v) => v.status === 'DRAFT');

                  return (
                    <div
                      key={q.id}
                      onClick={() => setSelectedQuestionnaireId(q.id)}
                      className={`p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10 shadow-sm'
                          : 'border-slate-800/80 bg-slate-950/40 hover:border-slate-700 hover:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-200">
                              {q.title}
                            </span>
                            {q.active ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 font-mono">
                                Active
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-500/10 text-slate-400 font-mono">
                                Off
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {q.code}
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 text-slate-500 transition-transform ${isSelected ? 'translate-x-1 text-blue-400' : ''}`} />
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          {currentPub ? `v${currentPub.versionNumber} hiện hành` : 'Chưa xuất bản'}
                        </span>
                        {draftV && (
                          <span className="text-amber-400 font-medium px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px]">
                            Có bản nháp v{draftV.versionNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Version Editor & Question Canvas (col-8) */}
        <div className="lg:col-span-8 space-y-4">
          {!activeQuestionnaire ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/20 p-12 text-center text-slate-500 text-xs">
              Vui lòng chọn một bộ câu hỏi bên trái để bắt đầu xem hoặc biên tập
            </div>
          ) : (
            <>
              {/* Questionnaire Header & Version Bar */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                      <span>{activeQuestionnaire.title}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300">
                        {activeQuestionnaire.code}
                      </span>
                    </h2>
                    {activeQuestionnaire.description && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        {activeQuestionnaire.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsPreviewModalOpen(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                      <span>Xem trước tương tác</span>
                    </button>

                    {currentVersion?.status === 'DRAFT' ? (
                      <button
                        onClick={() => setIsPublishModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-sm"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Xuất bản v{currentVersion.versionNumber}</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleCreateDraftFromCurrent}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors shadow-sm"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Tạo bản nháp mới</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Version Selector Tabs */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1 overflow-x-auto py-1">
                    <span className="text-xs font-medium text-slate-400 mr-2 flex items-center gap-1">
                      <ListOrdered className="w-3.5 h-3.5 text-slate-400" />
                      Phiên bản:
                    </span>
                    {(activeQuestionnaire.versions || []).map((v) => {
                      const isSel = v.id === selectedVersionId;
                      return (
                        <button
                          key={v.id}
                          onClick={() => handleSelectVersion(v.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all ${
                            isSel
                              ? 'bg-blue-600 text-white font-semibold shadow-sm'
                              : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800'
                          }`}
                        >
                          <span>v{v.versionNumber}</span>
                          {v.status === 'PUBLISHED' && v.isCurrent && (
                            <span className="text-[10px] px-1 rounded bg-emerald-400/20 text-emerald-300">
                              Hiện hành
                            </span>
                          )}
                          {v.status === 'DRAFT' && (
                            <span className="text-[10px] px-1 rounded bg-amber-400/20 text-amber-300">
                              Nháp
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {currentVersion?.status === 'DRAFT' && hasUnsavedChanges && (
                    <button
                      onClick={handleSaveDraftToBackend}
                      disabled={isSavingDraft}
                      className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-md text-xs transition-colors shadow"
                    >
                      {isSavingDraft ? 'Đang lưu...' : 'Lưu bản nháp'}
                    </button>
                  )}
                </div>

                {/* Status Notice Banner */}
                {currentVersion?.status === 'PUBLISHED' && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
                    <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-200 space-y-0.5">
                      <div className="font-semibold text-amber-300">
                        Phiên bản này đã xuất bản (Bất biến)
                      </div>
                      <div className="text-slate-300">
                        Để bảo toàn tính trung thực của các khảo sát đã thực hiện trong quá khứ, nội dung câu hỏi của phiên bản này không thể sửa trực tiếp. Để cập nhật cho tương lai, vui lòng bấm nút{' '}
                        <strong className="text-white">"Tạo bản nháp mới"</strong> ở trên.
                      </div>
                    </div>
                  </div>
                )}

                {currentVersion?.status === 'DRAFT' && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5">
                    <FileText className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-emerald-200 space-y-0.5">
                      <div className="font-semibold text-emerald-300">
                        Đang biên tập bản nháp v{currentVersion.versionNumber}
                      </div>
                      <div className="text-slate-300">
                        Bạn có thể tự do thêm, xóa, sửa và sắp xếp các câu hỏi. Khi hoàn tất, hãy bấm nút{' '}
                        <strong className="text-white">"Xuất bản"</strong> để áp dụng vào hệ thống.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Questions List Canvas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>Danh sách câu hỏi ({draftQuestions.length})</span>
                    {hasUnsavedChanges && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-normal">
                        Có thay đổi chưa lưu
                      </span>
                    )}
                  </h3>

                  {currentVersion?.status === 'DRAFT' && (
                    <button
                      onClick={handleOpenAddQuestion}
                      className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-md text-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-400" />
                      <span>Thêm câu hỏi</span>
                    </button>
                  )}
                </div>

                {isVersionLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full rounded-xl bg-slate-900/40" />
                    <Skeleton className="h-20 w-full rounded-xl bg-slate-900/40" />
                  </div>
                ) : draftQuestions.length === 0 ? (
                  <div className="p-10 rounded-xl border border-dashed border-slate-800 text-center space-y-2">
                    <HelpCircle className="w-8 h-8 text-slate-600 mx-auto" />
                    <div className="text-xs text-slate-400">Phiên bản này chưa có câu hỏi nào</div>
                    {currentVersion?.status === 'DRAFT' && (
                      <button
                        onClick={handleOpenAddQuestion}
                        className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Bấm vào đây để thêm câu hỏi đầu tiên</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {draftQuestions.map((q, index) => {
                      const typeInfo = QUESTION_TYPE_INFO[q.questionType] || QUESTION_TYPE_INFO.TEXT;

                      return (
                        <div
                          key={q.code}
                          className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-slate-700/80 transition-all space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5">
                              <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 font-mono text-xs flex items-center justify-center shrink-0 mt-0.5">
                                {index + 1}
                              </span>

                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-semibold text-slate-100">
                                    {q.questionText}
                                  </span>
                                  {q.isRequired ? (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                      Bắt buộc
                                    </span>
                                  ) : (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                                      Tùy chọn
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                                  <span className="font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                                    {q.code}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-full border text-[10px] ${typeInfo.badgeClass}`}>
                                    {typeInfo.label}
                                  </span>
                                  {q.conditionalLogic?.dependsOnQuestionCode && (
                                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono">
                                      Phụ thuộc: {q.conditionalLogic.dependsOnQuestionCode} ({q.conditionalLogic.operator})
                                    </span>
                                  )}
                                </div>

                                {q.description && (
                                  <p className="text-[11px] text-slate-400 italic">
                                    "{q.description}"
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Actions & Reordering */}
                            <div className="flex items-center gap-1 shrink-0">
                              {currentVersion?.status === 'DRAFT' && (
                                <>
                                  <button
                                    onClick={() => handleMoveQuestion(index, 'up')}
                                    disabled={index === 0}
                                    title="Di chuyển lên trên"
                                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleMoveQuestion(index, 'down')}
                                    disabled={index === draftQuestions.length - 1}
                                    title="Di chuyển xuống dưới"
                                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenEditQuestion(q)}
                                    title="Chỉnh sửa câu hỏi"
                                    className="p-1.5 rounded hover:bg-slate-800 text-blue-400 hover:text-blue-300"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteQuestion(q.code)}
                                    title="Xóa câu hỏi khỏi bản nháp"
                                    className="p-1.5 rounded hover:bg-slate-800 text-rose-400 hover:text-rose-300"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Options preview for choice questions */}
                          {(q.questionType === 'SINGLE_CHOICE' || q.questionType === 'MULTIPLE_CHOICE') && q.options && (
                            <div className="pl-8 pt-1 flex flex-wrap gap-1.5">
                              {q.options.map((opt) => (
                                <span
                                  key={opt.id}
                                  className="text-[11px] px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 flex items-center gap-1"
                                >
                                  <span>{opt.label}</span>
                                  {opt.hasTextInput && (
                                    <span className="text-[10px] text-blue-400">(+ Nhập chữ)</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: TẠO BỘ CÂU HỎI MỚI                                               */}
      {/* ========================================================================= */}
      {isCreateQModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-400" />
                <span>Tạo bộ câu hỏi khảo sát mới</span>
              </h3>
              <button
                onClick={() => setIsCreateQModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateQuestionnaire} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Mã bộ câu hỏi (Unique Slug) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: KTEA_MORTGAGE_LOAN_SURVEY"
                  value={newQCode}
                  onChange={(e) => setNewQCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500 uppercase"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Tiêu đề bộ câu hỏi <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Khảo sát nhu cầu vay thế chấp bất động sản"
                  value={newQTitle}
                  onChange={(e) => setNewQTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Mô tả mục đích</label>
                <textarea
                  rows={3}
                  placeholder="Mô tả mục tiêu và đối tượng khách hàng áp dụng..."
                  value={newQDesc}
                  onChange={(e) => setNewQDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateQModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isCreatingQ}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
                >
                  {isCreatingQ ? 'Đang tạo...' : 'Tạo bộ câu hỏi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BIÊN TẬP CHI TIẾT CÂU HỎI (QUESTION EDITOR)                     */}
      {/* ========================================================================= */}
      {isEditQuestionModalOpen && editingQuestion && (
        <QuestionEditorModal
          initialQuestion={editingQuestion}
          allQuestions={draftQuestions}
          isNew={isEditingNewQuestion}
          onClose={() => setIsEditQuestionModalOpen(false)}
          onSave={handleSaveQuestionModal}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: XUẤT BẢN PHIÊN BẢN (PUBLISH MODAL)                               */}
      {/* ========================================================================= */}
      {isPublishModalOpen && currentVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-400" />
                <span>Xuất bản phiên bản v{currentVersion.versionNumber}</span>
              </h3>
              <button
                onClick={() => setIsPublishModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-slate-300 space-y-1">
              <div className="font-semibold text-emerald-300">
                Lưu ý quan trọng về tính bất biến:
              </div>
              <div>
                Khi xuất bản, phiên bản này sẽ trở thành phiên bản hiện hành cho khách hàng và sẽ được khóa bất biến. Các câu hỏi sẽ không thể sửa trực tiếp được nữa.
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Ghi chú thay đổi (Change log)</label>
              <textarea
                rows={3}
                placeholder="Ví dụ: Bổ sung câu hỏi về tài sản thế chấp và cập nhật lãi suất..."
                value={publishChangeLog}
                onChange={(e) => setPublishChangeLog(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPublishModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handlePublishVersion}
                disabled={isPublishing}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-sm"
              >
                {isPublishing ? 'Đang xuất bản...' : 'Xác nhận xuất bản'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: INTERACTIVE PREVIEW SIMULATOR                                    */}
      {/* ========================================================================= */}
      {isPreviewModalOpen && (
        <InteractivePreviewModal
          questions={draftQuestions}
          questionnaireTitle={activeQuestionnaire?.title || 'Khảo sát'}
          versionNumber={currentVersion?.versionNumber || 1}
          onClose={() => setIsPreviewModalOpen(false)}
        />
      )}
    </div>
  );
};

// =========================================================================
// SUB-COMPONENT: QUESTION EDITOR MODAL
// =========================================================================
interface QuestionEditorModalProps {
  initialQuestion: QuestionDefinition;
  allQuestions: QuestionDefinition[];
  isNew: boolean;
  onClose: () => void;
  onSave: (question: QuestionDefinition) => void;
}

const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({
  initialQuestion,
  allQuestions,
  isNew,
  onClose,
  onSave,
}) => {
  const [qData, setQData] = useState<QuestionDefinition>({ ...initialQuestion });
  const [options, setOptions] = useState<QuestionOption[]>(
    initialQuestion.options && initialQuestion.options.length > 0
      ? initialQuestion.options
      : [
          { id: 'opt_1', label: 'Phương án 1', value: 'OPT_1' },
          { id: 'opt_2', label: 'Phương án 2', value: 'OPT_2' },
        ]
  );
  const [hasCondition, setHasCondition] = useState<boolean>(
    Boolean(initialQuestion.conditionalLogic?.dependsOnQuestionCode)
  );
  const [dependsOnCode, setDependsOnCode] = useState<string>(
    initialQuestion.conditionalLogic?.dependsOnQuestionCode || ''
  );
  const [operator, setOperator] = useState<any>(
    initialQuestion.conditionalLogic?.operator || 'EQUALS'
  );
  const [conditionValue, setConditionValue] = useState<string>(
    initialQuestion.conditionalLogic?.value ? String(initialQuestion.conditionalLogic.value) : ''
  );

  // Available source questions for conditional logic (excluding self)
  const candidateSourceQuestions = useMemo(() => {
    return allQuestions.filter((q) => q.code !== qData.code);
  }, [allQuestions, qData.code]);

  const handleAddOption = () => {
    const nextId = `opt_${options.length + 1}`;
    setOptions([
      ...options,
      {
        id: nextId,
        label: `Phương án ${options.length + 1}`,
        value: `OPT_${options.length + 1}`,
        hasTextInput: false,
      },
    ]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      alert('Câu hỏi dạng lựa chọn phải có tối thiểu 2 phương án!');
      return;
    }
    const updated = [...options];
    updated.splice(index, 1);
    setOptions(updated);
  };

  const handleOptionChange = (index: number, field: keyof QuestionOption, val: any) => {
    const updated = [...options];
    updated[index] = { ...updated[index], [field]: val };
    setOptions(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let conditionalLogic: QuestionConditionalLogic | null = null;
    if (hasCondition && dependsOnCode) {
      conditionalLogic = {
        dependsOnQuestionCode: dependsOnCode,
        operator,
        value: conditionValue,
      };
    }

    const isChoice = qData.questionType === 'SINGLE_CHOICE' || qData.questionType === 'MULTIPLE_CHOICE';

    const finalQuestion: QuestionDefinition = {
      ...qData,
      options: isChoice ? options : null,
      conditionalLogic,
    };

    onSave(finalQuestion);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl my-8 rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
            <Edit className="w-4 h-4 text-blue-400" />
            <span>{isNew ? 'Thêm câu hỏi mới' : `Chỉnh sửa câu hỏi [${qData.code}]`}</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Mã câu hỏi (Code) <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!isNew}
                placeholder="Ví dụ: q_loan_purpose"
                value={qData.code}
                onChange={(e) => setQData({ ...qData, code: e.target.value.toLowerCase().trim() })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500 disabled:opacity-50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">
                Loại dữ liệu câu hỏi <span className="text-rose-400">*</span>
              </label>
              <select
                value={qData.questionType}
                onChange={(e) => setQData({ ...qData, questionType: e.target.value as QuestionType })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              >
                {Object.entries(QUESTION_TYPE_INFO).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">
              Nội dung câu hỏi <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Mục đích chính của khoản vay là gì?"
              value={qData.questionText}
              onChange={(e) => setQData({ ...qData, questionText: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Mô tả / Hướng dẫn trả lời</label>
            <textarea
              rows={2}
              placeholder="Nhập hướng dẫn giải thích cho khách hàng hoặc chuyên viên..."
              value={qData.description || ''}
              onChange={(e) => setQData({ ...qData, description: e.target.value })}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={qData.isRequired}
                onChange={(e) => setQData({ ...qData, isRequired: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-950"
              />
              <span className="text-xs font-medium text-slate-300">Câu hỏi bắt buộc trả lời</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={qData.active}
                onChange={(e) => setQData({ ...qData, active: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-950"
              />
              <span className="text-xs font-medium text-slate-300">Đang bật (Active)</span>
            </label>
          </div>

          {/* Dynamic Options Builder for Choice questions */}
          {(qData.questionType === 'SINGLE_CHOICE' || qData.questionType === 'MULTIPLE_CHOICE') && (
            <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  Phương án lựa chọn ({options.length})
                </span>
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300"
                >
                  <Plus className="w-3 h-3" />
                  <span>Thêm phương án</span>
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {options.map((opt, idx) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Nhãn hiển thị..."
                      value={opt.label}
                      onChange={(e) => handleOptionChange(idx, 'label', e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100"
                    />
                    <input
                      type="text"
                      required
                      placeholder="Mã giá trị..."
                      value={opt.value}
                      onChange={(e) => handleOptionChange(idx, 'value', e.target.value)}
                      className="w-28 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 font-mono"
                    />
                    <label className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                      <input
                        type="checkbox"
                        checked={Boolean(opt.hasTextInput)}
                        onChange={(e) => handleOptionChange(idx, 'hasTextInput', e.target.checked)}
                        className="rounded border-slate-700 text-blue-600"
                      />
                      <span>Nhập chữ</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Conditional Logic Section */}
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasCondition}
                  onChange={(e) => setHasCondition(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-blue-600"
                />
                <span className="text-xs font-semibold text-slate-200">
                  Hiển thị câu hỏi này có điều kiện (Conditional Logic)
                </span>
              </label>
            </div>

            {hasCondition && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Phụ thuộc câu hỏi:</label>
                  <select
                    value={dependsOnCode}
                    onChange={(e) => setDependsOnCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 font-mono"
                  >
                    <option value="">-- Chọn câu hỏi nguồn --</option>
                    {candidateSourceQuestions.map((cq) => (
                      <option key={cq.code} value={cq.code}>
                        {cq.code} ({cq.questionText.slice(0, 24)}...)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Toán tử so sánh:</label>
                  <select
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100"
                  >
                    <option value="EQUALS">Bằng (=)</option>
                    <option value="NOT_EQUALS">Khác (!=)</option>
                    <option value="GREATER_THAN">Lớn hơn (&gt;)</option>
                    <option value="LESS_THAN">Nhỏ hơn (&lt;)</option>
                    <option value="IS_EMPTY">Để trống (chưa trả lời)</option>
                    <option value="IS_NOT_EMPTY">Không để trống (đã trả lời)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Giá trị so sánh:</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: CONSUMER hoặc 10000000"
                    value={conditionValue}
                    onChange={(e) => setConditionValue(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm"
            >
              Lưu câu hỏi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// =========================================================================
// SUB-COMPONENT: INTERACTIVE PREVIEW SIMULATOR
// =========================================================================
interface InteractivePreviewModalProps {
  questions: QuestionDefinition[];
  questionnaireTitle: string;
  versionNumber: number;
  onClose: () => void;
}

const InteractivePreviewModal: React.FC<InteractivePreviewModalProps> = ({
  questions,
  questionnaireTitle,
  versionNumber,
  onClose,
}) => {
  const [answers, setAnswers] = useState<Record<string, any>>({});

  const handleAnswerChange = (code: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [code]: value,
    }));
  };

  // Evaluate conditional visibility for question
  const isQuestionVisible = (q: QuestionDefinition): boolean => {
    if (!q.conditionalLogic || !q.conditionalLogic.dependsOnQuestionCode) {
      return true;
    }

    const { dependsOnQuestionCode, operator, value } = q.conditionalLogic;
    const sourceAnswer = answers[dependsOnQuestionCode];

    switch (operator) {
      case 'EQUALS':
        return String(sourceAnswer || '') === String(value || '');
      case 'NOT_EQUALS':
        return String(sourceAnswer || '') !== String(value || '');
      case 'GREATER_THAN':
        return Number(sourceAnswer || 0) > Number(value || 0);
      case 'LESS_THAN':
        return Number(sourceAnswer || 0) < Number(value || 0);
      case 'IS_EMPTY':
        return sourceAnswer === undefined || sourceAnswer === null || sourceAnswer === '';
      case 'IS_NOT_EMPTY':
        return sourceAnswer !== undefined && sourceAnswer !== null && sourceAnswer !== '';
      default:
        return true;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl my-8 rounded-xl border border-slate-800 bg-slate-900 p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-slate-100">
                Xem trước trải nghiệm khảo sát (Preview Simulator)
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {questionnaireTitle} · Phiên bản v{versionNumber}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
          {questions.filter((q) => q.active).map((q, idx) => {
            const visible = isQuestionVisible(q);
            if (!visible) return null;

            return (
              <div
                key={q.code}
                className="p-4 rounded-xl border border-slate-800 bg-slate-950/60 space-y-2.5 transition-all"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-blue-400 font-mono">
                    Câu {idx + 1}.
                  </span>
                  <div className="text-xs font-semibold text-slate-100">
                    {q.questionText} {q.isRequired && <span className="text-rose-400">*</span>}
                  </div>
                </div>

                {q.description && (
                  <p className="text-[11px] text-slate-400 italic">
                    {q.description}
                  </p>
                )}

                {/* Input Controls depending on QuestionType */}
                <div className="pt-1">
                  {q.questionType === 'SINGLE_CHOICE' && q.options && (
                    <div className="space-y-2">
                      {q.options.map((opt) => (
                        <label
                          key={opt.id}
                          className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer p-2 rounded-lg hover:bg-slate-900"
                        >
                          <input
                            type="radio"
                            name={q.code}
                            value={opt.value}
                            checked={answers[q.code] === opt.value}
                            onChange={(e) => handleAnswerChange(q.code, e.target.value)}
                            className="w-4 h-4 text-blue-600 border-slate-700 bg-slate-950"
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {q.questionType === 'YES_NO' && (
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                        <input
                          type="radio"
                          name={q.code}
                          value="YES"
                          checked={answers[q.code] === 'YES'}
                          onChange={(e) => handleAnswerChange(q.code, e.target.value)}
                          className="w-4 h-4 text-blue-600 border-slate-700 bg-slate-950"
                        />
                        <span>Có / Đúng</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                        <input
                          type="radio"
                          name={q.code}
                          value="NO"
                          checked={answers[q.code] === 'NO'}
                          onChange={(e) => handleAnswerChange(q.code, e.target.value)}
                          className="w-4 h-4 text-blue-600 border-slate-700 bg-slate-950"
                        />
                        <span>Không / Sai</span>
                      </label>
                    </div>
                  )}

                  {q.questionType === 'CURRENCY' && (
                    <div className="space-y-1">
                      <input
                        type="number"
                        placeholder="Nhập số tiền VND..."
                        value={answers[q.code] || ''}
                        onChange={(e) => handleAnswerChange(q.code, e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                      />
                      {answers[q.code] && (
                        <div className="text-[11px] text-emerald-400 font-mono">
                          ≈ {Number(answers[q.code]).toLocaleString('vi-VN')} VND
                        </div>
                      )}
                    </div>
                  )}

                  {q.questionType === 'NUMBER' && (
                    <input
                      type="number"
                      placeholder="Nhập số lượng / giá trị..."
                      value={answers[q.code] || ''}
                      onChange={(e) => handleAnswerChange(q.code, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                    />
                  )}

                  {q.questionType === 'TEXT' && (
                    <input
                      type="text"
                      placeholder="Nhập câu trả lời..."
                      value={answers[q.code] || ''}
                      onChange={(e) => handleAnswerChange(q.code, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  )}

                  {q.questionType === 'LONG_TEXT' && (
                    <textarea
                      rows={3}
                      placeholder="Nhập chi tiết..."
                      value={answers[q.code] || ''}
                      onChange={(e) => handleAnswerChange(q.code, e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  )}

                  {q.questionType === 'DATE' && (
                    <input
                      type="date"
                      value={answers[q.code] || ''}
                      onChange={(e) => handleAnswerChange(q.code, e.target.value)}
                      className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>* Các câu hỏi phụ thuộc điều kiện sẽ tự động ẩn/hiện theo câu trả lời của bạn.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
          >
            Đóng xem trước
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionnaireManagement;
