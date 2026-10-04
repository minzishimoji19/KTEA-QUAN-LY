import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  CheckCircle,
  Package,
  Plus,
  ArrowRight,
  XCircle,
  FileText,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { StatusBadge, DateDisplay, ErrorState } from '../components/common';
import { Skeleton } from '../components/ui/Skeleton';
import { useCase, useUpdateProgress } from '../hooks/useCases';
import { useCustomerDetail } from '../hooks/useCustomers';
import { CaseProgress } from '../types/models';
import { CaseProgressTimeline } from '../features/customers/CaseProgressTimeline';
import { SelectProductModal } from '../features/customers/SelectProductModal';
import { RejectCaseModal } from '../features/customers/RejectCaseModal';
import { AddCaseModal } from '../features/customers/AddCaseModal';
import { useToast } from '../context/ToastContext';

const NEXT_PROGRESS_MAP: Partial<
  Record<CaseProgress, { next: CaseProgress; label: string; actionText: string }>
> = {
  NOT_SELECTED: {
    next: 'REGISTRATION_CREATED',
    label: 'Chọn sản phẩm',
    actionText: 'Chọn sản phẩm để bắt đầu đăng ký',
  },
  REGISTRATION_CREATED: {
    next: 'REGISTRATION_COMPLETED',
    label: 'Hoàn tất đăng ký',
    actionText: 'Xác nhận hoàn tất hồ sơ đăng ký',
  },
  REGISTRATION_COMPLETED: {
    next: 'UNDER_REVIEW',
    label: 'Chuyển sang thẩm định',
    actionText: 'Gửi hồ sơ vào quy trình thẩm định',
  },
  UNDER_REVIEW: {
    next: 'APPROVED',
    label: 'Phê duyệt hồ sơ',
    actionText: 'Đánh dấu hồ sơ đã được duyệt',
  },
  APPROVED: {
    next: 'CARD_ISSUED',
    label: 'Phát hành thẻ / Hợp đồng',
    actionText: 'Xác nhận đã phát hành thẻ / hợp đồng',
  },
  CARD_ISSUED: {
    next: 'CARD_ACTIVATED',
    label: 'Kích hoạt dịch vụ',
    actionText: 'Xác nhận khách hàng đã kích hoạt',
  },
  CARD_ACTIVATED: {
    next: 'COMPLETED',
    label: 'Hoàn tất hồ sơ',
    actionText: 'Kết thúc chu trình xử lý thành công',
  },
};

