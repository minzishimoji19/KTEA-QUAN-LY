import React from 'react';
import {
  CheckCircle2,
  Circle,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { CaseProgress, CaseStatus, CaseProgressHistory } from '../../types/models';
import { DateDisplay } from '../../components/common/DateDisplay';

export interface CaseProgressTimelineProps {
  currentProgress?: CaseProgress;
  caseStatus: CaseStatus;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  rejectionNote?: string | null;
  progressHistory?: CaseProgressHistory[];
}

interface WorkflowStep {
  key: CaseProgress;
  label: string;
  description: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    key: 'REGISTRATION_CREATED',
    label: 'Đăng ký tạo',
    description: 'Hồ sơ đã được khởi tạo và ghi nhận',
  },
  {
    key: 'REGISTRATION_COMPLETED',
    label: 'Hoàn tất đăng ký',
    description: 'Thu thập đầy đủ thông tin & hồ sơ đính kèm',
  },
  {
    key: 'UNDER_REVIEW',
    label: 'Đang thẩm định',
    description: 'Đối tác/ngân hàng đang thẩm định điều kiện',
  },
  {
    key: 'APPROVED',
    label: 'Đã duyệt',
    description: 'Hồ sơ được phê duyệt thành công',
  },
  {
    key: 'CARD_ISSUED',
    label: 'Phát hành thẻ / Hợp đồng',
    description: 'Thẻ hoặc hợp đồng tín dụng đã được phát hành',
  },
  {
    key: 'CARD_ACTIVATED',
    label: 'Kích hoạt',
    description: 'Khách hàng đã kích hoạt thẻ và sử dụng',
  },
  {
    key: 'COMPLETED',
    label: 'Hoàn tất',
    description: 'Chu trình hoàn thành trọn vẹn',
  },
];

const STEP_ORDER: Record<CaseProgress, number> = {
  NOT_SELECTED: -1,
  REGISTRATION_CREATED: 0,
  REGISTRATION_COMPLETED: 1,
  UNDER_REVIEW: 2,
  APPROVED: 3,
  CARD_ISSUED: 4,
  CARD_ACTIVATED: 5,
  COMPLETED: 6,
};

