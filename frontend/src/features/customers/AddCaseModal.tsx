import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Briefcase, AlertCircle, User } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useCreateCase } from '../../hooks/useCases';
import { useProducts } from '../../hooks/useProducts';
import { useCustomerDetail } from '../../hooks/useCustomers';
import { useToast } from '../../context/ToastContext';

export interface AddCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  onSuccess?: (newCaseId: string) => void;
}

export const AddCaseModal: React.FC<AddCaseModalProps> = ({
  isOpen,
  onClose,
  customerId,
  onSuccess,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: customer } = useCustomerDetail(customerId);
  const { data: products, isLoading: isProductsLoading } = useProducts(true);
  const createCase = useCreateCase(customerId);

  // Product is strictly optional! Default is empty ("Chưa chọn sản phẩm")
  const [productId, setProductId] = useState<string>('');
  const [applicationDate, setApplicationDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const activeProducts = (products || []).filter((p) => p.active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const newCase = await createCase.mutateAsync({
        productId: productId || null,
        applicationDate: applicationDate ? new Date(applicationDate).toISOString() : new Date().toISOString(),
        notes: notes.trim() || null,
      });

      toast.success(
        'Đã mở hồ sơ mới',
        productId
          ? 'Hồ sơ đã được khởi tạo thành công với sản phẩm đã chọn.'
          : 'Hồ sơ đã được khởi tạo ở trạng thái chưa chọn sản phẩm.'
      );

      setProductId('');
      setNotes('');
      setError('');
      onClose();

      if (onSuccess && newCase?.id) {
        onSuccess(newCase.id);
      } else if (newCase?.id) {
        navigate(`/customers/${customerId}/cases/${newCase.id}`);
      }
    } catch (err) {
      setError((err as Error).message || 'Không thể tạo hồ sơ mới');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-100">
      <div
        className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">Tạo hồ sơ mới</h3>
              <p className="text-[10px] text-slate-400">
                Khởi tạo quy trình thẩm định độc lập mới cho khách hàng
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

            {/* Customer Display */}
            <div className="p-2.5 rounded border border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-400">Khách hàng:</span>
                <span className="font-semibold text-slate-200">
                  {customer?.fullName || customerId.slice(0, 8)}
                </span>
              </div>
              {customer?.phone && (
                <span className="text-[11px] font-mono text-slate-400">{customer.phone}</span>
              )}
            </div>

            {/* Product selection (OPTIONAL) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-medium text-slate-300">
                  Sản phẩm / Gói vay <span className="text-slate-500 font-normal">(Tùy chọn)</span>
                </label>
                {!productId && (
                  <span className="text-[10px] text-amber-400 font-mono">Chưa chọn sản phẩm</span>
                )}
              </div>

              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                disabled={isProductsLoading}
                className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-purple-500 font-sans text-xs"
              >
                <option value="">-- Chưa chọn sản phẩm (Chọn sau) --</option>
                {activeProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                Có thể tạo hồ sơ trước khi chọn sản phẩm. Sau khi tạo, bạn có thể gán sản phẩm bất kỳ lúc nào.
              </p>
            </div>

            {/* Application Date */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Ngày tiếp nhận / nộp đơn
              </label>
              <input
                type="date"
                value={applicationDate}
                onChange={(e) => setApplicationDate(e.target.value)}
                className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono focus:outline-none focus:border-purple-500 text-xs"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Ghi chú khởi tạo hồ sơ
              </label>
              <textarea
                rows={3}
                placeholder="Nhu cầu hạn mức, nguồn giới thiệu, ghi chú thẩm tra ban đầu..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 font-sans text-xs"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 bg-slate-950/80 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={createCase.isPending}
              className="text-xs h-8"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={createCase.isPending}
              className="text-xs h-8 bg-purple-600 hover:bg-purple-500 text-white font-medium"
            >
              {createCase.isPending ? 'Đang tạo...' : '+ Tạo hồ sơ mới'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCaseModal;
