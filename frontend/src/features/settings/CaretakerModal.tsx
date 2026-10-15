import React, { useState, useEffect } from 'react';
import { X, UserCheck, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useCreateCaretaker, useUpdateCaretaker } from '../../hooks/useCaretakers';
import { useToast } from '../../context/ToastContext';
import { Caretaker } from '../../types/models';

export interface CaretakerModalProps {
  isOpen: boolean;
  onClose: () => void;
  caretaker?: Caretaker | null;
  onSuccess?: () => void;
}

export const CaretakerModal: React.FC<CaretakerModalProps> = ({
  isOpen,
  onClose,
  caretaker,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');

  const createCaretaker = useCreateCaretaker();
  const updateCaretaker = useUpdateCaretaker();
  const { toast } = useToast();

  useEffect(() => {
    if (caretaker) {
      setName(caretaker.name);
      setActive(caretaker.active);
    } else {
      setName('');
      setActive(true);
    }
    setError('');
  }, [caretaker, isOpen]);

  if (!isOpen) return null;

  const isEditing = Boolean(caretaker);
  const isPending = createCaretaker.isPending || updateCaretaker.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Vui lòng nhập tên người chăm sóc');
      return;
    }

    try {
      if (isEditing && caretaker) {
        await updateCaretaker.mutateAsync({
          id: caretaker.id,
          data: {
            name: trimmedName,
            active,
          },
        });
        toast.success('Thành công', `Đã cập nhật thông tin người chăm sóc "${trimmedName}".`);
      } else {
        await createCaretaker.mutateAsync({
          name: trimmedName,
          active,
        });
        toast.success('Thành công', `Đã thêm người chăm sóc "${trimmedName}".`);
      }

      setName('');
      setActive(true);
      setError('');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu người chăm sóc';
      setError(message);
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
            <div className="w-7 h-7 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">
                {isEditing ? 'Chỉnh sửa người chăm sóc' : 'Thêm người chăm sóc mới'}
              </h3>
              <p className="text-[10px] text-slate-400">
                {isEditing
                  ? 'Cập nhật tên hoặc trạng thái hoạt động'
                  : 'Khai báo nhân sự phụ trách chăm sóc khách hàng'}
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
          <div className="p-4 space-y-3.5 text-xs">
            {error && (
              <div className="p-2.5 rounded bg-rose-950/50 border border-rose-800/60 text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Tên người chăm sóc <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Ktea, xoaicaldez, mfast, Nguyễn Văn A..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 font-sans"
                required
                autoFocus
              />
              <p className="mt-1 text-[10px] text-slate-500">
                Tên sẽ hiển thị trong dropdown phân công lịch chăm sóc và bộ lọc lịch chăm sóc.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-emerald-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <div>
                  <span className="text-[11px] font-medium text-slate-200 block">Đang hoạt động</span>
                  <span className="text-[10px] text-slate-500 block">
                    Người chăm sóc đang hoạt động mới xuất hiện khi tạo hoặc phân công lịch mới.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isPending}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
              disabled={isPending}
            >
              {isPending
                ? 'Đang lưu...'
                : isEditing
                ? 'Lưu thay đổi'
                : 'Thêm người chăm sóc'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CaretakerModal;
