import React, { useState, useEffect } from 'react';
import { X, CalendarCheck, AlertCircle, Lock } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { VietnameseDatePicker } from '../../components/ui/VietnameseDatePicker';
import { toIsoDateString } from '../../utils/formatters';
import { useUpdateFollowUp } from '../../hooks/useFollowUps';
import { useEligibleCaregivers } from '../../hooks/useCaretakers';
import { useAuth } from '../../context/AuthContext';
import { FollowUp, FollowUpStatus } from '../../types/models';
import { AuthUser } from '../../types/auth';

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
  const { role } = useAuth();
  const isPartner = role === 'PARTNER';
  const updateFollowUp = useUpdateFollowUp();
  const { data: caregivers, isLoading: isCaregiversLoading } = useEligibleCaregivers();

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('09:00');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<FollowUpStatus>('PENDING');
  const [assignedToUserId, setAssignedToUserId] = useState<string>('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (followUp && isOpen) {
      setTitle(followUp.title);
      try {
        const d = new Date(followUp.dueAt);
        if (!isNaN(d.getTime())) {
          setDueDate(toIsoDateString(d));
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          setDueTime(`${hh}:${mm}`);
        } else {
          setDueDate(followUp.dueAt.slice(0, 10));
          setDueTime('09:00');
        }
      } catch {
        setDueDate(followUp.dueAt.slice(0, 10));
        setDueTime('09:00');
      }
      setDescription(followUp.description || '');
      setStatus(followUp.status);
      setAssignedToUserId(followUp.assignedToUserId || '');
      setAssignedTo(followUp.assignedToUser?.fullName || followUp.assignedTo || '');
      setError('');
    }
  }, [followUp, isOpen]);

  if (!isOpen || !followUp) return null;

  const isLockedForPartner =
    isPartner && (followUp.status === 'COMPLETED' || followUp.status === 'CANCELLED');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedForPartner) return;

    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề nhiệm vụ');
      return;
    }
    if (!dueDate) {
      setError('Vui lòng chọn ngày hẹn (dd/MM/yyyy)');
      return;
    }

    try {
      const timePart = dueTime && /^\d{2}:\d{2}$/.test(dueTime) ? dueTime : '09:00';
      const dueIso = new Date(`${dueDate}T${timePart}:00`).toISOString();

      if (isPartner) {
        // Partner only updates status, care notes, title/dueAt on their assigned schedule;
        // backend authoritatively records completedAt and actor.
        await updateFollowUp.mutateAsync({
          id: followUp.id,
          data: {
            title: title.trim(),
            description: description.trim() || null,
            dueAt: dueIso,
            status,
          },
        });
      } else {
        await updateFollowUp.mutateAsync({
          id: followUp.id,
          data: {
            title: title.trim(),
            description: description.trim() || null,
            dueAt: dueIso,
            status,
            assignedTo: assignedTo || null,
            assignedToUserId: assignedToUserId || null,
            completedAt:
              status === 'COMPLETED'
                ? followUp.completedAt || new Date().toISOString()
                : null,
          },
        });
      }
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
              <h3 className="text-sm font-semibold text-slate-100 font-mono">
                {isPartner ? 'Cập nhật kết quả & trạng thái lịch chăm sóc' : 'Chỉnh sửa nhiệm vụ chăm sóc'}
              </h3>
              <p className="text-[10px] text-slate-400">
                {isPartner
                  ? 'Cập nhật tiến độ, đánh dấu hoàn thành và ghi chú kết quả chăm sóc'
                  : 'Điều chỉnh nội dung, người chăm sóc hoặc dời lịch hẹn'}
              </p>
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

            {isLockedForPartner && (
              <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800/50 text-emerald-300 flex items-center gap-2 text-[11px]">
                <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Lịch chăm sóc này đã được khóa ({followUp.status === 'COMPLETED' ? 'Đã hoàn thành' : 'Đã hủy'}). Chỉ Quản trị viên mới có thể mở lại lịch.
                </span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Tiêu đề nhiệm vụ / Mục tiêu <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                disabled={isLockedForPartner}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-blue-500 disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Ngày giờ hạn (dd/MM/yyyy) <span className="text-red-400">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="flex-1">
                    <VietnameseDatePicker
                      variant="dark"
                      size="sm"
                      disabled={isLockedForPartner}
                      value={dueDate}
                      showClear={false}
                      placeholder="dd/mm/yyyy"
                      onChange={(isoDate) => setDueDate(isoDate)}
                    />
                  </div>
                  <input
                    type="time"
                    disabled={isLockedForPartner}
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="w-24 h-8 px-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500 disabled:opacity-60"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Người chăm sóc
                </label>
                <select
                  value={assignedToUserId}
                  onChange={(e) => {
                    const uId = e.target.value;
                    setAssignedToUserId(uId);
                    const found = caregivers?.find((u: AuthUser) => u.id === uId);
                    setAssignedTo(found ? found.fullName : '');
                  }}
                  disabled={isPartner || isCaregiversLoading}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-medium focus:outline-none focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <option value="">-- Chưa phân công --</option>
                  {!assignedToUserId && assignedTo && (
                    <option value="">{assignedTo} (Lịch sử)</option>
                  )}
                  {caregivers &&
                    caregivers.map((u: AuthUser) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'})
                      </option>
                    ))}
                </select>
                {isPartner && (
                  <p className="text-[10px] text-slate-500 mt-0.5">Chỉ Quản trị viên mới có quyền đổi người chăm sóc.</p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Trạng thái thực hiện
              </label>
              <select
                value={status}
                disabled={isLockedForPartner}
                onChange={(e) => setStatus(e.target.value as FollowUpStatus)}
                className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono focus:outline-none focus:border-blue-500 disabled:opacity-60"
              >
                <option value="PENDING">Đang chờ xử lý (PENDING)</option>
                <option value="IN_PROGRESS">Đang thực hiện (IN_PROGRESS)</option>
                <option value="COMPLETED">Đã hoàn thành (COMPLETED)</option>
                {role === 'ADMIN' && (
                  <option value="CANCELLED">Đã hủy (CANCELLED)</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Ghi chú kết quả / Nội dung chăm sóc
              </label>
              <textarea
                rows={3}
                disabled={isLockedForPartner}
                placeholder="Ghi chú nội dung trao đổi hoặc kết quả chăm sóc khách hàng..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-sans disabled:opacity-60"
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
              {isLockedForPartner ? 'Đóng' : 'Hủy'}
            </Button>
            {!isLockedForPartner && (
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={updateFollowUp.isPending}
                className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white font-medium"
              >
                {updateFollowUp.isPending ? 'Đang cập nhật...' : 'Lưu thay đổi'}
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditFollowUpModal;
