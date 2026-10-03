import React, { useState } from 'react';
import { X, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useCreateActivity } from '../../hooks/useActivities';
import { ActivityType } from '../../types/models';

export interface AddActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
}

export const AddActivityModal: React.FC<AddActivityModalProps> = ({
  isOpen,
  onClose,
  customerId,
}) => {
  const createActivity = useCreateActivity(customerId);

  const [type, setType] = useState<ActivityType>('CALL');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [occurredAt, setOccurredAt] = useState(
    new Date().toISOString().slice(0, 16)
  );
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề hoạt động');
      return;
    }

    try {
      await createActivity.mutateAsync({
        type,
        title: title.trim(),
        description: description.trim() || null,
        occurredAt: new Date(occurredAt).toISOString(),
      });
      setTitle('');
      setDescription('');
      setError('');
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Không thể ghi nhận hoạt động');
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
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">Ghi nhận hoạt động tương tác</h3>
              <p className="text-[10px] text-slate-400">Nhật ký theo dõi dòng thời gian không thể xóa sửa</p>
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Loại hoạt động
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ActivityType)}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="CONTACT">Bắt đầu liên hệ</option>
                  <option value="CALL">Cuộc gọi thoại</option>
                  <option value="MESSAGE">Tin nhắn / Trao đổi</option>
                  <option value="MEETING">Gặp mặt / Tư vấn trực tiếp</option>
                  <option value="APPLICATION_CREATED">Tạo hồ sơ dịch vụ</option>
                  <option value="APPLICATION_UPDATED">Cập nhật hồ sơ</option>
                  <option value="STATUS_CHANGED">Thay đổi trạng thái</option>
                  <option value="NEED_DETECTED">Phát hiện nhu cầu</option>
                  <option value="FOLLOW_UP">Chăm sóc định kỳ</option>
                  <option value="PUSH_CREATED">Gửi chuyển khách</option>
                  <option value="PUSH_RESULT">Kết quả chuyển khách</option>
                  <option value="NOTE_CREATED">Ghi chú mới</option>
                  <option value="SYSTEM_EVENT">Sự kiện hệ thống</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Thời gian diễn ra
                </label>
                <input
                  type="datetime-local"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Tiêu đề / Tóm tắt <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Tư vấn qua điện thoại về gói vay mua nhà"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Ghi chú chi tiết
              </label>
              <textarea
                rows={3}
                placeholder="Nội dung trao đổi chính, phản hồi của khách hàng, các bước tiếp theo..."
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
              disabled={createActivity.isPending}
              className="text-xs h-8"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={createActivity.isPending}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              {createActivity.isPending ? 'Đang lưu...' : 'Lưu hoạt động'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddActivityModal;
