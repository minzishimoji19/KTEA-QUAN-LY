import React, { useState } from 'react';
import { CheckCircle2, XCircle, Clock, Ban, X, AlertTriangle } from 'lucide-react';
import { PushRecord, PushStatus } from '../../types/models';
import { Button } from '../../components/ui/Button';

export interface PushOutcomeModalProps {
  isOpen: boolean;
  pushRecord: PushRecord | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (data: {
    status: PushStatus;
    failureReason?: string;
    note?: string;
  }) => Promise<void>;
}

export const PushOutcomeModal: React.FC<PushOutcomeModalProps> = ({
  isOpen,
  pushRecord: push,
  isLoading,
  onClose,
  onConfirm,
}) => {
  const [status, setStatus] = useState<PushStatus>(push?.status || 'IN_PROGRESS');
  const [failureReason, setFailureReason] = useState<string>(push?.failureReason || '');
  const [note, setNote] = useState<string>(push?.note || '');

  React.useEffect(() => {
    if (push) {
      setStatus(push.status);
      setFailureReason(push.failureReason || '');
      setNote(push.note || '');
    }
  }, [push]);

  if (!isOpen || !push) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm({
      status,
      failureReason: status === 'FAILED' ? failureReason.trim() : undefined,
      note: note.trim() || undefined,
    });
  };

  const statusOptions: Array<{
    value: PushStatus;
    label: string;
    description: string;
    icon: React.ReactNode;
    color: string;
  }> = [
    {
      value: 'IN_PROGRESS',
      label: 'Đang xử lý',
      description: 'Chuyên viên đã liên hệ khách hàng; đang trao đổi và tư vấn',
      icon: <Clock className="w-4 h-4 text-amber-400" />,
      color: 'border-amber-700/50 hover:bg-amber-950/30',
    },
    {
      value: 'SUCCESS',
      label: 'Thành công',
      description: 'Khách hàng đồng ý và đã nộp hồ sơ hoặc mở thành công',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
      color: 'border-emerald-700/50 hover:bg-emerald-950/30',
    },
    {
      value: 'FAILED',
      label: 'Thất bại',
      description: 'Khách hàng từ chối, không liên lạc được hoặc không đủ điều kiện',
      icon: <XCircle className="w-4 h-4 text-red-400" />,
      color: 'border-red-700/50 hover:bg-red-950/30',
    },
    {
      value: 'CANCELLED',
      label: 'Đã hủy',
      description: 'Lượt chuyển bị thu hồi hoặc khách hàng dừng nhu cầu',
      icon: <Ban className="w-4 h-4 text-slate-400" />,
      color: 'border-slate-700/50 hover:bg-slate-800/30',
    },
  ];

  const commonFailureReasons = [
    'Khách hàng từ chối gặp chuyên viên / chưa có nhu cầu tại thời điểm này',
    'Khách hàng đang đi công tác / không thể liên lạc được',
    'Khách hàng muốn lãi suất hoặc biểu phí ưu đãi hơn',
    'Hồ sơ thu nhập hoặc lịch sử tín dụng không đạt tiêu chuẩn thẩm định',
    'Khách hàng đã sử dụng sản phẩm tương đương tại đơn vị khác',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-100">
              Cập nhật kết quả chuyển khách
            </h3>
            <p className="text-xs text-slate-400">
              Ghi nhận kết quả xử lý hoặc tiến độ để phục vụ phân tích dữ liệu
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Target Push Context */}
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold block">
                  Khách hàng & Sản phẩm
                </span>
                <span className="font-semibold text-slate-200 text-sm">
                  {push.customer?.fullName || 'Khách hàng'}
                </span>
              </div>
              <span className="text-xs font-mono text-blue-400 px-2 py-0.5 rounded bg-blue-950/50 border border-blue-800/50">
                {push.targetProduct?.name || 'Sản phẩm đề xuất'}
              </span>
            </div>
          </div>

          {/* Status Selection Cards */}
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-2">
              Chọn trạng thái kết quả <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {statusOptions.map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    status === opt.value
                      ? 'bg-slate-800/90 border-blue-500 shadow-sm'
                      : 'bg-slate-950/60 ' + opt.color
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {opt.icon}
                    <span className="font-semibold text-xs text-slate-100">
                      {opt.label}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {opt.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Conditional Failure Reason Input */}
          {status === 'FAILED' && (
            <div className="p-3 rounded-lg bg-red-950/20 border border-red-900/40 space-y-2">
              <label className="block text-xs font-mono text-red-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Lý do thất bại (Bắt buộc để phân tích)</span>
              </label>
              <select
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                className="w-full h-8 bg-slate-950 border border-slate-800 rounded px-2.5 text-xs text-slate-200 font-sans focus:outline-none focus:border-red-500 mb-2"
              >
                <option value="">Chọn lý do thường gặp...</option>
                {commonFailureReasons.map((r, i) => (
                  <option key={i} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <textarea
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                required
                placeholder="Hoặc nhập lý do từ chối / thất bại cụ thể..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-red-500"
              />
            </div>
          )}

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1">
              Ghi chú phản hồi / Lưu ý tiếp nhận (Không bắt buộc)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ý kiến chuyên viên, phản hồi từ khách hàng hoặc lịch hẹn tiếp theo..."
              rows={2}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isLoading}
              className="h-8 text-xs"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isLoading || (status === 'FAILED' && !failureReason.trim())}
              className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Đang lưu...' : 'Lưu kết quả chuyển khách'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PushOutcomeModal;