export const CaseProgressTimeline: React.FC<CaseProgressTimelineProps> = ({
  currentProgress = 'NOT_SELECTED',
  caseStatus,
  rejectedAt,
  rejectionReason,
  rejectionNote,
  progressHistory = [],
}) => {
  const isRejected = caseStatus === 'REJECTED';
  const isCancelled = caseStatus === 'CANCELLED';
  const currentIndex = STEP_ORDER[currentProgress] ?? -1;

  // Find history record for a given progress
  const getHistoryForStep = (stepKey: CaseProgress) => {
    return progressHistory.find((h) => h.toProgress === stepKey);
  };

  return (
    <div className="space-y-6">
      {/* 1. Terminal Rejection Banner (If Rejected) */}
      {isRejected && (
        <div className="rounded-xl border border-rose-800 bg-rose-950/40 p-4 space-y-3">
          <div className="flex items-center gap-2 text-rose-300 font-semibold text-sm">
            <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span className="font-mono tracking-wide uppercase">✕ HỒ SƠ ĐÃ BỊ TỪ CHỐI (TERMINAL)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <div className="p-2.5 rounded bg-rose-950/60 border border-rose-900/60">
              <span className="text-[11px] text-rose-400 font-medium block mb-0.5">Lý do từ chối:</span>
              <span className="text-slate-100 font-medium">{rejectionReason || 'Không có lý do cụ thể'}</span>
            </div>

            {rejectedAt && (
              <div className="p-2.5 rounded bg-rose-950/60 border border-rose-900/60">
                <span className="text-[11px] text-rose-400 font-medium block mb-0.5">Thời gian từ chối:</span>
                <span className="text-slate-200 font-mono">
                  <DateDisplay date={rejectedAt} showTime />
                </span>
              </div>
            )}
          </div>

          {rejectionNote && (
            <div className="p-2.5 rounded bg-rose-950/30 border border-rose-900/40 text-xs">
              <span className="text-[11px] text-rose-400 font-medium block mb-0.5">Ghi chú từ chối:</span>
              <span className="text-slate-300 italic">{rejectionNote}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-rose-300/80 bg-rose-950/20 px-2.5 py-1.5 rounded border border-rose-900/30">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>Hồ sơ này đã kết thúc vĩnh viễn và không thể tiếp tục hoặc kích hoạt lại.</span>
          </div>
        </div>
      )}

      {/* 2. Initial State Banner (If Product Not Selected) */}
      {currentProgress === 'NOT_SELECTED' && !isRejected && (
        <div className="rounded-lg border border-amber-800/60 bg-amber-950/30 p-3.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="font-semibold block text-amber-200">Hồ sơ chưa chọn sản phẩm mục tiêu</span>
              <span className="text-[11px] text-slate-400">
                Hãy chọn sản phẩm để hồ sơ chuyển sang bước Đăng ký tạo (REGISTRATION_CREATED).
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Visual Stepper Timeline */}
      <div className="relative pl-6 md:pl-8 space-y-6">
        {/* Continuous vertical line */}
        <div className="absolute left-[11px] md:left-[15px] top-3 bottom-3 w-0.5 bg-slate-800" />

        {WORKFLOW_STEPS.map((step, idx) => {
          const isCurrent = !isRejected && !isCancelled && currentIndex === idx;
          const isPassed = !isRejected && !isCancelled && currentIndex > idx;
          const historyEntry = getHistoryForStep(step.key);

          // If rejected at this step
          const isRejectionStage = isRejected && currentIndex === idx;

          return (
            <div key={step.key} className="relative flex items-start gap-4">
              {/* Node Icon */}
              <div
                className={`absolute -left-6 md:-left-8 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                  isCurrent
                    ? 'border-blue-500 bg-blue-900 text-blue-300 ring-4 ring-blue-500/20 shadow-lg'
                    : isPassed
                    ? 'border-emerald-500 bg-emerald-950 text-emerald-400'
                    : isRejectionStage
                    ? 'border-rose-500 bg-rose-950 text-rose-400 ring-4 ring-rose-500/20'
                    : 'border-slate-800 bg-slate-900 text-slate-600'
                }`}
              >
                {isPassed ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : isCurrent ? (
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                ) : isRejectionStage ? (
                  <XCircle className="w-3.5 h-3.5" />
                ) : (
                  <Circle className="w-2 h-2 text-slate-700" />
                )}
              </div>

              {/* Step Content */}
              <div
                className={`flex-1 rounded-lg border p-3 transition-colors ${
                  isCurrent
                    ? 'border-blue-700/60 bg-blue-950/20'
                    : isRejectionStage
                    ? 'border-rose-800/60 bg-rose-950/20'
                    : isPassed
                    ? 'border-slate-850 bg-slate-900/40'
                    : 'border-slate-850/60 bg-slate-950/20 opacity-70'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-semibold ${
                        isCurrent
                          ? 'text-blue-300'
                          : isRejectionStage
                          ? 'text-rose-400'
                          : isPassed
                          ? 'text-slate-200'
                          : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>

                    {isCurrent && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-900/80 text-blue-300 border border-blue-700/60 font-medium">
                        HIỆN TẠI
                      </span>
                    )}

                    {isRejectionStage && (
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-900/80 text-rose-300 border border-rose-700/60 font-medium">
                        DỪNG TẠI ĐÂY
                      </span>
                    )}
                  </div>

                  {historyEntry && (
                    <span className="text-[10px] font-mono text-slate-500">
                      <DateDisplay date={historyEntry.changedAt} showTime />
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 mt-1">{step.description}</p>

                {historyEntry?.note && (
                  <p className="text-[11px] text-slate-300 mt-1.5 pl-2 border-l-2 border-slate-700 font-mono italic">
                    {historyEntry.note}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 4. Complete Audit History Log */}
      {progressHistory && progressHistory.length > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3.5 space-y-2">
          <span className="text-[11px] font-mono uppercase text-slate-400 font-semibold block">
            Lịch sử thay đổi tiến trình ({progressHistory.length})
          </span>
          <div className="space-y-1.5">
            {progressHistory.map((h) => (
              <div
                key={h.id}
                className="text-[11px] font-mono flex items-start justify-between gap-3 text-slate-400 border-b border-slate-900 pb-1 last:border-0"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">{h.fromProgress || 'START'}</span>
                  <ArrowRight className="w-3 h-3 text-slate-600" />
                  <span className="text-slate-200 font-semibold">{h.toProgress}</span>
                  {h.note && <span className="text-slate-400 font-sans italic ml-1">- {h.note}</span>}
                </div>
                <DateDisplay date={h.changedAt} showTime className="shrink-0 text-slate-500" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CaseProgressTimeline;
