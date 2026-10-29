/**
 * AkinatorConfigWorkspace.tsx
 *
 * Comprehensive Admin Configuration Workspace for Akinator:
 * - Version switcher & Version list (DRAFT, PUBLISHED, ARCHIVED)
 * - Question Bank management (Create, Edit, Delete, Search, Filter)
 * - Evaluation Rule Engine management (Create, Edit, Delete, Outcomes)
 * - Metadata editor (Title, maxQuestions, disclaimerText)
 * - Pre-publish Integrity Inspector (calls validateConfig)
 * - Safe Publishing Modal with changeLog
 * - Clone to new Draft flow
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Search,
  Eye,
  GitBranch,
  Sliders,
  Copy,
  Layers,
  Scale,
  Send,
  Loader2,
  RotateCcw,
  Check,
  AlertCircle,
  FileCheck2,
  X,
} from 'lucide-react';
import {
  AkinatorConfigDetail,
  AkinatorConfigSummary,
  AkinatorQuestionItem,
  AkinatorRuleItem,
  AkinatorValidationResult,
  CreateAkinatorDraftInput,
} from '../../types/akinator';
import { akinatorAdminApi } from '../../services/akinatorService';
import { AkinatorQuestionEditorModal } from './AkinatorQuestionEditorModal';
import { AkinatorRuleEditorModal } from './AkinatorRuleEditorModal';
import { formatDate } from '../../utils/formatters';

export const AkinatorConfigWorkspace: React.FC = () => {
  // Versions state
  const [configs, setConfigs] = useState<AkinatorConfigSummary[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [currentConfig, setCurrentConfig] = useState<AkinatorConfigDetail | null>(null);

  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active workspace tab
  const [workspaceTab, setWorkspaceTab] = useState<'questions' | 'rules' | 'metadata' | 'validation'>('questions');

  // Search & filter
  const [questionSearch, setQuestionSearch] = useState<string>('');
  const [questionTypeFilter, setQuestionTypeFilter] = useState<string>('ALL');

  // Question editing modal state
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState<boolean>(false);
  const [editingQuestion, setEditingQuestion] = useState<AkinatorQuestionItem | null>(null);

  // Rule editing modal state
  const [isRuleModalOpen, setIsRuleModalOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<AkinatorRuleItem | null>(null);

  // Create Draft Modal state
  const [isCreateDraftModalOpen, setIsCreateDraftModalOpen] = useState<boolean>(false);
  const [newDraftTitle, setNewDraftTitle] = useState<string>('');
  const [newDraftDescription, setNewDraftDescription] = useState<string>('');
  const [newDraftMaxQuestions, setNewDraftMaxQuestions] = useState<number>(15);
  const [newDraftSourceId, setNewDraftSourceId] = useState<string>('');

  // Publish Modal state
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);
  const [publishChangeLog, setPublishChangeLog] = useState<string>('');
  const [validationResult, setValidationResult] = useState<AkinatorValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState<boolean>(false);

  // Load configs list
  const loadConfigs = useCallback(async () => {
    try {
      setIsLoadingList(true);
      setError(null);
      const data = await akinatorAdminApi.listConfigs();
      setConfigs(data);

      if (data.length > 0) {
        // Default select published current, or first
        const currentPublished = data.find((c) => c.status === 'PUBLISHED' && c.isCurrent);
        const targetId = currentPublished ? currentPublished.id : data[0].id;
        setSelectedConfigId((prev) => (prev && data.some((d) => d.id === prev) ? prev : targetId));
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách phiên bản cấu hình');
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  // Load selected config detail
  const loadConfigDetail = useCallback(async (id: string) => {
    try {
      setIsLoadingDetail(true);
      setError(null);
      const detail = await akinatorAdminApi.getConfigById(id);
      setCurrentConfig(detail);
      setValidationResult(null);
    } catch (err: any) {
      setError(err.message || 'Không thể tải chi tiết phiên bản cấu hình');
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedConfigId) {
      loadConfigDetail(selectedConfigId);
    }
  }, [selectedConfigId, loadConfigDetail]);

  const isDraftMode = currentConfig?.status === 'DRAFT';

  // Flash temporary success message
  const flashSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3500);
  };

  // -------------------------------------------------------------------------
  // Handlers: Question Operations
  // -------------------------------------------------------------------------
  const handleOpenAddQuestion = () => {
    setEditingQuestion(null);
    setIsQuestionModalOpen(true);
  };

  const handleOpenEditQuestion = (q: AkinatorQuestionItem) => {
    setEditingQuestion(q);
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = async (savedQuestion: AkinatorQuestionItem) => {
    if (!currentConfig) return;

    const currentQuestions = currentConfig.questions || [];
    let updatedQuestions: AkinatorQuestionItem[];

    if (editingQuestion) {
      updatedQuestions = currentQuestions.map((q) =>
        q.code === editingQuestion.code ? savedQuestion : q
      );
    } else {
      updatedQuestions = [...currentQuestions, savedQuestion];
    }

    try {
      setIsSaving(true);
      setError(null);
      const updatedConfig = await akinatorAdminApi.saveDraftQuestions(
        currentConfig.id,
        updatedQuestions
      );
      setCurrentConfig(updatedConfig);
      setIsQuestionModalOpen(false);
      flashSuccess(`Đã lưu câu hỏi '${savedQuestion.code}' vào bản nháp thành công!`);
    } catch (err: any) {
      setError(err.message || 'Có lỗi khi lưu câu hỏi vào bản nháp');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteQuestion = async (questionCode: string) => {
    if (!currentConfig || !window.confirm(`Bạn có chắc chắn muốn xóa câu hỏi '${questionCode}' khỏi bản nháp này?`)) {
      return;
    }

    const updatedQuestions = (currentConfig.questions || []).filter((q) => q.code !== questionCode);

    try {
      setIsSaving(true);
      setError(null);
      const updatedConfig = await akinatorAdminApi.saveDraftQuestions(
        currentConfig.id,
        updatedQuestions
      );
      setCurrentConfig(updatedConfig);
      flashSuccess(`Đã xóa câu hỏi '${questionCode}' thành công!`);
    } catch (err: any) {
      setError(err.message || 'Có lỗi khi xóa câu hỏi');
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Rule Operations
  // -------------------------------------------------------------------------
  const handleOpenAddRule = () => {
    setEditingRule(null);
    setIsRuleModalOpen(true);
  };

  const handleOpenEditRule = (r: AkinatorRuleItem) => {
    setEditingRule(r);
    setIsRuleModalOpen(true);
  };

  const handleSaveRule = async (savedRule: AkinatorRuleItem) => {
    if (!currentConfig) return;

    const currentRules = currentConfig.rules || [];
    let updatedRules: AkinatorRuleItem[];

    if (editingRule) {
      updatedRules = currentRules.map((r) =>
        r.code === editingRule.code ? savedRule : r
      );
    } else {
      updatedRules = [...currentRules, savedRule];
    }

    try {
      setIsSaving(true);
      setError(null);
      const updatedConfig = await akinatorAdminApi.saveDraftRules(
        currentConfig.id,
        updatedRules
      );
      setCurrentConfig(updatedConfig);
      setIsRuleModalOpen(false);
      flashSuccess(`Đã lưu quy tắc '${savedRule.code}' vào bản nháp thành công!`);
    } catch (err: any) {
      setError(err.message || 'Có lỗi khi lưu quy tắc vào bản nháp');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRule = async (ruleCode: string) => {
    if (!currentConfig || !window.confirm(`Bạn có chắc chắn muốn xóa quy tắc '${ruleCode}' khỏi bản nháp này?`)) {
      return;
    }

    const updatedRules = (currentConfig.rules || []).filter((r) => r.code !== ruleCode);

    try {
      setIsSaving(true);
      setError(null);
      const updatedConfig = await akinatorAdminApi.saveDraftRules(
        currentConfig.id,
        updatedRules
      );
      setCurrentConfig(updatedConfig);
      flashSuccess(`Đã xóa quy tắc '${ruleCode}' thành công!`);
    } catch (err: any) {
      setError(err.message || 'Có lỗi khi xóa quy tắc');
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Create Draft
  // -------------------------------------------------------------------------
  const handleOpenCreateDraft = (sourceVersionId?: string) => {
    setNewDraftTitle(
      sourceVersionId
        ? `Bản nháp kế tiếp (sao chép từ v${configs.find((c) => c.id === sourceVersionId)?.versionNumber || ''})`
        : 'Cấu hình Akinator mới'
    );
    setNewDraftDescription('');
    setNewDraftMaxQuestions(15);
    setNewDraftSourceId(sourceVersionId || '');
    setIsCreateDraftModalOpen(true);
  };

  const handleConfirmCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDraftTitle.trim()) return;

    try {
      setIsSaving(true);
      setError(null);
      const input: CreateAkinatorDraftInput = {
        title: newDraftTitle.trim(),
        description: newDraftDescription.trim() || null,
        maxQuestionsPerSession: Number(newDraftMaxQuestions) || 15,
        sourceVersionId: newDraftSourceId || undefined,
      };

      const created = await akinatorAdminApi.createDraftConfig(input);
      setIsCreateDraftModalOpen(false);
      await loadConfigs();
      setSelectedConfigId(created.id);
      flashSuccess(`Đã tạo bản nháp v${created.versionNumber} thành công!`);
    } catch (err: any) {
      setError(err.message || 'Không thể tạo bản nháp mới');
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Handlers: Validate & Publish
  // -------------------------------------------------------------------------
  const handleRunValidation = async () => {
    if (!currentConfig) return;
    try {
      setIsValidating(true);
      setError(null);
      const res = await akinatorAdminApi.validateConfig(currentConfig.id);
      setValidationResult(res);
      setWorkspaceTab('validation');
      if (res.isValid) {
        flashSuccess('Cấu hình hợp lệ, không phát hiện lỗi logic!');
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi khi kiểm tra tính toàn vẹn cấu hình');
    } finally {
      setIsValidating(false);
    }
  };

  const handleOpenPublishModal = async () => {
    if (!currentConfig) return;
    setPublishChangeLog('');
    await handleRunValidation();
    setIsPublishModalOpen(true);
  };

  const handleConfirmPublish = async () => {
    if (!currentConfig) return;

    try {
      setIsSaving(true);
      setError(null);
      const published = await akinatorAdminApi.publishConfig(
        currentConfig.id,
        publishChangeLog.trim() || null
      );
      setIsPublishModalOpen(false);
      await loadConfigs();
      setSelectedConfigId(published.id);
      flashSuccess(`Đã xuất bản thành công phiên bản v${published.versionNumber} chính thức!`);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi xuất bản cấu hình');
    } finally {
      setIsSaving(false);
    }
  };

  // Filtered questions
  const filteredQuestions = useMemo(() => {
    if (!currentConfig?.questions) return [];
    return currentConfig.questions.filter((q) => {
      const matchType =
        questionTypeFilter === 'ALL' || q.questionType === questionTypeFilter;
      const matchQuery =
        !questionSearch.trim() ||
        q.code.toLowerCase().includes(questionSearch.toLowerCase()) ||
        q.questionText.toLowerCase().includes(questionSearch.toLowerCase());
      return matchType && matchQuery;
    });
  }, [currentConfig?.questions, questionSearch, questionTypeFilter]);

  return (
    <div className="space-y-6">
      {/* Messages */}
      {successMessage && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Layout: Version Selector (Left) + Detail Workspace (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Version History & Switcher */}
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Phiên bản cấu hình</span>
              </span>
              <button
                type="button"
                onClick={() => handleOpenCreateDraft()}
                className="p-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                title="Tạo bản nháp mới"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {isLoadingList ? (
              <div className="py-6 text-center text-xs text-slate-400 space-y-2">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin mx-auto" />
                <span>Đang tải danh sách phiên bản...</span>
              </div>
            ) : configs.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                Chưa có phiên bản nào. Bấm (+) để tạo bản nháp đầu tiên.
              </div>
            ) : (
              <div className="space-y-2">
                {configs.map((cfg) => {
                  const isSelected = cfg.id === selectedConfigId;
                  return (
                    <button
                      key={cfg.id}
                      type="button"
                      onClick={() => setSelectedConfigId(cfg.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-all text-xs flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500/60 ring-1 ring-blue-500/40 text-blue-100 shadow-sm'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-xs">
                          v{cfg.versionNumber}
                        </span>
                        <div className="flex items-center gap-1">
                          {cfg.status === 'PUBLISHED' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              {cfg.isCurrent ? 'Hiện hành' : 'Xuất bản'}
                            </span>
                          )}
                          {cfg.status === 'DRAFT' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              Bản nháp
                            </span>
                          )}
                          {cfg.status === 'ARCHIVED' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-400">
                              Lưu trữ
                            </span>
                          )}
                        </div>
                      </div>

                      <span className="font-medium text-slate-200 truncate">
                        {cfg.title}
                      </span>

                      <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-800/60">
                        <span>{cfg.status === 'PUBLISHED' ? formatDate(cfg.publishedAt) : formatDate(cfg.updatedAt)}</span>
                        <span>{cfg._count?.questions || 0} câu hỏi</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Config Workspace */}
        <div className="lg:col-span-3 space-y-4">
          {isLoadingDetail ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-xs text-slate-400 space-y-3">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
              <span>Đang tải thông tin cấu hình...</span>
            </div>
          ) : !currentConfig ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-xs text-slate-400">
              Vui lòng chọn một phiên bản cấu hình từ cột bên trái.
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
              {/* Header: Title & Actions */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 text-blue-400">
                      Phiên bản v{currentConfig.versionNumber}
                    </span>
                    {currentConfig.status === 'PUBLISHED' && (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{currentConfig.isCurrent ? 'Đang xuất bản (Hiện hành)' : 'Đã xuất bản'}</span>
                      </span>
                    )}
                    {currentConfig.status === 'DRAFT' && (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                        Bản nháp (Có thể chỉnh sửa)
                      </span>
                    )}
                    {currentConfig.status === 'ARCHIVED' && (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-400">
                        Đã lưu trữ (Lịch sử)
                      </span>
                    )}
                  </div>

                  <h2 className="text-base font-bold text-slate-100">
                    {currentConfig.title}
                  </h2>
                  {currentConfig.description && (
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {currentConfig.description}
                    </p>
                  )}
                </div>

                {/* Workspace Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {isDraftMode ? (
                    <>
                      <button
                        type="button"
                        onClick={handleRunValidation}
                        disabled={isValidating}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
                      >
                        {isValidating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        ) : (
                          <FileCheck2 className="w-3.5 h-3.5 text-blue-400" />
                        )}
                        <span>Kiểm tra hợp lệ</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenPublishModal}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Xuất bản v{currentConfig.versionNumber}</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenCreateDraft(currentConfig.id)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép sang bản nháp mới</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Immutability Banner for Published / Archived */}
              {!isDraftMode && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span>
                    Phiên bản này là <strong>bất biến</strong> để đảm bảo khả năng truy vết cho các phiên làm bài trước. Để chỉnh sửa câu hỏi hoặc luật, vui lòng bấm <strong>"Sao chép sang bản nháp mới"</strong>.
                  </span>
                </div>
              )}

              {/* Workspace Navigation Tabs */}
              <div className="flex border-b border-slate-800 gap-4 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setWorkspaceTab('questions')}
                  className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                    workspaceTab === 'questions'
                      ? 'border-blue-500 text-blue-400 font-semibold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Ngân hàng câu hỏi ({currentConfig.questions?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkspaceTab('rules')}
                  className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                    workspaceTab === 'rules'
                      ? 'border-blue-500 text-blue-400 font-semibold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>Quy tắc đánh giá ({currentConfig.rules?.length || 0})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setWorkspaceTab('validation')}
                  className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
                    workspaceTab === 'validation'
                      ? 'border-blue-500 text-blue-400 font-semibold'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FileCheck2 className="w-3.5 h-3.5" />
                  <span>Kiểm tra toàn vẹn</span>
                </button>
              </div>

              {/* =================================================================== */}
              {/* TAB 1: QUESTIONS MANAGEMENT */}
              {/* =================================================================== */}
              {workspaceTab === 'questions' && (
                <div className="space-y-4">
                  {/* Toolbar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          value={questionSearch}
                          onChange={(e) => setQuestionSearch(e.target.value)}
                          placeholder="Tìm câu hỏi theo mã hoặc nội dung..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-slate-200 placeholder-slate-500 outline-none focus:border-blue-500"
                        />
                      </div>

                      <select
                        value={questionTypeFilter}
                        onChange={(e) => setQuestionTypeFilter(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 outline-none"
                      >
                        <option value="ALL">Tất cả loại câu hỏi</option>
                        <option value="SINGLE_CHOICE">Một lựa chọn</option>
                        <option value="MULTIPLE_CHOICE">Nhiều lựa chọn</option>
                        <option value="YES_NO">Có/Không</option>
                        <option value="CURRENCY">Số tiền (VND)</option>
                        <option value="NUMBER">Số lượng</option>
                        <option value="TEXT">Văn bản</option>
                        <option value="DATE">Ngày tháng</option>
                      </select>
                    </div>

                    {isDraftMode && (
                      <button
                        type="button"
                        onClick={handleOpenAddQuestion}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium shadow-sm transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm câu hỏi mới</span>
                      </button>
                    )}
                  </div>

                  {/* Question Cards */}
                  {filteredQuestions.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                      Không tìm thấy câu hỏi nào phù hợp với bộ lọc.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredQuestions.map((q, idx) => (
                        <div
                          key={q.code || idx}
                          className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                  {q.code}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                                  {q.questionType}
                                </span>
                                {q.isEntryQuestion && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-400 font-semibold">
                                    Mở đầu (Entry)
                                  </span>
                                )}
                                {q.isRequiredForEval && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
                                    Bắt buộc đánh giá
                                  </span>
                                )}
                                {q.mapsToCustomerField && q.mapsToCustomerField !== 'NONE' && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                                    → {q.mapsToCustomerField}
                                  </span>
                                )}
                              </div>

                              <h3 className="font-semibold text-sm text-slate-100">
                                {q.questionText}
                              </h3>
                              {q.description && (
                                <p className="text-xs text-slate-400">
                                  {q.description}
                                </p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenEditQuestion(q)}
                                className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors"
                                title={isDraftMode ? 'Chỉnh sửa câu hỏi' : 'Xem chi tiết'}
                              >
                                {isDraftMode ? <Edit className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>

                              {isDraftMode && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteQuestion(q.code)}
                                  className="p-1.5 rounded bg-slate-900 hover:bg-red-950/60 text-slate-400 hover:text-red-400 transition-colors"
                                  title="Xóa câu hỏi này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Extra info: options, visibility, branching */}
                          <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-2 border-t border-slate-900 flex-wrap">
                            {q.options && q.options.length > 0 && (
                              <span>{q.options.length} phương án trả lời</span>
                            )}
                            {q.visibilityConditions?.conditions?.length ? (
                              <span className="text-amber-400/90 flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                <span>Có điều kiện hiển thị ({q.visibilityConditions.conditions.length})</span>
                              </span>
                            ) : null}
                            {q.nextQuestionRules?.length ? (
                              <span className="text-blue-400/90 flex items-center gap-1">
                                <GitBranch className="w-3 h-3" />
                                <span>Rẽ nhánh ({q.nextQuestionRules.length} quy tắc)</span>
                              </span>
                            ) : null}
                            <span>Trọng số ưu tiên: {q.priorityWeight}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* =================================================================== */}
              {/* TAB 2: RULES MANAGEMENT */}
              {/* =================================================================== */}
              {workspaceTab === 'rules' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-slate-400">
                      Quy tắc đánh giá kết quả tham khảo theo thứ tự ưu tiên (Rule Engine).
                    </p>
                    {isDraftMode && (
                      <button
                        type="button"
                        onClick={handleOpenAddRule}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium shadow-sm transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm quy tắc mới</span>
                      </button>
                    )}
                  </div>

                  {(!currentConfig.rules || currentConfig.rules.length === 0) ? (
                    <div className="py-12 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                      Chưa có quy tắc đánh giá nào. Bấm (+) để thêm quy tắc đầu tiên.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentConfig.rules.map((r, idx) => (
                        <div
                          key={r.code || idx}
                          className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  #{r.priorityOrder} {r.code}
                                </span>
                                <span className="font-semibold text-sm text-slate-100">
                                  {r.name}
                                </span>
                              </div>
                              {r.description && (
                                <p className="text-xs text-slate-400">
                                  {r.description}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditRule(r)}
                                className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 transition-colors"
                                title={isDraftMode ? 'Chỉnh sửa quy tắc' : 'Xem chi tiết'}
                              >
                                {isDraftMode ? <Edit className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                              {isDraftMode && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRule(r.code)}
                                  className="p-1.5 rounded bg-slate-900 hover:bg-red-950/60 text-slate-400 hover:text-red-400 transition-colors"
                                  title="Xóa quy tắc này"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Outcome summary preview */}
                          {r.outcomePayload && (
                            <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 text-xs space-y-1">
                              <div className="flex items-center justify-between text-slate-400">
                                <span className="font-mono text-blue-400 font-semibold">
                                  [{r.outcomePayload.categoryCode}] {r.outcomePayload.categoryLabel}
                                </span>
                                {r.outcomePayload.suggestedPriority && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                                    Ưu tiên: {r.outcomePayload.suggestedPriority}
                                  </span>
                                )}
                              </div>
                              <div className="font-medium text-slate-200">
                                {r.outcomePayload.referenceTitle}
                              </div>
                              <p className="text-slate-400 text-[11px] leading-relaxed">
                                {r.outcomePayload.referenceSummary}
                              </p>
                            </div>
                          )}

                          <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1 border-t border-slate-900">
                            <span>{r.conditions?.conditions?.length || 0} điều kiện khớp</span>
                            <span>{r.requiredQuestionCodes?.length || 0} câu hỏi bắt buộc</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* =================================================================== */}
              {/* TAB 3: VALIDATION INSPECTOR */}
              {/* =================================================================== */}
              {workspaceTab === 'validation' && (
                <div className="space-y-4 text-xs">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-slate-200 block">
                          Trình kiểm tra tính toàn vẹn cây câu hỏi & luật (Validation Inspector)
                        </span>
                        <p className="text-[11px] text-slate-400">
                          Backend sẽ phân tích chu trình lặp vô hạn (Cycle Detection), câu hỏi mồ côi và tính đầy đủ của các quy tắc.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleRunValidation}
                        disabled={isValidating}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold transition-all disabled:opacity-50"
                      >
                        {isValidating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span>Chạy kiểm tra ngay</span>
                      </button>
                    </div>

                    {validationResult && (
                      <div className="pt-3 border-t border-slate-800 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-300">Trạng thái:</span>
                          {validationResult.isValid ? (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>HỢP LỆ — ĐỦ ĐIỀU KIỆN XUẤT BẢN</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-500/10 border border-red-500/30 text-red-400 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>KHÔNG HỢP LỆ — CẦN KHẮC PHỤC LỖI</span>
                            </span>
                          )}
                        </div>

                        {validationResult.errors.length > 0 && (
                          <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl space-y-1.5 text-red-300">
                            <span className="font-semibold block text-red-200">
                              Danh sách lỗi cần sửa ({validationResult.errors.length}):
                            </span>
                            <ul className="list-disc list-inside space-y-1">
                              {validationResult.errors.map((err, i) => (
                                <li key={i}>{err}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {validationResult.warnings.length > 0 && (
                          <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-xl space-y-1.5 text-amber-300">
                            <span className="font-semibold block text-amber-200">
                              Cảnh báo lưu ý ({validationResult.warnings.length}):
                            </span>
                            <ul className="list-disc list-inside space-y-1">
                              {validationResult.warnings.map((w, i) => (
                                <li key={i}>{w}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CREATE DRAFT */}
      {/* ========================================================================= */}
      {isCreateDraftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-base text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-400" />
                <span>Tạo bản nháp cấu hình mới</span>
              </h3>
              <button
                onClick={() => setIsCreateDraftModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCreateDraft} className="space-y-4 text-xs">
              <div>
                <label className="font-medium text-slate-300 block mb-1">
                  Tiêu đề cấu hình <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newDraftTitle}
                  onChange={(e) => setNewDraftTitle(e.target.value)}
                  placeholder="Ví dụ: Cấu hình Akinator Tài Chính Cá Nhân v2"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-medium text-slate-300 block mb-1">
                  Mô tả cấu hình
                </label>
                <textarea
                  rows={2}
                  value={newDraftDescription}
                  onChange={(e) => setNewDraftDescription(e.target.value)}
                  placeholder="Mô tả mục tiêu của phiên bản cấu hình này..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="font-medium text-slate-300 block mb-1">
                  Sao chép từ phiên bản nguồn (Clone Source):
                </label>
                <select
                  value={newDraftSourceId}
                  onChange={(e) => setNewDraftSourceId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 outline-none"
                >
                  <option value="">-- Tạo bản nháp trống (Không sao chép) --</option>
                  {configs.map((c) => (
                    <option key={c.id} value={c.id}>
                      v{c.versionNumber} — {c.title} ({c.status})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Nếu chọn phiên bản nguồn, toàn bộ câu hỏi và luật của phiên bản đó sẽ được sao chép sang bản nháp mới.
                </p>
              </div>

              <div>
                <label className="font-medium text-slate-300 block mb-1">
                  Giới hạn số câu hỏi tối đa / phiên (maxQuestionsPerSession):
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={newDraftMaxQuestions}
                  onChange={(e) => setNewDraftMaxQuestions(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateDraftModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center gap-1.5"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Tạo bản nháp</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PUBLISH CONFIRMATION */}
      {/* ========================================================================= */}
      {isPublishModalOpen && currentConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-semibold text-base text-slate-100 flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-400" />
                <span>Xác nhận xuất bản phiên bản v{currentConfig.versionNumber}</span>
              </h3>
              <button
                onClick={() => setIsPublishModalOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-amber-950/30 border border-amber-500/40 rounded-xl p-3.5 text-amber-200 space-y-1.5">
                <div className="font-semibold flex items-center gap-1.5 text-amber-300">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Lưu ý quan trọng về tính bất biến:</span>
                </div>
                <p className="leading-relaxed text-[11px] text-amber-200/90">
                  Sau khi xuất bản, phiên bản này sẽ trở thành <strong>phiên bản hoạt động chính thức</strong> cho khách hàng làm quiz. Phiên bản này sẽ trở thành <strong>BẤT BIẾN</strong> và không thể sửa trực tiếp được nữa.
                </p>
              </div>

              {/* Validation Status summary */}
              <div>
                <span className="font-medium text-slate-300 block mb-1">
                  Trạng thái kiểm tra tính toàn vẹn:
                </span>
                {validationResult?.isValid ? (
                  <div className="p-2.5 bg-emerald-950/30 border border-emerald-500/30 rounded-lg text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>Cấu hình hợp lệ và đủ điều kiện xuất bản</span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-red-950/30 border border-red-500/30 rounded-lg text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span>Cấu hình đang có lỗi logic. Không thể xuất bản!</span>
                  </div>
                )}
              </div>

              <div>
                <label className="font-medium text-slate-300 block mb-1">
                  Ghi chú xuất bản / Nhật ký thay đổi (ChangeLog):
                </label>
                <textarea
                  rows={2}
                  value={publishChangeLog}
                  onChange={(e) => setPublishChangeLog(e.target.value)}
                  placeholder="Ghi chú tóm tắt nội dung thay đổi của phiên bản này..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPublishModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPublish}
                  disabled={isSaving || !validationResult?.isValid}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-emerald-600/30"
                >
                  {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Xác nhận xuất bản</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Question Editor Modal */}
      <AkinatorQuestionEditorModal
        isOpen={isQuestionModalOpen}
        question={editingQuestion}
        existingQuestions={currentConfig?.questions || []}
        onClose={() => setIsQuestionModalOpen(false)}
        onSave={handleSaveQuestion}
      />

      {/* Rule Editor Modal */}
      <AkinatorRuleEditorModal
        isOpen={isRuleModalOpen}
        rule={editingRule}
        availableQuestions={currentConfig?.questions || []}
        existingRules={currentConfig?.rules || []}
        onClose={() => setIsRuleModalOpen(false)}
        onSave={handleSaveRule}
      />
    </div>
  );
};
