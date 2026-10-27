import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  ShieldCheck,
  Tag,
  DollarSign,
  Info,
} from 'lucide-react';
import {
  AssessmentRecommendationRun,
  AssessmentRecommendationItem,
} from '../../types/assessmentRecommendation';
import assessmentRecommendationService from '../../services/assessmentRecommendationService';
import { useToast } from '../../context/ToastContext';
import { Skeleton } from '../../components/ui/Skeleton';
import { DateDisplay } from '../../components/common';

interface AssessmentRecommendationModalProps {
  assessmentId: string;
  assessmentTitle: string;
  customerName: string;
  customerId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const AssessmentRecommendationModal: React.FC<AssessmentRecommendationModalProps> = ({
  assessmentId,
  assessmentTitle,
  customerName,
  isOpen,
  onClose,
}) => {
  const { toast } = useToast();

  const [runs, setRuns] = useState<AssessmentRecommendationRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AssessmentRecommendationRun | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRunningNew, setIsRunningNew] = useState<boolean>(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [filterEligibleOnly, setFilterEligibleOnly] = useState<boolean>(false);

  // Load history of runs for this assessment
  const loadRuns = async () => {
    setIsLoading(true);
    try {
      const data = await assessmentRecommendationService.getRunsByAssessment(assessmentId);
      setRuns(data);
      if (data.length > 0) {
        // Fetch detailed run with all items and snapshots
        const fullRun = await assessmentRecommendationService.getRunById(data[0].id);
        setSelectedRun(fullRun);
      } else {
        setSelectedRun(null);
      }
    } catch (err: any) {
      toast.error('Lỗi khi tải lịch sử đề xuất: ' + (err.message || ''));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadRuns();
    }
  }, [isOpen, assessmentId]);

  // Handle running new recommendation
  const handleRunRecommendation = async () => {
    setIsRunningNew(true);
    try {
      const newRun = await assessmentRecommendationService.generateForAssessment(assessmentId);
      toast.success('Đã hoàn tất tính toán gợi ý sản phẩm tài chính thành công!');
      // Reload and select the newly created run
      const fullRun = await assessmentRecommendationService.getRunById(newRun.id);
      setSelectedRun(fullRun);
      setRuns((prev) => [newRun, ...prev]);
    } catch (err: any) {
      toast.error('Lỗi khi tính toán gợi ý: ' + (err.message || ''));
    } finally {
      setIsRunningNew(false);
    }
  };