export const CaseDetailPage: React.FC = () => {
  const { customerId, caseId } = useParams<{ customerId: string; caseId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: customerCase, isLoading, isError, refetch } = useCase(caseId || '');
  const { data: customer } = useCustomerDetail(customerId);
  const updateProgress = useUpdateProgress(customerId);

  const [isSelectProductOpen, setIsSelectProductOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isCreateNewCaseOpen, setIsCreateNewCaseOpen] = useState(false);
  const [progressNote, setProgressNote] = useState('');
  const [isNoteInputOpen, setIsNoteInputOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-5xl mx-auto py-4">
        <Skeleton className="h-8 w-40" />
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <Skeleton className="h-7 w-60" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !customerCase) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 py-4">
        <Link to={`/customers/${customerId}`}>
          <Button variant="outline" size="sm" className="gap-1 text-xs">
            <ArrowLeft className="w-3.5 h-3.5" /> Quay lại thông tin khách hàng
          </Button>
        </Link>
        <ErrorState
          title="Không tìm thấy hồ sơ"
          description="Hồ sơ yêu cầu không tồn tại hoặc đã bị xóa."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const isRejected = customerCase.caseStatus === 'REJECTED';
  const isTerminal = isRejected || customerCase.caseStatus === 'COMPLETED' || customerCase.caseStatus === 'CANCELLED';
  const currentProgress = customerCase.progress || 'NOT_SELECTED';
  const nextStepConfig = NEXT_PROGRESS_MAP[currentProgress];

  const handleAdvanceProgress = async () => {
    if (!nextStepConfig) return;

    if (currentProgress === 'NOT_SELECTED') {
      setIsSelectProductOpen(true);
      return;
    }

    try {
      await updateProgress.mutateAsync({
        id: customerCase.id,
        toProgress: nextStepConfig.next,
        note: progressNote.trim() || null,
      });

      toast.success(
        'Đã cập nhật tiến trình',
        `Hồ sơ đã chuyển sang bước "${nextStepConfig.label}".`
      );
      setProgressNote('');
      setIsNoteInputOpen(false);
    } catch (err) {
      toast.error('Cập nhật thất bại', (err as Error).message || 'Không thể chuyển bước');
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto py-2">
      {/* 1. Navigation Breadcrumb */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <Link
            to="/customers"
            className="hover:text-slate-200 transition-colors flex items-center gap-1"
          >
            <span>Danh bạ</span>
          </Link>
          <span>/</span>
          <Link
            to={`/customers/${customerId}`}
            className="hover:text-slate-200 transition-colors text-blue-400 font-semibold"
          >
            {customer?.fullName || customerId?.slice(0, 8)}
          </Link>
          <span>/</span>
          <span className="text-slate-200">Hồ sơ #{customerCase.id.slice(0, 8)}</span>
        </div>

        <div className="flex items-center gap-2">
          <Link to={`/customers/${customerId}`}>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Khách hàng</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreateNewCaseOpen(true)}
            className="h-7 text-xs gap-1 border-purple-800/80 text-purple-300 hover:bg-purple-950/40"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tạo hồ sơ mới</span>
          </Button>
        </div>
      </div>

      {/* 2. Case Header Card */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Briefcase className="w-4 h-4" />
              </div>
              <h1 className="text-lg font-bold text-slate-100 font-mono">
                Hồ sơ #{customerCase.id.slice(0, 8)}
              </h1>
              <StatusBadge status={customerCase.caseStatus} />
              <StatusBadge status={currentProgress} />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Ngày nộp: </span>
                <DateDisplay date={customerCase.applicationDate || customerCase.createdAt} />
              </span>
              {customerCase.resultDate && (
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-slate-500" />
                  <span>Ngày kết quả: </span>
                  <DateDisplay date={customerCase.resultDate} />
                </span>
              )}
            </div>
          </div>

          {/* Action Button Group */}
          <div className="flex flex-wrap items-center gap-2">
            {!isTerminal && (
              <>
                {!customerCase.productId ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsSelectProductOpen(true)}
                    className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    <Package className="w-3.5 h-3.5" />
                    <span>Chọn sản phẩm</span>
                  </Button>
                ) : nextStepConfig ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      if (!isNoteInputOpen) {
                        setIsNoteInputOpen(true);
                      } else {
                        handleAdvanceProgress();
                      }
                    }}
                    disabled={updateProgress.isPending}
                    className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>{nextStepConfig.label}</span>
                  </Button>
                ) : null}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRejectOpen(true)}
                  className="h-8 text-xs gap-1.5 border-rose-800 text-rose-300 hover:bg-rose-950/40"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Từ chối hồ sơ</span>
                </Button>
              </>
            )}

            {isRejected && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateNewCaseOpen(true)}
                className="h-8 text-xs gap-1.5 bg-purple-600 hover:bg-purple-500 text-white"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Tạo hồ sơ mới</span>
              </Button>
            )}
          </div>
        </div>

        {/* Note input prompt when advancing progress */}
        {isNoteInputOpen && !isTerminal && (
          <div className="p-3 rounded-lg border border-slate-700 bg-slate-950/80 space-y-2 animate-in fade-in duration-100">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">
                Thêm ghi chú cho bước chuyển: {nextStepConfig?.label}
              </span>
              <button
                type="button"
                onClick={() => setIsNoteInputOpen(false)}
                className="text-slate-500 hover:text-slate-300 text-xs"
              >
                Hủy
              </button>
            </div>
            <input
              type="text"
              placeholder="VD: Đã nhận đầy đủ CCCD và sao kê; đối tác gửi mã duyệt..."
              value={progressNote}
              onChange={(e) => setProgressNote(e.target.value)}
              className="w-full h-8 px-2.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-100 focus:outline-none focus:border-blue-500"
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsNoteInputOpen(false)}
                className="h-7 text-xs"
              >
                Bỏ qua
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={handleAdvanceProgress}
                disabled={updateProgress.isPending}
                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {updateProgress.isPending ? 'Đang cập nhật...' : 'Xác nhận chuyển bước'}
              </Button>
            </div>
          </div>
        )}

        {/* Product / Package Highlight Block */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] font-mono text-slate-500 uppercase block">
                Sản phẩm / Gói tài chính
              </span>
              {customerCase.product ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-semibold text-slate-100 text-sm">
                    {customerCase.product.name}
                  </span>
                  <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {customerCase.product.code}
                  </span>
                </div>
              ) : (
                <span className="font-semibold text-amber-300 text-sm italic">
                  Chưa chọn sản phẩm
                </span>
              )}
            </div>
          </div>

          {!customerCase.product && !isTerminal && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSelectProductOpen(true)}
              className="h-7 text-xs gap-1 border-blue-800/80 text-blue-300 hover:bg-blue-950/40 shrink-0"
            >
              <Plus className="w-3 h-3" />
              <span>Chọn sản phẩm</span>
            </Button>
          )}
        </div>

        {customerCase.notes && (
          <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 text-xs text-slate-300 flex items-start gap-2">
            <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase text-slate-500 block">Ghi chú hồ sơ:</span>
              <p className="whitespace-pre-wrap">{customerCase.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* 3. Visual Timeline & Audit History */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono flex items-center gap-2">
          <span>Tiến trình xử lý hồ sơ</span>
        </h2>

        <CaseProgressTimeline
          currentProgress={customerCase.progress}
          caseStatus={customerCase.caseStatus}
          rejectedAt={customerCase.rejectedAt}
          rejectionReason={customerCase.rejectionReason}
          rejectionNote={customerCase.rejectionNote}
          progressHistory={customerCase.progressHistory}
        />
      </div>

      {/* Modals */}
      <SelectProductModal
        isOpen={isSelectProductOpen}
        onClose={() => setIsSelectProductOpen(false)}
        caseId={customerCase.id}
        customerId={customerId || ''}
        currentProductId={customerCase.productId}
        onSuccess={() => refetch()}
      />

      <RejectCaseModal
        isOpen={isRejectOpen}
        onClose={() => setIsRejectOpen(false)}
        caseId={customerCase.id}
        customerId={customerId || ''}
        caseTitle={customerCase.product?.name || `Hồ sơ #${customerCase.id.slice(0, 8)}`}
        onSuccess={() => refetch()}
      />

      {customerId && (
        <AddCaseModal
          isOpen={isCreateNewCaseOpen}
          onClose={() => setIsCreateNewCaseOpen(false)}
          customerId={customerId}
          onSuccess={(newCaseId) => {
            setIsCreateNewCaseOpen(false);
            navigate(`/customers/${customerId}/cases/${newCaseId}`);
          }}
        />
      )}
    </div>
  );
};

export default CaseDetailPage;
