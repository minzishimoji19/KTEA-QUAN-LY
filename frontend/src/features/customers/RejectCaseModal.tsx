import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useRejectCase } from '../../hooks/useCases';
import { useToast } from '../../context/ToastContext';

export interface RejectCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  customerId: string;
  caseTitle?: string;
  onSuccess?: () => void;
}

export const RejectCaseModal: React.FC<RejectCaseModalProps> = ({
  isOpen,
  onClose,
  caseId,
  customerId,
  caseTitle,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const rejectCase = useRejectCase(customerId);
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do từ chối');
      return;
    }

    try {
      await rejectCase.mutateAsync({
        id: caseId,
        reason: reason.trim(),
        note: note.trim() || null,
      });

      toast.success('Đã từ chối hồ sơ', 'Hồ sơ đã được chuyển sang trạng thái Từ chối (kết thúc quy trình).');
      setReason('');
      setNote('');
      setError('');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError((err as Error).message || 'Không thể từ chối hồ sơ');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-100">
      <div
        className="w-full max-w-md rounded-lg border border-rose-900/60 bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-rose-950/80 bg-rose-950/30">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-rose-200 font-mono">Xác nhận từ chối hồ sơ?</h3>
              {caseTitle && (
                <p className="text-[10px] text-slate-400 truncate max-w-[260px]">{caseTitle}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4 space-y-3.5 text-xs">
            {/* Critical warning notice */}
            <div className="p-3 rounded bg-rose-950/40 border border-rose-800/60 text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1 text-[11px] leading-relaxed">
                <span className="font-semibold block text-rose-200">
                  Lưu ý quan trọng:
                </span>
                <span>
                  Sau khi từ chối, hồ sơ này sẽ kết thúc và không thể tiếp tục hoặc kích hoạt lại. Nếu khách hàng có nhu cầu nộp lại, hãy tạo một hồ sơ mới độc lập.
                </span>
              </div>
            </div>

            {error && (
              <div className="p-2.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Lý do từ chối <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Không đủ điều kiện thu nhập, nợ xấu CIC, khách hủy nhu cầu..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-rose-500 font-sans"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Ghi chú bổ sung
              </label>
              <textarea
                rows={3}
                placeholder="Ghi chú thêm chi tiết về quyết định thẩm định hoặc phản hồi đối tác..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-rose-500 font-sans text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 bg-slate-950/80 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={rejectCase.isPending}
              className="text-xs h-8"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={rejectCase.isPending || !reason.trim()}
              className="text-xs h-8 bg-rose-600 hover:bg-rose-500 text-white font-medium"
            >
              {rejectCase.isPending ? 'Đang xử lý...' : 'Xác nhận từ chối'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectCaseModal;