  const handleSelectRun = async (runId: string) => {
    try {
      setIsLoading(true);
      const fullRun = await assessmentRecommendationService.getRunById(runId);
      setSelectedRun(fullRun);
    } catch (err: any) {
      toast.error('Lỗi khi tải chi tiết lượt gợi ý: ' + (err.message || ''));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const items = selectedRun?.items || [];
  const displayItems = filterEligibleOnly ? items.filter((i) => i.isEligible) : items;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-800 bg-slate-950/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-sm font-semibold text-slate-100 font-sans">
                Đề xuất sản phẩm tài chính phù hợp
              </h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                Xác định & Có giải thích
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Khách hàng: <strong className="text-slate-200">{customerName}</strong> · Khảo sát: {assessmentTitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRunRecommendation}
              disabled={isRunningNew}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors shadow-sm disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunningNew ? 'animate-spin' : ''}`} />
              <span>{isRunningNew ? 'Đang tính toán...' : 'Chạy đề xuất mới'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-header: Run Selector Bar */}
        {runs.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-slate-950/40 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Lịch sử lần chạy ({runs.length}):
              </span>
              <select
                value={selectedRun?.id || ''}
                onChange={(e) => handleSelectRun(e.target.value)}
                className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
              >
                {runs.map((r, idx) => (
                  <option key={r.id} value={r.id}>
                    Lần {runs.length - idx}: {new Date(r.createdAt).toLocaleString('vi-VN')} ({r.totalRecommended} sản phẩm phù hợp)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={filterEligibleOnly}
                  onChange={(e) => setFilterEligibleOnly(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-purple-600 focus:ring-0 w-3.5 h-3.5"
                />
                <span>Chỉ hiện sản phẩm đủ điều kiện</span>
              </label>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : !selectedRun ? (
            <div className="text-center py-12 px-4 space-y-3">
              <div className="w-12 h-12 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">
                Chưa có đề xuất nào được tính toán
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Hệ thống sẽ đối chiếu câu trả lời trong đợt khảo sát với các bộ quy tắc chuẩn và tiêu chí tài chính của sản phẩm (hạn mức, độ tuổi, thu nhập, tài sản bảo đảm).
              </p>
              <button
                onClick={handleRunRecommendation}
                disabled={isRunningNew}
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isRunningNew ? 'Đang tính toán...' : 'Bắt đầu chạy đề xuất'}</span>
              </button>
            </div>
          ) : (
            <>
              {/* Snapshot Metadata Banner */}
              <div className="p-3.5 rounded-lg border border-purple-900/40 bg-purple-950/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-400" />
                    <span className="font-semibold text-slate-200">
                      Bộ quy tắc: {selectedRun.ruleVersion?.ruleSet?.title || 'Quy tắc chuẩn KTEA'}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300">
                      v{selectedRun.ruleVersion?.versionNumber || 1}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    <span>
                      Thời điểm chạy: <DateDisplay date={selectedRun.createdAt} showTime />
                    </span>
                    <span>·</span>
                    <span>Người thực hiện: {selectedRun.performedBy?.fullName || 'Hệ thống'}</span>
                    {selectedRun.executionTimeMs && (
                      <>
                        <span>·</span>
                        <span className="font-mono text-slate-500">
                          {selectedRun.executionTimeMs}ms
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-base font-bold text-emerald-400 font-mono">
                      {selectedRun.totalRecommended}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                      Sản phẩm đề xuất
                    </div>
                  </div>
                  <div className="h-6 w-px bg-slate-800" />
                  <div className="text-right">
                    <div className="text-base font-bold text-slate-300 font-mono">
                      {selectedRun.totalCandidatesEvaluated}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider">
                      Tổng số ứng viên
                    </div>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {displayItems.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-400 border border-slate-800 rounded-lg">
                    Không có sản phẩm nào phù hợp với bộ lọc hiện tại.
                  </div>
                ) : (
                  displayItems.map((item) => (
                    <ProductRecommendationCard
                      key={item.id}
                      item={item}
                      isExpanded={expandedItemId === item.id}
                      onToggleExpand={() =>
                        setExpandedItemId(expandedItemId === item.id ? null : item.id)
                      }
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-slate-800 bg-slate-950/80 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>
              Snapshot dữ liệu được lưu bất biến tại thời điểm đánh giá. <strong>Lưu ý:</strong> Điểm phù hợp chỉ phản ánh mức độ tương thích nhu cầu, không phải xác suất được tổ chức tài chính phê duyệt khoản vay.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 shrink-0 ml-4"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

// =========================================================================
// PRODUCT RECOMMENDATION CARD SUBCOMPONENT
// =========================================================================

interface ProductCardProps {
  item: AssessmentRecommendationItem;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const ProductRecommendationCard: React.FC<ProductCardProps> = ({
  item,
  isExpanded,
  onToggleExpand,
}) => {
  const scoreNum = Number(item.score);

  // Score color helper
  const getScoreColor = (s: number) => {
    if (s >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (s >= 60) return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
    if (s >= 40) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'LOAN_UNSECURED':
        return 'Vay tín chấp';
      case 'LOAN_SECURED':
        return 'Vay thế chấp';
      case 'CREDIT_CARD':
        return 'Thẻ tín dụng';
      case 'SAVINGS':
        return 'Tiết kiệm';
      case 'INSURANCE':
        return 'Bảo hiểm';
      default:
        return 'Sản phẩm khác';
    }
  };

  return (
    <div
      className={`rounded-lg border transition-all ${
        item.isEligible
          ? 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
          : 'border-slate-850 bg-slate-950/30 opacity-75'
      }`}
    >
      {/* Header bar */}
      <div className="p-3.5 flex items-start justify-between gap-3 cursor-pointer" onClick={onToggleExpand}>
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Rank Badge */}
          <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-mono font-bold text-xs text-slate-300 shrink-0">
            #{item.rank}
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-slate-100 truncate">
                {item.productName}
              </h4>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-slate-800 text-slate-300">
                {getCategoryLabel(item.productCategory)}
              </span>
              {item.isEligible ? (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/40 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Đủ điều kiện
                </span>
              ) : (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-400 border border-rose-800/40 flex items-center gap-1">
                  <XCircle className="w-3 h-3" /> Chưa đủ điều kiện
                </span>
              )}
            </div>

            {/* Explanation Summary */}
            <p className="text-xs text-slate-300 leading-relaxed">
              {item.matchSummary}
            </p>
          </div>
        </div>

        {/* Score & Expand button */}
        <div className="flex items-center gap-2 shrink-0">
          {typeof item.confidence === 'number' && (
            <div
              className="px-2 py-1 rounded-lg border border-slate-700/80 bg-slate-900/90 font-mono text-[11px] text-slate-300 flex items-center gap-1"
              title="Độ tin cậy dữ liệu: Tỷ lệ các tiêu chí đánh giá có câu trả lời từ khách hàng"
            >
              <span className="text-slate-400 text-[10px]">Tin cậy:</span>
              <span className="font-semibold text-slate-200">{item.confidence}%</span>
            </div>
          )}
          <div className={`px-2.5 py-1 rounded-lg border font-mono font-bold text-xs flex items-center gap-1 ${getScoreColor(scoreNum)}`}>
            <span>{scoreNum}%</span>
            <span className="text-[10px] opacity-75">phù hợp</span>
          </div>

          <button
            type="button"
            className="p-1 text-slate-400 hover:text-slate-200 rounded"
            aria-label="Xem chi tiết"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Details Drawer */}
      {isExpanded && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-slate-850/80 space-y-3 text-xs">
          {/* Passed criteria */}
          {item.passedCriteria.length > 0 && (
            <div className="space-y-1.5">
              <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Tiêu chí đáp ứng ({item.passedCriteria.length}):</span>
              </div>
              <ul className="space-y-1 pl-5 list-disc text-slate-300">
                {item.passedCriteria.map((c, idx) => (
                  <li key={idx}>
                    <strong>{c.description}</strong>: {c.details || 'Đạt chuẩn'}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Failed criteria */}
          {item.failedCriteria.length > 0 && (
            <div className="space-y-1.5">
              <div className="font-semibold text-rose-400 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" />
                <span>Tiêu chí chưa đạt ({item.failedCriteria.length}):</span>
              </div>
              <ul className="space-y-1 pl-5 list-disc text-rose-300">
                {item.failedCriteria.map((c, idx) => (
                  <li key={idx}>
                    <strong>{c.description}</strong>: {c.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Unassessed criteria */}
          {item.unassessedCriteria.length > 0 && (
            <div className="space-y-1.5">
              <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Tiêu chí chưa thể xác minh ({item.unassessedCriteria.length}):</span>
              </div>
              <ul className="space-y-1 pl-5 list-disc text-amber-200/90">
                {item.unassessedCriteria.map((c, idx) => (
                  <li key={idx}>
                    <strong>{c.description}</strong>: {c.reason} (Trường dữ liệu: <code className="text-amber-300 font-mono">{c.missingField}</code>)
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings */}
          {item.warnings.length > 0 && (
            <div className="p-2.5 rounded bg-amber-950/20 border border-amber-800/40 text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div className="space-y-0.5">
                <span className="font-semibold">Cảnh báo nghiệp vụ:</span>
                <p className="text-[11px] leading-relaxed text-amber-200">
                  {item.warnings.join(' · ')}
                </p>
              </div>
            </div>
          )}

          {/* Contributing Answers */}
          {item.answersUsed.length > 0 && (
            <div className="space-y-1 pt-1">
              <span className="text-slate-400 font-semibold flex items-center gap-1">
                <Tag className="w-3 h-3 text-slate-500" />
                Dữ liệu khảo sát đóng góp điểm:
              </span>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {item.answersUsed.map((a, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 font-mono text-[10px]"
                  >
                    {a.questionCode}: <strong className="text-purple-300">{JSON.stringify(a.answerValue)}</strong>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Frozen Product Snapshot Details */}
          {item.productSnapshot?.financialDetail && (
            <div className="p-2.5 rounded bg-slate-900/60 border border-slate-800 space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-slate-500" />
                Thông số sản phẩm (Bảo lưu tại thời điểm chạy):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] pt-1">
                {item.productSnapshot.financialDetail.minAmount && (
                  <div>
                    <span className="text-slate-500">Hạn mức:</span>{' '}
                    <span className="text-slate-200 font-mono font-medium">
                      {Number(item.productSnapshot.financialDetail.minAmount).toLocaleString('vi-VN')} -{' '}
                      {item.productSnapshot.financialDetail.maxAmount
                        ? Number(item.productSnapshot.financialDetail.maxAmount).toLocaleString('vi-VN')
                        : '∞'}{' '}
                      đ
                    </span>
                  </div>
                )}
                {item.productSnapshot.financialDetail.minInterestRate && (
                  <div>
                    <span className="text-slate-500">Lãi suất:</span>{' '}
                    <span className="text-slate-200 font-mono font-medium">
                      {item.productSnapshot.financialDetail.minInterestRate}% -{' '}
                      {item.productSnapshot.financialDetail.maxInterestRate || item.productSnapshot.financialDetail.minInterestRate}%/năm
                    </span>
                  </div>
                )}
                {item.productSnapshot.financialDetail.minTenureMonths && (
                  <div>
                    <span className="text-slate-500">Kỳ hạn:</span>{' '}
                    <span className="text-slate-200 font-mono font-medium">
                      {item.productSnapshot.financialDetail.minTenureMonths} -{' '}
                      {item.productSnapshot.financialDetail.maxTenureMonths || '∞'} tháng
                    </span>
                  </div>
                )}
                {item.productSnapshot.financialDetail.providerName && (
                  <div>
                    <span className="text-slate-500">Đơn vị cung cấp:</span>{' '}
                    <span className="text-slate-200 font-medium">
                      {item.productSnapshot.financialDetail.providerName}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
