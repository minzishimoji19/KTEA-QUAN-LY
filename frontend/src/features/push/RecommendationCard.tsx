import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Eye,
  XCircle,
  ExternalLink,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { Recommendation } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/common/StatusBadge';
import { DateDisplay } from '../../components/common/DateDisplay';

export interface RecommendationCardProps {
  recommendation: Recommendation;
  onReview?: (rec: Recommendation) => void;
  onDismiss?: (rec: Recommendation) => void;
  onPush?: (rec: Recommendation) => void;
}

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  recommendation: rec,
  onReview,
  onDismiss,
  onPush,
}) => {
  const navigate = useNavigate();
  const customer = rec.customer;
  const scoreNum = Number(rec.score) || 0;

  // Score styling
  const scoreColor =
    scoreNum >= 80
      ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-400'
      : scoreNum >= 65
      ? 'bg-blue-950/70 border-blue-700/60 text-blue-400'
      : 'bg-amber-950/70 border-amber-700/60 text-amber-400';

  const lastActivity = customer?.activities?.[0];
  const activeCases = customer?.cases || [];
  const nextFollowUp = customer?.followUps?.[0];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 transition-all hover:border-slate-700 hover:bg-slate-900/80 shadow-sm flex flex-col justify-between">
      {/* Top Header: Customer info + Score Badge */}
      <div>
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                onClick={() => navigate(`/customers/${rec.customerId}`)}
                className="font-semibold text-slate-100 hover:text-blue-400 cursor-pointer transition-colors text-sm truncate"
              >
                {customer?.fullName || 'Customer Profile'}
              </span>
              {customer?.overallStatus && (
                <StatusBadge status={customer.overallStatus} />
              )}
              {customer?.priority && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  {customer.priority}
                </span>
              )}
            </div>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              {customer?.phone || rec.customerId}
            </p>
          </div>

          {/* Rule Match Score */}
          <div
            className={`flex flex-col items-center justify-center px-2.5 py-1 rounded-lg border font-mono text-xs font-bold ${scoreColor}`}
            title="Điểm ưu tiên đề xuất theo quy tắc (0-100)"
          >
            <div className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>{Math.round(scoreNum)}</span>
            </div>
            <span className="text-[9px] uppercase tracking-wider opacity-80 font-sans">
              Điểm
            </span>
          </div>
        </div>

        {/* Recommended Product Banner */}
        <div className="mt-3 flex items-center justify-between gap-2 p-3 rounded-lg bg-blue-950/40 border border-blue-800/50">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-mono tracking-wider text-blue-400 font-semibold block">
              Sản phẩm đề xuất
            </span>
            <span className="text-sm font-bold text-slate-100 truncate block mt-0.5">
              {rec.targetProduct?.name || 'Sản phẩm tài chính'}
            </span>
          </div>
          {rec.targetProduct?.code && (
            <span className="text-xs font-mono font-bold text-blue-300 px-2 py-0.5 rounded bg-blue-900/60 border border-blue-700/60 flex-shrink-0">
              {rec.targetProduct.code}
            </span>
          )}
        </div>

        {/* Reason / Transparent Explanation - WHY IS THIS RECOMMENDED */}
        <div className="mt-3 text-xs bg-slate-950/80 p-3 rounded-lg border-l-4 border-l-amber-500 border border-slate-800 shadow-inner">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-mono uppercase text-amber-400 font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Lý do đề xuất:
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 font-semibold">
              {rec.recommendationType.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs text-slate-100 font-medium leading-relaxed bg-slate-900/60 p-2.5 rounded border border-slate-800/80">
            {rec.reason}
          </p>
        </div>

        {/* Relational Context: Activity, Current Cases, Next Follow-up */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-800/70 text-[11px]">
          {/* Last Activity */}
          <div className="flex flex-col min-w-0">
            <span className="text-slate-500 font-mono text-[10px] uppercase">Hoạt động gần nhất</span>
            {lastActivity ? (
              <span className="text-slate-300 truncate mt-0.5" title={lastActivity.title}>
                {lastActivity.title}
              </span>
            ) : (
              <span className="text-slate-600 font-mono mt-0.5">Chưa có</span>
            )}
            {lastActivity && (
              <DateDisplay date={lastActivity.occurredAt} relativeContext className="text-[10px] text-slate-500" />
            )}
          </div>

          {/* Current Cases */}
          <div className="flex flex-col min-w-0">
            <span className="text-slate-500 font-mono text-[10px] uppercase">Hồ sơ hiện tại</span>
            {activeCases.length > 0 ? (
              <div className="flex items-center gap-1 mt-0.5 truncate">
                <span className="text-slate-300 font-mono truncate">
                  {activeCases[0].product?.name || activeCases[0].product?.code || 'Hồ sơ'}
                </span>
                <span className="text-[9px] font-mono px-1 rounded bg-slate-800 text-slate-400">
                  {activeCases[0].caseStatus}
                </span>
                {activeCases.length > 1 && (
                  <span className="text-[10px] text-slate-500">+{activeCases.length - 1}</span>
                )}
              </div>
            ) : (
              <span className="text-slate-600 font-mono mt-0.5">Chưa có hồ sơ</span>
            )}
          </div>

          {/* Next Follow-Up */}
          <div className="flex flex-col min-w-0">
            <span className="text-slate-500 font-mono text-[10px] uppercase">Lịch chăm sóc tiếp theo</span>
            {nextFollowUp ? (
              <div className="flex items-center gap-1 mt-0.5 text-amber-400 font-mono truncate">
                <Clock className="w-3 h-3 flex-shrink-0" />
                <DateDisplay date={nextFollowUp.dueAt} relativeContext className="truncate" />
              </div>
            ) : (
              <span className="text-slate-600 font-mono mt-0.5">Chưa có lịch</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/customers/${rec.customerId}`)}
            className="h-7 text-xs px-2 gap-1 text-slate-300 hover:text-white"
            title="Xem hồ sơ khách hàng"
          >
            <span>Xem khách hàng</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </Button>

          {rec.status === 'NEW' && onReview && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReview(rec)}
              className="h-7 text-xs px-2 gap-1 text-slate-300 hover:text-blue-400 hover:border-blue-700/60"
              title="Đánh dấu đã xem xét"
            >
              <Eye className="w-3 h-3" />
              <span>Xem xét</span>
            </Button>
          )}

          {rec.status !== 'DISMISSED' && rec.status !== 'CONVERTED_TO_PUSH' && onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(rec)}
              className="h-7 text-xs px-2 gap-1 text-slate-400 hover:text-red-400"
              title="Bỏ qua đề xuất"
            >
              <XCircle className="w-3 h-3" />
              <span>Bỏ qua</span>
            </Button>
          )}
        </div>

        {/* Push Trigger Button */}
        {rec.status !== 'CONVERTED_TO_PUSH' ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onPush?.(rec)}
            className="h-7 text-xs px-3 gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-sm"
          >
            <Send className="w-3 h-3" />
            <span>Chuyển khách</span>
            <ArrowRight className="w-3 h-3" />
          </Button>
        ) : (
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 px-2 py-0.5 rounded">
            Đã chuyển khách
          </span>
        )}
      </div>
    </div>
  );
};

export default RecommendationCard;
