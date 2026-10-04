import React, { useState } from 'react';
import { X, Globe, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useCreateCustomerSource } from '../../hooks/useCustomerSources';
import { useToast } from '../../context/ToastContext';

export interface CustomerSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CustomerSourceModal: React.FC<CustomerSourceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');

  const createSource = useCreateCustomerSource();
  const { toast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên nguồn khách');
      return;
    }

    try {
      await createSource.mutateAsync({
        name: name.trim(),
        active,
      });

      toast.success('Thành công', `Đã tạo nguồn khách hàng "${name.trim()}".`);
      setName('');
      setActive(true);
      setError('');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Không thể tạo nguồn khách hàng';
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
            <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">Thêm nguồn khách hàng mới</h3>
              <p className="text-[10px] text-slate-400">Khai báo kênh tiếp thị, đối tác hoặc nguồn tiếp cận</p>
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
                Tên nguồn khách <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: KTEA, VIB, Đối tác Tiếp thị, Facebook..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-sans"
                required
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="sourceActive"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0 focus:outline-none"
              />
              <label htmlFor="sourceActive" className="text-xs text-slate-300 cursor-pointer">
                Kích hoạt ngay (khả dụng khi tạo khách hàng mới)
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 bg-slate-950/80 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={createSource.isPending}
              className="text-xs h-8"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={createSource.isPending || !name.trim()}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              {createSource.isPending ? 'Đang tạo...' : '+ Thêm nguồn'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CustomerSourceModal;
