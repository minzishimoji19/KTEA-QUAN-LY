/**
 * AkinatorSessionDetailModal.tsx
 *
 * Dedicated Admin Drawer/Modal for viewing and processing completed Akinator Quiz Sessions:
 * - Section A: Thông tin phiên quiz (Metadata, version, quiz status, completion time)
 * - Section B: Thông tin người tham gia & Đối chiếu Dữ liệu gốc vs Dữ liệu xử lý
 * - Section C: Câu trả lời gốc của khách hàng (Immutable raw answers, step by step)
 * - Section D: Kết quả đánh giá sơ bộ (Preliminary evaluation, categories, disclaimer)
 * - Section E: Dữ liệu xử lý của Admin (Separate editable review form & notes)
 * - Section F: Chuyển đổi trạng thái quy trình (Workflow state machine transitions)
 * - Section G: Lịch sử xử lý & Kiểm toán (Audit trail & status history)
 *
 * Strict boundary:
 * - Raw answers (`AkinatorRawAnswer`) are 100% immutable and read-only.
 * - CRM customer creation / data transfer is NOT implemented in Phase 5.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  FileText,
  UserCheck,
  CheckCircle,
  Clock,
  AlertTriangle,
  History,
  ShieldCheck,
  Save,
  RotateCcw,
  Check,
  Info,
  MessageSquare,
  AlertCircle,
  Copy,
  ChevronRight,
  Send,
  FileCheck,
  UserPlus,
  ExternalLink,
} from 'lucide-react';
import { akinatorAdminApi } from '../../services/akinatorService';
import {
  AkinatorSessionDetail,
  AkinatorWorkflowStatus,
  Gender,
  PriorityLevel,
  UpdateAkinatorReviewInput,
  CheckDuplicateCustomerResponse,
  TransferAkinatorSessionResponse,
  TransferAkinatorSessionInput,
} from '../../types/akinator';
import { formatDateTime, formatDate, parseStrictDateInput } from '../../utils/formatters';

interface AkinatorSessionDetailModalProps {
  sessionId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSessionUpdated: () => void;
}

type ModalTab = 'overview' | 'answers' | 'result' | 'review' | 'history';

// Workflow Transition Rules matching Phase 2 Backend
const ALLOWED_TRANSITIONS: Record<AkinatorWorkflowStatus, AkinatorWorkflowStatus[]> = {
  PENDING_PROCESSING: ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['NEEDS_MORE_INFO', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
  NEEDS_MORE_INFO: ['IN_PROGRESS', 'REJECTED'],
  PENDING_APPROVAL: ['APPROVED', 'NEEDS_MORE_INFO', 'REJECTED'],
  APPROVED: ['IN_PROGRESS'],
  REJECTED: ['IN_PROGRESS'],
  TRANSFERRED: [],
};

const WORKFLOW_STATUS_CONFIG: Record<
  AkinatorWorkflowStatus,
  { label: string; badgeClass: string; desc: string }
> = {
  PENDING_PROCESSING: {
    label: 'Chờ xử lý',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    desc: 'Hồ sơ mới hoàn thành quiz, đang chờ Admin tiếp nhận.',
  },
  IN_PROGRESS: {
    label: 'Đang xử lý',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    desc: 'Admin đang liên hệ, tư vấn hoặc rà soát thông tin.',
  },
  NEEDS_MORE_INFO: {
    label: 'Cần bổ sung',
    badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    desc: 'Thiếu thông tin, đang chờ khách hàng hoặc đối tác bổ sung.',
  },
  PENDING_APPROVAL: {
    label: 'Chờ duyệt',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    desc: 'Hồ sơ đã hoàn tất tư vấn, đang chờ Admin có thẩm quyền xét duyệt.',
  },
  APPROVED: {
    label: 'Đã duyệt',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    desc: 'Hồ sơ đã được phê duyệt, sẵn sàng cho bước chuyển sang CRM.',
  },
  TRANSFERRED: {
    label: 'Đã chuyển CRM',
    badgeClass: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
    desc: 'Đã chuyển sang danh sách khách hàng chính thức.',
  },
  REJECTED: {
    label: 'Từ chối',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    desc: 'Hồ sơ không đáp ứng hoặc khách hàng từ chối tiếp tục.',
  },
};

const PRIORITY_LABELS: Record<PriorityLevel, string> = {
  CHUA_CO_NHU_CAU: 'Chưa có nhu cầu',
  THANH_KHOAN: 'Thanh khoản',
  TIN_DUNG: 'Tín dụng',
  THANH_KHOAN_TIN_DUNG: 'Thanh khoản & Tín dụng',
};

export const AkinatorSessionDetailModal: React.FC<AkinatorSessionDetailModalProps> = ({
  sessionId,
  isOpen,
  onClose,
  onSessionUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('overview');
  const [session, setSession] = useState<AkinatorSessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCopiedId, setIsCopiedId] = useState<boolean>(false);

  // Editable Admin Review Form State
  const [editedFullName, setEditedFullName] = useState<string>('');
  const [editedPhone, setEditedPhone] = useState<string>('');
  const [editedEmail, setEditedEmail] = useState<string>('');
  const [editedGender, setEditedGender] = useState<Gender | ''>('');
  const [editedDateOfBirth, setEditedDateOfBirth] = useState<string>('');
  const [editedAddress, setEditedAddress] = useState<string>('');
  const [editedSource, setEditedSource] = useState<string>('');
  const [editedPriority, setEditedPriority] = useState<PriorityLevel | ''>('');
  const [processorNote, setProcessorNote] = useState<string>('');
  const [missingInfoNote, setMissingInfoNote] = useState<string>('');
  const [approvalNote, setApprovalNote] = useState<string>('');

  const [isSavingReview, setIsSavingReview] = useState<boolean>(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null);
  const [reviewErrorMsg, setReviewErrorMsg] = useState<string | null>(null);

  // Workflow Transition Dialog State
  const [transitionTarget, setTransitionTarget] = useState<AkinatorWorkflowStatus | null>(null);
  const [transitionNote, setTransitionNote] = useState<string>('');
  const [transitionSpecificNote, setTransitionSpecificNote] = useState<string>('');
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [transitionErrorMsg, setTransitionErrorMsg] = useState<string | null>(null);

  // Phase 6 Transfer Dialog State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState<boolean>(false);
  const [duplicateCheckResult, setDuplicateCheckResult] = useState<CheckDuplicateCustomerResponse | null>(null);
  const [transferMode, setTransferMode] = useState<'LINK_EXISTING' | 'CREATE_NEW'>('CREATE_NEW');
  const [selectedCustomerIdForLink, setSelectedCustomerIdForLink] = useState<string | null>(null);
  const [confirmCreateNewChecked, setConfirmCreateNewChecked] = useState<boolean>(false);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState<boolean>(false);
  const [transferErrorMsg, setTransferErrorMsg] = useState<string | null>(null);
  const [transferSuccessResult, setTransferSuccessResult] = useState<TransferAkinatorSessionResponse | null>(null);

  const fetchSessionDetail = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const detail = await akinatorAdminApi.getSessionDetail(id);
      setSession(detail);

      // Populate Admin Review Form
      const rev = detail.adminReview;
      setEditedFullName(rev?.editedFullName ?? detail.rawFullName ?? '');
      setEditedPhone(rev?.editedPhone ?? detail.rawPhone ?? '');
      setEditedEmail(rev?.editedEmail ?? detail.rawEmail ?? '');
      setEditedGender(rev?.editedGender ?? '');
      setEditedDateOfBirth(
        rev?.editedDateOfBirth ? formatDate(rev.editedDateOfBirth) : ''
      );
      setEditedAddress(rev?.editedAddress ?? '');
      setEditedSource(rev?.editedSource ?? 'Akinator Web Quiz');
      setEditedPriority(
        rev?.editedPriority ?? detail.result?.outcomeData?.primaryPriority ?? ''
      );
      setProcessorNote(rev?.processorNote ?? '');
      setMissingInfoNote(rev?.missingInfoNote ?? '');
      setApprovalNote(rev?.approvalNote ?? '');
    } catch (err: any) {
      setLoadError(err.message || 'Không thể tải chi tiết hồ sơ Akinator');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && sessionId) {
      setActiveTab('overview');
      setReviewSuccessMsg(null);
      setReviewErrorMsg(null);
      setTransitionTarget(null);
      fetchSessionDetail(sessionId);
    } else {
      setSession(null);
    }
  }, [isOpen, sessionId, fetchSessionDetail]);

  const handleCopyId = () => {
    if (!session) return;
    navigator.clipboard.writeText(session.id);
    setIsCopiedId(true);
    setTimeout(() => setIsCopiedId(false), 2000);
  };

  const handleSaveReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session) return;

    try {
      setIsSavingReview(true);
      setReviewSuccessMsg(null);
      setReviewErrorMsg(null);

      // Validate dob if provided
      let formattedDob: string | null = null;
      if (editedDateOfBirth.trim()) {
        const parsed = parseStrictDateInput(editedDateOfBirth.trim());
        if (!parsed.valid || !parsed.displayDate) {
          throw new Error(parsed.error || 'Ngày sinh không hợp lệ (định dạng dd/MM/yyyy)');
        }
        formattedDob = parsed.displayDate;
      }

      const payload: UpdateAkinatorReviewInput = {
        editedFullName: editedFullName.trim() || null,
        editedPhone: editedPhone.trim() || null,
        editedEmail: editedEmail.trim() || null,
        editedGender: (editedGender as Gender) || null,
        editedDateOfBirth: formattedDob,
        editedAddress: editedAddress.trim() || null,
        editedSource: editedSource.trim() || null,
        editedPriority: (editedPriority as PriorityLevel) || null,
        processorNote: processorNote.trim() || null,
        missingInfoNote: missingInfoNote.trim() || null,
        approvalNote: approvalNote.trim() || null,
      };

      await akinatorAdminApi.updateAdminReview(session.id, payload);
      setReviewSuccessMsg('Đã lưu dữ liệu xử lý thành công!');
      await fetchSessionDetail(session.id);
      onSessionUpdated();
    } catch (err: any) {
      setReviewErrorMsg(err.message || 'Lỗi khi lưu dữ liệu xử lý');
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleOpenTransitionDialog = (target: AkinatorWorkflowStatus) => {
    setTransitionTarget(target);
    setTransitionNote('');
    setTransitionSpecificNote('');
    setTransitionErrorMsg(null);
  };

  const handleExecuteTransition = async () => {
    if (!session || !transitionTarget) return;

    try {
      setIsTransitioning(true);
      setTransitionErrorMsg(null);

      const effectiveFullName = editedFullName.trim() || session.rawFullName || '';
      const effectivePhone = editedPhone.trim() || session.rawPhone || '';

      if (
        (transitionTarget === 'PENDING_APPROVAL' || transitionTarget === 'APPROVED') &&
        (!effectiveFullName || !effectivePhone)
      ) {
        throw new Error(
          'Hồ sơ cần có đầy đủ Họ tên và Số điện thoại trong dữ liệu xử lý trước khi Trình duyệt hoặc Phê duyệt'
        );
      }

      if (transitionTarget === 'NEEDS_MORE_INFO' && !transitionSpecificNote.trim()) {
        throw new Error('Vui lòng nhập nội dung thông tin cần bổ sung');
      }

      if (transitionTarget === 'REJECTED' && !transitionSpecificNote.trim()) {
        throw new Error('Vui lòng nhập lý do từ chối hồ sơ');
      }

      await akinatorAdminApi.transitionWorkflowStatus(session.id, {
        toStatus: transitionTarget,
        note: transitionNote.trim() || undefined,
        missingInfoNote:
          transitionTarget === 'NEEDS_MORE_INFO'
            ? transitionSpecificNote.trim()
            : undefined,
        approvalNote:
          transitionTarget === 'APPROVED' || transitionTarget === 'PENDING_APPROVAL'
            ? transitionSpecificNote.trim() || undefined
            : undefined,
        rejectionReason:
          transitionTarget === 'REJECTED' ? transitionSpecificNote.trim() : undefined,
      });

      setTransitionTarget(null);
      await fetchSessionDetail(session.id);
      onSessionUpdated();
    } catch (err: any) {
      setTransitionErrorMsg(err.message || 'Không thể chuyển trạng thái');
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleStartTransferFlow = async () => {
    if (!session) return;
    setIsTransferModalOpen(true);
    setDuplicateCheckResult(null);
    setTransferErrorMsg(null);
    setTransferSuccessResult(null);
    setSelectedCustomerIdForLink(null);
    setConfirmCreateNewChecked(false);

    try {
      setIsCheckingDuplicate(true);
      const res = await akinatorAdminApi.checkDuplicateCustomer(session.id);
      setDuplicateCheckResult(res);
      if (res.hasDuplicate && res.matches.length > 0) {
        setTransferMode('LINK_EXISTING');
        setSelectedCustomerIdForLink(res.matches[0].id);
      } else {
        setTransferMode('CREATE_NEW');
      }
    } catch (err: any) {
      setTransferErrorMsg(err.message || 'Không thể kiểm tra khách hàng trùng');
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  const handleExecuteTransfer = async () => {
    if (!session) return;

    try {
      setIsSubmittingTransfer(true);
      setTransferErrorMsg(null);

      const payload: TransferAkinatorSessionInput = {
        mode: transferMode,
        existingCustomerId:
          transferMode === 'LINK_EXISTING' ? selectedCustomerIdForLink || undefined : undefined,
        confirmCreateNew:
          transferMode === 'CREATE_NEW' ? confirmCreateNewChecked : undefined,
      };

      const result = await akinatorAdminApi.transferSession(session.id, payload);
      setTransferSuccessResult(result);
      await fetchSessionDetail(session.id);
      onSessionUpdated();
    } catch (err: any) {
      setTransferErrorMsg(err.message || 'Lỗi khi chuyển hồ sơ sang Khách hàng');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-100 font-mono truncate">
                  Chi tiết Hồ sơ Akinator
                </h2>
                {session?.workflowStatus && (
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                      WORKFLOW_STATUS_CONFIG[session.workflowStatus]?.badgeClass ||
                      'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {WORKFLOW_STATUS_CONFIG[session.workflowStatus]?.label ||
                      session.workflowStatus}
                  </span>
                )}
                {session?.quizStatus === 'COMPLETED' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle className="w-3 h-3" />
                    Quiz hoàn tất
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/30">
                    <Clock className="w-3 h-3" />
                    {session?.quizStatus || 'Đang thực hiện'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                <span className="font-mono text-slate-300">ID: {session?.id || sessionId}</span>
                <button
                  type="button"
                  onClick={handleCopyId}
                  className="hover:text-blue-400 text-slate-500 transition-colors"
                  title="Sao chép ID hồ sơ"
                >
                  {isCopiedId ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => sessionId && fetchSessionDetail(sessionId)}
              disabled={isLoading}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Làm mới dữ liệu"
            >
              <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-800 bg-slate-900/90 flex gap-4 overflow-x-auto text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Tổng quan & Đối chiếu</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('answers')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'answers'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Câu trả lời gốc</span>
            {session?.rawAnswers && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                {session.rawAnswers.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('result')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'result'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Kết quả sơ bộ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('review')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'review'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Dữ liệu xử lý & Ghi chú</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-3 border-b-2 flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'history'
                ? 'border-blue-500 text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Lịch sử & Kiểm toán</span>
            {session?.statusHistories && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 text-slate-300">
                {session.statusHistories.length}
              </span>
            )}
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading && !session ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-3">
              <RotateCcw className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm">Đang tải chi tiết hồ sơ Akinator...</p>
            </div>
          ) : loadError ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <p className="font-semibold text-sm">Không thể tải hồ sơ</p>
                <p className="text-xs text-rose-400 mt-1">{loadError}</p>
                <button
                  type="button"
                  onClick={() => sessionId && fetchSessionDetail(sessionId)}
                  className="mt-3 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-medium"
                >
                  Thử lại
                </button>
              </div>
            </div>
          ) : !session ? null : (
            <>
              {/* ============================================================= */}
              {/* TAB 1: OVERVIEW & COMPARISON */}
              {/* ============================================================= */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Top Notification / Description */}
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold">
                        <Info className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">
                          Quy trình: {WORKFLOW_STATUS_CONFIG[session.workflowStatus || 'PENDING_PROCESSING']?.label}
                        </div>
                        <div className="text-xs text-slate-400">
                          {WORKFLOW_STATUS_CONFIG[session.workflowStatus || 'PENDING_PROCESSING']?.desc}
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-xs text-slate-400">
                      <div>Hoàn tất: <span className="font-mono text-slate-300">{formatDateTime(session.completedAt)}</span></div>
                      <div>Bộ câu hỏi: <span className="font-semibold text-blue-400">v{session.configVersion.versionNumber} ({session.configVersion.title})</span></div>
                    </div>
                  </div>

                  {/* Side-by-side Contact Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Column 1: Raw Customer Contact Data (Immutable) */}
                    <div className="p-5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div className="flex items-center gap-2 text-slate-200 font-bold text-sm">
                          <ShieldCheck className="w-4 h-4 text-emerald-400" />
                          <span>Dữ liệu khách hàng gốc (Gốc từ Quiz)</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-mono">
                          Bất biến
                        </span>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div>
                          <span className="text-slate-400 block mb-0.5">Họ và tên gốc:</span>
                          <span className="font-medium text-slate-100 text-sm">
                            {session.rawFullName || <span className="text-slate-500 italic">Chưa cung cấp</span>}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 block mb-0.5">Số điện thoại gốc:</span>
                          <span className="font-mono text-slate-200 text-sm">
                            {session.rawPhone || <span className="text-slate-500 italic">Chưa cung cấp</span>}
                          </span>
                        </div>

                        <div>
                          <span className="text-slate-400 block mb-0.5">Email gốc:</span>
                          <span className="text-slate-200">
                            {session.rawEmail || <span className="text-slate-500 italic">Chưa cung cấp</span>}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                          <div>
                            <span>Thời điểm bắt đầu:</span>
                            <div className="font-mono text-slate-300 mt-0.5">{formatDateTime(session.startedAt)}</div>
                          </div>
                          <div>
                            <span>Thời điểm hoàn tất:</span>
                            <div className="font-mono text-slate-300 mt-0.5">{formatDateTime(session.completedAt)}</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Admin Processed Data */}
                    <div className="p-5 rounded-xl bg-slate-900 border border-slate-700/80 space-y-4 shadow-lg">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                        <div className="flex items-center gap-2 text-blue-300 font-bold text-sm">
                          <UserCheck className="w-4 h-4 text-blue-400" />
                          <span>Dữ liệu xử lý của Admin</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('review')}
                          className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                        >
                          <span>Chỉnh sửa</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="space-y-3 text-xs">
                        <div>
                          <span className="text-slate-400 block mb-0.5">Họ và tên chuẩn hóa:</span>
                          <span className="font-medium text-slate-100 text-sm">
                            {session.adminReview?.editedFullName || session.rawFullName || (
                              <span className="text-rose-400 italic">Chưa có tên (cần nhập để duyệt)</span>
                            )}
                          </span>
                          {session.adminReview?.editedFullName &&
                            session.adminReview.editedFullName !== session.rawFullName && (
                              <span className="ml-2 text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                                Đã sửa đổi
                              </span>
                            )}
                        </div>

                        <div>
                          <span className="text-slate-400 block mb-0.5">Số điện thoại xác minh:</span>
                          <span className="font-mono text-slate-200 text-sm">
                            {session.adminReview?.editedPhone || session.rawPhone || (
                              <span className="text-rose-400 italic">Chưa có SĐT (cần nhập để duyệt)</span>
                            )}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-slate-400 block mb-0.5">Giới tính:</span>
                            <span className="text-slate-200">
                              {session.adminReview?.editedGender === 'MALE'
                                ? 'Nam'
                                : session.adminReview?.editedGender === 'FEMALE'
                                ? 'Nữ'
                                : session.adminReview?.editedGender === 'OTHER'
                                ? 'Khác'
                                : '--'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5">Ngày sinh:</span>
                            <span className="font-mono text-slate-200">
                              {session.adminReview?.editedDateOfBirth
                                ? formatDate(session.adminReview.editedDateOfBirth)
                                : '--'}
                            </span>
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-400 block mb-0.5">Địa chỉ cư trú:</span>
                          <span className="text-slate-200">
                            {session.adminReview?.editedAddress || '--'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800">
                          <div>
                            <span className="text-slate-400 block mb-0.5">Nguồn:</span>
                            <span className="text-slate-200 font-medium">
                              {session.adminReview?.editedSource || 'Akinator Web Quiz'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block mb-0.5">Mức độ ưu tiên:</span>
                            <span className="text-blue-400 font-medium">
                              {session.adminReview?.editedPriority
                                ? PRIORITY_LABELS[session.adminReview.editedPriority] ||
                                  session.adminReview.editedPriority
                                : '--'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary of Evaluation Result Preview */}
                  {session.result && (
                    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300">
                          Tóm tắt đánh giá sơ bộ:
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveTab('result')}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                        >
                          <span>Xem toàn bộ kết quả</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-emerald-400">
                        {session.result.summaryTitle}
                      </p>
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {session.result.summaryDescription}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 2: ORIGINAL RAW ANSWERS */}
              {/* ============================================================= */}
              {activeTab === 'answers' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs text-blue-300 flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>
                      Dưới đây là toàn bộ các câu hỏi và câu trả lời gốc được lưu trữ trực tiếp từ lượt làm quiz của khách hàng. Dữ liệu này được bảo toàn nguyên vẹn 100% và không thể chỉnh sửa hoặc xóa bỏ.
                    </span>
                  </div>

                  {session.rawAnswers.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      Chưa ghi nhận câu trả lời nào trong phiên này.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {session.rawAnswers.map((ans, idx) => (
                        <div
                          key={ans.id}
                          className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-[10px]">
                                {ans.stepOrder || idx + 1}
                              </span>
                              <span className="font-mono text-slate-400">
                                [{ans.questionCode}]
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-slate-500">
                              {formatDateTime(ans.answeredAt)}
                            </span>
                          </div>

                          <div className="text-sm font-medium text-slate-100">
                            {ans.questionTextSnapshot}
                          </div>

                          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <span className="text-slate-400 mr-2">Khách hàng chọn/nhập:</span>
                              <span className="font-semibold text-emerald-400 text-sm">
                                {ans.answerLabelSnapshot || String(ans.answerValue)}
                              </span>
                            </div>

                            {ans.selectionReason && (
                              <span className="text-[11px] text-slate-500 italic max-w-sm text-right">
                                Lý do rẽ nhánh: {ans.selectionReason}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 3: PRELIMINARY EVALUATION RESULT */}
              {/* ============================================================= */}
              {activeTab === 'result' && (
                <div className="space-y-6">
                  {!session.result ? (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      Phiên này chưa có kết quả đánh giá sơ bộ từ Rule Engine.
                    </div>
                  ) : (
                    <>
                      {/* Legal & Reference Disclaimer Alert */}
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300 text-xs">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold text-amber-200">
                            Khuyến cáo pháp lý & Tính chất tham khảo:
                          </p>
                          <p className="leading-relaxed">
                            {session.result.disclaimerText ||
                              'Kết quả mang tính chất tham khảo sơ bộ dựa trên luật Rule Engine nội bộ. Đây tuyệt đối không phải cam kết cho vay, thẩm định tín dụng hay chấp thuận pháp lý chính thức.'}
                          </p>
                        </div>
                      </div>

                      {/* Main Summary Header */}
                      <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                              session.result.evaluationStatus === 'EVALUATED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {session.result.evaluationStatus === 'EVALUATED'
                              ? 'Đã có kết quả sơ bộ'
                              : 'Chưa đủ dữ liệu đánh giá'}
                          </span>
                          <span className="text-xs font-mono text-slate-500">
                            Tạo lúc: {formatDateTime(session.result.generatedAt)}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-slate-100">
                          {session.result.summaryTitle}
                        </h3>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
                          {session.result.summaryDescription}
                        </p>
                      </div>

                      {/* Matched Outcome Categories */}
                      {session.result.outcomeData?.categories &&
                        Array.isArray(session.result.outcomeData.categories) &&
                        session.result.outcomeData.categories.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                              Các định hướng & Phân tích chuyên sâu ({session.result.outcomeData.categories.length})
                            </h4>

                            <div className="grid grid-cols-1 gap-4">
                              {session.result.outcomeData.categories.map((cat: any, i: number) => (
                                <div
                                  key={i}
                                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                        {cat.categoryCode || `CAT_${i + 1}`}
                                      </span>
                                      <span className="text-sm font-bold text-slate-100">
                                        {cat.categoryLabel || cat.referenceTitle}
                                      </span>
                                    </div>
                                    {cat.suggestedPriority && (
                                      <span className="text-xs font-medium text-blue-400">
                                        {PRIORITY_LABELS[cat.suggestedPriority as PriorityLevel] || cat.suggestedPriority}
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-xs text-slate-300 leading-relaxed">
                                    {cat.referenceSummary}
                                  </p>

                                  {/* Directions */}
                                  {cat.suggestedDirections && cat.suggestedDirections.length > 0 && (
                                    <div className="space-y-1 pt-2 border-t border-slate-800">
                                      <span className="text-[11px] font-bold text-slate-400 block">
                                        Định hướng gợi ý:
                                      </span>
                                      <ul className="list-disc list-inside space-y-1 text-xs text-slate-300">
                                        {cat.suggestedDirections.map((dir: string, di: number) => (
                                          <li key={di}>{dir}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}

                                  {/* Caution Notes */}
                                  {cat.cautionNotes && cat.cautionNotes.length > 0 && (
                                    <div className="space-y-1 pt-2 border-t border-slate-800">
                                      <span className="text-[11px] font-bold text-amber-400 block">
                                        Lưu ý thận trọng:
                                      </span>
                                      <ul className="list-disc list-inside space-y-1 text-xs text-amber-300/90">
                                        {cat.cautionNotes.map((note: string, ni: number) => (
                                          <li key={ni}>{note}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Missing Criteria If Insufficient Data */}
                      {session.result.missingCriteria &&
                        Array.isArray(session.result.missingCriteria) &&
                        session.result.missingCriteria.length > 0 && (
                          <div className="p-4 rounded-xl bg-orange-950/30 border border-orange-500/30 space-y-2">
                            <span className="text-xs font-bold text-orange-300 flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-orange-400" />
                              Các tiêu chí còn thiếu để đưa ra kết luận:
                            </span>
                            <ul className="list-disc list-inside space-y-1 text-xs text-orange-200">
                              {session.result.missingCriteria.map((c: any, ci: number) => (
                                <li key={ci}>
                                  {c.message || c.questionCode || JSON.stringify(c)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                    </>
                  )}
                </div>
              )}

              {/* ============================================================= */}
              {/* TAB 4: EDITABLE ADMIN REVIEW FORM */}
              {/* ============================================================= */}
              {activeTab === 'review' && (
                <form onSubmit={handleSaveReview} className="space-y-6">
                  <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 flex items-center gap-2.5">
                    <Info className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>
                      Dữ liệu chỉnh sửa dưới đây thuộc bảng riêng biệt (<code className="text-blue-400 font-mono">AkinatorAdminReview</code>) phục vụ cho quá trình tư vấn và xét duyệt của Admin. Câu trả lời gốc của khách hàng hoàn toàn được bảo vệ không bị ghi đè.
                    </span>
                  </div>

                  {reviewSuccessMsg && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      <span>{reviewSuccessMsg}</span>
                    </div>
                  )}

                  {reviewErrorMsg && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span>{reviewErrorMsg}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Họ và tên khách hàng <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={editedFullName}
                        onChange={(e) => setEditedFullName(e.target.value)}
                        placeholder="Nhập họ và tên đầy đủ"
                        disabled={session.workflowStatus === 'TRANSFERRED'}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </div>

                    {/* Phone Number */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Số điện thoại xác minh <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={editedPhone}
                        onChange={(e) => setEditedPhone(e.target.value)}
                        placeholder="Ví dụ: 0912345678"
                        disabled={session.workflowStatus === 'TRANSFERRED'}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Email liên hệ
                      </label>
                      <input
                        type="email"
                        value={editedEmail}
                        onChange={(e) => setEditedEmail(e.target.value)}
                        placeholder="email@example.com"
                        disabled={session.workflowStatus === 'TRANSFERRED'}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Giới tính
                      </label>
                      <select
                        value={editedGender}
                        onChange={(e) => setEditedGender(e.target.value as Gender)}
                        disabled={session.workflowStatus === 'TRANSFERRED'}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      >
                        <option value="">-- Chưa xác định --</option>
                        <option value="MALE">Nam</option>
                        <option value="FEMALE">Nữ</option>
                        <option value="OTHER">Khác</option>
                      </select>
                    </div>

                    {/* Date of Birth */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Ngày sinh (dd/MM/yyyy)
                      </label>
                      <input
                        type="text"
                        value={editedDateOfBirth}
                        onChange={(e) => setEditedDateOfBirth(e.target.value)}
                        placeholder="dd/MM/yyyy (ví dụ: 15/08/1990)"
                        disabled={session.workflowStatus === 'TRANSFERRED'}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50 font-mono"
                      />
                    </div>

                    {/* Priority Level */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Mức độ ưu tiên nhu cầu
                      </label>
                      <select
                        value={editedPriority}
                        onChange={(e) => setEditedPriority(e.target.value as PriorityLevel)}
                        disabled={session.workflowStatus === 'TRANSFERRED'}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      >
                        <option value="">-- Chưa phân loại --</option>
                        <option value="CHUA_CO_NHU_CAU">Chưa có nhu cầu</option>
                        <option value="THANH_KHOAN">Thanh khoản</option>
                        <option value="TIN_DUNG">Tín dụng</option>
                        <option value="THANH_KHOAN_TIN_DUNG">Thanh khoản & Tín dụng</option>
                      </select>
                    </div>

                    {/* Source */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Nguồn khách hàng
                      </label>
                      <input
                        type="text"
                        value={editedSource}
                        onChange={(e) => setEditedSource(e.target.value)}
                        placeholder="Akinator Web Quiz / Giới thiệu / v.v."
                        disabled={session.workflowStatus === 'TRANSFERRED'}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </div>

                    {/* Address */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Địa chỉ cư trú
                      </label>
                      <input
                        type="text"
                        value={editedAddress}
                        onChange={(e) => setEditedAddress(e.target.value)}
                        placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành phố"
                        disabled={session.workflowStatus === 'TRANSFERRED'}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </div>

                    {/* Processor Note */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Ghi chú quá trình tư vấn & xử lý của Admin
                      </label>
                      <textarea
                        rows={3}
                        value={processorNote}
                        onChange={(e) => setProcessorNote(e.target.value)}
                        placeholder="Ghi nhận lại nội dung trao đổi qua điện thoại, mong muốn cụ thể của khách..."
                        disabled={session.workflowStatus === 'TRANSFERRED'}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50 resize-y"
                      />
                    </div>

                    {/* Missing Info Note */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Ghi chú thông tin cần bổ sung (nếu có)
                      </label>
                      <textarea
                        rows={2}
                        value={missingInfoNote}
                        onChange={(e) => setMissingInfoNote(e.target.value)}
                        placeholder="Liệt kê giấy tờ, thông tin tài chính hoặc số liệu cần khách cung cấp thêm..."
                        disabled={session.workflowStatus === 'TRANSFERRED'}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50 resize-y"
                      />
                    </div>

                    {/* Approval Note */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Ghi chú phê duyệt (nếu có)
                      </label>
                      <textarea
                        rows={2}
                        value={approvalNote}
                        onChange={(e) => setApprovalNote(e.target.value)}
                        placeholder="Ý kiến chỉ đạo hoặc kết luận thẩm định trước khi phê duyệt..."
                        disabled={session.workflowStatus === 'TRANSFERRED'}
                        className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50 resize-y"
                      />
                    </div>
                  </div>

                  {session.workflowStatus !== 'TRANSFERRED' && (
                    <div className="flex justify-end pt-2 border-t border-slate-800">
                      <button
                        type="submit"
                        disabled={isSavingReview}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        <span>{isSavingReview ? 'Đang lưu...' : 'Lưu dữ liệu xử lý'}</span>
                      </button>
                    </div>
                  )}
                </form>
              )}

              {/* ============================================================= */}
              {/* TAB 5: AUDIT TRAIL & STATUS HISTORY */}
              {/* ============================================================= */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>
                      Nhật ký kiểm toán ghi nhận mọi lần thay đổi trạng thái, cập nhật dữ liệu xử lý và người thực hiện thao tác.
                    </span>
                  </div>

                  {session.statusHistories.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      Chưa có lịch sử trạng thái được ghi nhận.
                    </div>
                  ) : (
                    <div className="relative border-l-2 border-slate-800 ml-4 space-y-6 py-2">
                      {session.statusHistories.map((hist) => (
                        <div key={hist.id} className="relative pl-6">
                          {/* Dot icon */}
                          <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-900 border-2 border-blue-500 flex items-center justify-center" />

                          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-2">
                            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-200">
                                  {hist.actionType}
                                </span>
                                {hist.fromStatus && (
                                  <span className="text-slate-400">
                                    từ{' '}
                                    <span className="font-mono text-amber-400">
                                      {hist.fromStatus}
                                    </span>
                                  </span>
                                )}
                                <span className="text-slate-400">
                                  sang{' '}
                                  <span className="font-mono text-emerald-400">
                                    {hist.toStatus}
                                  </span>
                                </span>
                              </div>
                              <span className="font-mono text-slate-500 text-[11px]">
                                {formatDateTime(hist.createdAt)}
                              </span>
                            </div>

                            {hist.note && (
                              <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                                {hist.note}
                              </p>
                            )}

                            {hist.changedFieldsSnapshot &&
                              Array.isArray(hist.changedFieldsSnapshot) &&
                              hist.changedFieldsSnapshot.length > 0 && (
                                <div className="text-[11px] text-slate-400">
                                  <span>Các trường cập nhật: </span>
                                  <span className="font-mono text-blue-400">
                                    {hist.changedFieldsSnapshot.join(', ')}
                                  </span>
                                </div>
                              )}

                            <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
                              <span>Người thực hiện:</span>
                              <span className="font-medium text-slate-300">
                                {hist.actorEmail || 'Hệ thống'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Bottom: Workflow Transition Action Bar */}
        {session && session.workflowStatus && (
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-400">
              Trạng thái hiện tại:{' '}
              <span className="font-bold text-slate-200">
                {WORKFLOW_STATUS_CONFIG[session.workflowStatus]?.label}
              </span>
            </div>

            {/* Dynamic Action Buttons matching allowed transitions */}
            <div className="flex items-center gap-2 flex-wrap">
              {(ALLOWED_TRANSITIONS[session.workflowStatus] || []).map((target) => {
                if (target === 'IN_PROGRESS') {
                  return (
                    <button
                      key={target}
                      type="button"
                      onClick={() => handleOpenTransitionDialog(target)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all"
                    >
                      {session.workflowStatus === 'PENDING_PROCESSING'
                        ? 'Tiếp nhận xử lý'
                        : 'Mở lại xử lý'}
                    </button>
                  );
                }
                if (target === 'NEEDS_MORE_INFO') {
                  return (
                    <button
                      key={target}
                      type="button"
                      onClick={() => handleOpenTransitionDialog(target)}
                      className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow-sm transition-all"
                    >
                      Yêu cầu bổ sung
                    </button>
                  );
                }
                if (target === 'PENDING_APPROVAL') {
                  return (
                    <button
                      key={target}
                      type="button"
                      onClick={() => handleOpenTransitionDialog(target)}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-all"
                    >
                      Trình duyệt hồ sơ
                    </button>
                  );
                }
                if (target === 'APPROVED') {
                  return (
                    <button
                      key={target}
                      type="button"
                      onClick={() => handleOpenTransitionDialog(target)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Phê duyệt hồ sơ</span>
                    </button>
                  );
                }
                if (target === 'REJECTED') {
                  return (
                    <button
                      key={target}
                      type="button"
                      onClick={() => handleOpenTransitionDialog(target)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 border border-slate-700 hover:border-rose-700 text-slate-300 hover:text-rose-200 text-xs font-medium transition-all"
                    >
                      Từ chối
                    </button>
                  );
                }
                return null;
              })}

              {session.workflowStatus === 'APPROVED' && (
                <button
                  type="button"
                  onClick={handleStartTransferFlow}
                  className="px-3.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md shadow-teal-600/30 transition-all flex items-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Chuyển sang Khách hàng</span>
                </button>
              )}

              {session.workflowStatus === 'TRANSFERRED' && (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs text-teal-400 bg-teal-500/10 px-3 py-1 rounded-lg border border-teal-500/30 font-medium">
                    <CheckCircle className="w-3.5 h-3.5 text-teal-400" />
                    <span>Đã chuyển sang CRM</span>
                  </span>
                  {session.adminReview?.linkedCustomerId && (
                    <a
                      href={`/customers?search=${encodeURIComponent(session.adminReview.editedPhone || session.rawPhone || '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 underline font-mono"
                    >
                      <span>Xem hồ sơ CRM ({session.adminReview.linkedCustomerId.slice(0, 8)}...)</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* State Transition Confirmation Dialog */}
      {transitionTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Chuyển trạng thái sang:</span>
                <span className="text-blue-400">
                  {WORKFLOW_STATUS_CONFIG[transitionTarget]?.label}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setTransitionTarget(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {transitionErrorMsg && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{transitionErrorMsg}</span>
              </div>
            )}

            {/* Requirement alerts */}
            {(transitionTarget === 'PENDING_APPROVAL' || transitionTarget === 'APPROVED') && (
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs">
                Yêu cầu: Hồ sơ phải có đầy đủ Họ và tên và Số điện thoại trong dữ liệu xử lý.
              </div>
            )}

            {/* Specific Note Input if target is NEEDS_MORE_INFO */}
            {transitionTarget === 'NEEDS_MORE_INFO' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nội dung thông tin cần bổ sung <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={transitionSpecificNote}
                  onChange={(e) => setTransitionSpecificNote(e.target.value)}
                  placeholder="Ghi rõ thông tin cần khách hàng bổ sung..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            {/* Specific Note Input if target is REJECTED */}
            {transitionTarget === 'REJECTED' && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Lý do từ chối hồ sơ <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={transitionSpecificNote}
                  onChange={(e) => setTransitionSpecificNote(e.target.value)}
                  placeholder="Nhập lý do từ chối cụ thể..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-rose-500"
                />
              </div>
            )}

            {/* General Note Input */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Ghi chú thao tác chuyển trạng thái (tùy chọn)
              </label>
              <textarea
                rows={2}
                value={transitionNote}
                onChange={(e) => setTransitionNote(e.target.value)}
                placeholder="Nhập ghi chú thêm cho nhật ký kiểm toán..."
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-100 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTransitionTarget(null)}
                disabled={isTransitioning}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleExecuteTransition}
                disabled={isTransitioning}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isTransitioning ? 'Đang thực hiện...' : 'Xác nhận chuyển'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 6: Transfer to CRM Customer Dialog */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-teal-600/20 text-teal-400 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Chuyển hồ sơ Akinator sang tab Khách hàng CRM
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Quy trình kiểm tra trùng lặp và tích hợp dữ liệu có kiểm soát
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {isCheckingDuplicate ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-3">
                  <RotateCcw className="w-8 h-8 animate-spin text-teal-500" />
                  <p className="text-xs">Đang kiểm tra trùng số điện thoại trong hệ thống CRM...</p>
                </div>
              ) : transferSuccessResult ? (
                <div className="p-6 rounded-2xl bg-teal-950/40 border border-teal-500/40 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-teal-500/20 text-teal-400 mx-auto flex items-center justify-center">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-teal-200">
                      {transferSuccessResult.message}
                    </h4>
                    <p className="text-xs text-teal-300/80 mt-1">
                      Hồ sơ Akinator đã được chuyển thành công sang phân hệ Khách hàng CRM.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-left text-xs space-y-2 max-w-md mx-auto">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Mã khách hàng:</span>
                      <span className="font-mono text-slate-200 font-semibold">
                        {transferSuccessResult.customerId}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Họ và tên:</span>
                      <span className="font-semibold text-slate-100">
                        {transferSuccessResult.customer?.fullName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Số điện thoại:</span>
                      <span className="font-mono text-slate-200">
                        {transferSuccessResult.customer?.phone}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Phương thức:</span>
                      <span className="text-teal-400 font-semibold">
                        {transferSuccessResult.mode === 'LINK_EXISTING'
                          ? 'Liên kết khách hàng cũ'
                          : 'Tạo khách hàng mới'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsTransferModalOpen(false)}
                      className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold"
                    >
                      Đóng
                    </button>
                    <a
                      href={`/customers?search=${encodeURIComponent(transferSuccessResult.customer?.phone || '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md shadow-teal-600/30 flex items-center gap-1.5"
                    >
                      <span>Mở tab Khách hàng</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ) : (
                <>
                  {transferErrorMsg && (
                    <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{transferErrorMsg}</span>
                    </div>
                  )}

                  {/* DUPLICATE DETECTED CASE */}
                  {duplicateCheckResult?.hasDuplicate ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-300 text-xs">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold text-amber-200">
                            Cảnh báo: Phát hiện {duplicateCheckResult.matches.length} khách hàng trùng số điện thoại!
                          </p>
                          <p className="leading-relaxed">
                            Số điện thoại <span className="font-mono font-bold text-white">{duplicateCheckResult.phone}</span> đã tồn tại trong CRM. Vui lòng chọn phương án xử lý bên dưới.
                          </p>
                        </div>
                      </div>

                      {/* Mode Tabs */}
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setTransferMode('LINK_EXISTING')}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            transferMode === 'LINK_EXISTING'
                              ? 'bg-blue-600/10 border-blue-500 text-blue-300 shadow-sm'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="font-bold text-xs flex items-center justify-between">
                            <span>Lựa chọn A — Liên kết khách cũ</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-400">
                              Khuyến nghị
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Gắn kết quả Akinator vào khách hàng đã có. Giữ nguyên thông tin cũ.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setTransferMode('CREATE_NEW')}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            transferMode === 'CREATE_NEW'
                              ? 'bg-amber-600/10 border-amber-500 text-amber-300 shadow-sm'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="font-bold text-xs flex items-center justify-between">
                            <span>Lựa chọn B — Vẫn tạo mới</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400">
                              Trùng lặp
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            Tạo thêm một bản ghi khách hàng mới riêng biệt dù trùng số điện thoại.
                          </p>
                        </button>
                      </div>

                      {/* Sub-view for LINK_EXISTING */}
                      {transferMode === 'LINK_EXISTING' && (
                        <div className="space-y-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
                          <label className="block text-xs font-bold text-slate-200">
                            Chọn khách hàng trong CRM để liên kết:
                          </label>

                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {duplicateCheckResult.matches.map((c) => (
                              <label
                                key={c.id}
                                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                                  selectedCustomerIdForLink === c.id
                                    ? 'bg-blue-600/20 border-blue-500 text-slate-100'
                                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <input
                                    type="radio"
                                    name="selectedExistingCustomer"
                                    value={c.id}
                                    checked={selectedCustomerIdForLink === c.id}
                                    onChange={() => setSelectedCustomerIdForLink(c.id)}
                                    className="text-blue-500 focus:ring-blue-500"
                                  />
                                  <div>
                                    <div className="font-semibold text-xs flex items-center gap-2">
                                      <span>{c.fullName}</span>
                                      <span className="font-mono text-slate-400">({c.phone})</span>
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                      {c.email && <span className="mr-2">{c.email}</span>}
                                      <span>Trạng thái: <strong className="text-slate-300">{c.overallStatus}</strong></span>
                                    </div>
                                  </div>
                                </div>
                                <span className="text-[10px] font-mono text-slate-500">
                                  Tạo: {formatDate(c.createdAt)}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sub-view for CREATE_NEW with confirmation */}
                      {transferMode === 'CREATE_NEW' && (
                        <div className="space-y-3 p-4 rounded-xl bg-amber-950/20 border border-amber-500/30">
                          <p className="text-xs text-amber-300 leading-relaxed">
                            Hệ thống yêu cầu xác nhận rõ ràng của Admin trước khi tạo mới khách hàng trùng:
                          </p>
                          <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-200">
                            <input
                              type="checkbox"
                              checked={confirmCreateNewChecked}
                              onChange={(e) => setConfirmCreateNewChecked(e.target.checked)}
                              className="mt-0.5 text-amber-500 rounded focus:ring-amber-500"
                            />
                            <span>
                              Tôi đã rà soát và xác nhận muốn tạo một hồ sơ khách hàng mới riêng biệt dù đã có khách hàng trùng số điện thoại trong hệ thống.
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* NO DUPLICATE CASE */
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3 text-emerald-300 text-xs">
                        <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <p className="font-bold text-emerald-200">
                            Không phát hiện khách hàng trùng số điện thoại
                          </p>
                          <p className="leading-relaxed">
                            Số điện thoại <span className="font-mono font-bold text-white">{duplicateCheckResult?.phone}</span> chưa từng tồn tại trong CRM. Sẵn sàng tạo mới khách hàng.
                          </p>
                        </div>
                      </div>

                      {/* Pre-transfer Data Mapping Preview */}
                      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
                        <span className="font-bold text-slate-300 block pb-2 border-b border-slate-800">
                          Thông tin khách hàng CRM dự kiến tạo:
                        </span>

                        <div className="grid grid-cols-2 gap-3 text-slate-300">
                          <div>
                            <span className="text-slate-400 block text-[11px]">Họ và tên:</span>
                            <span className="font-semibold text-slate-100">
                              {session?.adminReview?.editedFullName || session?.rawFullName}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Số điện thoại:</span>
                            <span className="font-mono font-semibold text-slate-100">
                              {duplicateCheckResult?.normalizedPhone || session?.adminReview?.editedPhone || session?.rawPhone}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Email:</span>
                            <span>{session?.adminReview?.editedEmail || session?.rawEmail || '--'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Giới tính:</span>
                            <span>{session?.adminReview?.editedGender || '--'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Ngày sinh:</span>
                            <span>{session?.adminReview?.editedDateOfBirth ? formatDate(session.adminReview.editedDateOfBirth) : '--'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Địa chỉ:</span>
                            <span>{session?.adminReview?.editedAddress || '--'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Nguồn khách hàng:</span>
                            <span className="text-blue-400 font-semibold">{session?.adminReview?.editedSource || 'Akinator'}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[11px]">Trạng thái CRM:</span>
                            <span className="text-emerald-400 font-semibold">LEAD_MOI</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer Actions */}
            {!transferSuccessResult && (
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  disabled={isSubmittingTransfer}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleExecuteTransfer}
                  disabled={
                    isSubmittingTransfer ||
                    (duplicateCheckResult?.hasDuplicate &&
                      transferMode === 'LINK_EXISTING' &&
                      !selectedCustomerIdForLink) ||
                    (duplicateCheckResult?.hasDuplicate &&
                      transferMode === 'CREATE_NEW' &&
                      !confirmCreateNewChecked)
                  }
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-lg shadow-teal-600/30 disabled:opacity-50 flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>
                    {isSubmittingTransfer
                      ? 'Đang thực hiện chuyển...'
                      : transferMode === 'LINK_EXISTING'
                      ? 'Xác nhận liên kết khách hàng'
                      : 'Xác nhận tạo khách hàng mới'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
