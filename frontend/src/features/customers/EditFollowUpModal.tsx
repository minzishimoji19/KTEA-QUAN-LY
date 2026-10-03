import React, { useState, useEffect } from 'react';
import { X, CalendarCheck, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useUpdateFollowUp } from '../../hooks/useFollowUps';
import { FollowUp, FollowUpStatus } from '../../types/models';

export interface EditFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  followUp: FollowUp | null;
}

export const EditFollowUpModal: React.FC<EditFollowUpModalProps> = ({
  isOpen,
  onClose,
  followUp,
}) => {
  const updateFollowUp = useUpdateFollowUp();

  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<FollowUpStatus>('PENDING');
  const [error, setError] = useState('');

  useEffect(() => {
    if (followUp && isOpen) {
      setTitle(followUp.title);
      // Format to YYYY-MM-DDTHH:mm
      try {
        const d = new Date(followUp.dueAt);
        const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setDueAt(isoLocal);
      } catch {
        setDueAt(followUp.dueAt.slice(0, 16));
      }
      setDescription(followUp.description || '');
      setStatus(followUp.status);
      setError('');
    }
  }, [followUp, isOpen]);

  if (!isOpen || !followUp) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề nhiệm vụ');
      return;
    }
    if (!dueAt) {
      setError('Vui lòng chọn ngày giờ hẹn');
      return;
    }

    try {
      await updateFollowUp.mutateAsync({
        id: followUp.id,
        data: {
          title: title.trim(),
          description: description.trim() || null,
          dueAt: new Date(dueAt).toISOString(),
          status,
          completedAt:
            status === 'COMPLETED'
              ? followUp.completedAt || new Date().toISOString()
              : null,
        },
      });
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Không thể cập nhật lịch chăm sóc');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-100">
      <div
        className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-100"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">Chỉnh sửa nhiệm vụ chăm sóc</h3>
              <p className="text-[10px] text-slate-400">Điều chỉnh nội dung hướng dẫn hoặc dời lại hạn hoàn thành</p>
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
          <div className="p-4 space-y-3 text-xs">
            {error && (
              <div className="p-2.5 rounded bg-red-950/50 border border-red-800/60 text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Tiêu đề nhiệm vụ / Mục tiêu <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Ngày giờ hẹn <span className="text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Trạng thái
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as FollowUpStatus)}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                >
                  <option value="PENDING">Đang chờ xử lý (PENDING)</option>
                  <option value="IN_PROGRESS">Đang thực hiện (IN_PROGRESS)</option>
                  <option value="COMPLETED">Đã hoàn thành (COMPLETED)</option>
                  <option value="CANCELLED">Đã hủy (CANCELLED)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Hướng dẫn nhiệm vụ / Nội dung cần trao đổi
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 bg-slate-950/80 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={updateFollowUp.isPending}
              className="text-xs h-8"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={updateFollowUp.isPending}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              {updateFollowUp.isPending ? 'Đang cập nhật...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditFollowUpModal;
