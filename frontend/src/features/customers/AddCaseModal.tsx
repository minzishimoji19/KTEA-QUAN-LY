import React, { useState } from 'react';
import { X, Briefcase, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useCreateCase } from '../../hooks/useCases';
import { useProducts } from '../../hooks/useProducts';
import { CaseStatus } from '../../types/models';

export interface AddCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
}

export const AddCaseModal: React.FC<AddCaseModalProps> = ({
  isOpen,
  onClose,
  customerId,
}) => {
  const { data: products, isLoading: isProductsLoading } = useProducts();
  const createCase = useCreateCase(customerId);

  const [productId, setProductId] = useState('');
  const [caseStatus, setCaseStatus] = useState<CaseStatus>('SUBMITTED');
  const [applicationDate, setApplicationDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Auto-select first product if not selected
  const activeProducts = products || [];
  const selectedProductId = productId || (activeProducts[0]?.id ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      setError('Vui lòng chọn sản phẩm mục tiêu');
      return;
    }

    try {
      await createCase.mutateAsync({
        productId: selectedProductId,
        caseStatus,
        applicationDate: applicationDate ? new Date(applicationDate).toISOString() : new Date().toISOString(),
        notes: notes.trim() || null,
      });
      setNotes('');
      setError('');
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Không thể tạo hồ sơ dịch vụ');
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
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">Mở hồ sơ sản phẩm mới</h3>
              <p className="text-[10px] text-slate-400">Theo dõi tiến trình thẩm định khoản vay, thẻ hoặc dịch vụ tài chính</p>
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
                Sản phẩm mục tiêu <span className="text-red-400">*</span>
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setProductId(e.target.value)}
                disabled={isProductsLoading}
                className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
              >
                {activeProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Trạng thái ban đầu
                </label>
                <select
                  value={caseStatus}
                  onChange={(e) => setCaseStatus(e.target.value as CaseStatus)}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="DRAFT">Bản nháp (DRAFT)</option>
                  <option value="SUBMITTED">Đã nộp (SUBMITTED)</option>
                  <option value="UNDER_REVIEW">Đang thẩm định (UNDER_REVIEW)</option>
                  <option value="APPROVED">Đã duyệt (APPROVED)</option>
                  <option value="REJECTED">Từ chối (REJECTED)</option>
                  <option value="CANCELLED">Đã hủy (CANCELLED)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Ngày nộp hồ sơ
                </label>
                <input
                  type="date"
                  value={applicationDate}
                  onChange={(e) => setApplicationDate(e.target.value)}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Ghi chú hồ sơ / Mã hồ sơ theo dõi
              </label>
              <textarea
                rows={3}
                placeholder="Hạn mức yêu cầu, mã số hồ sơ thẩm định, kênh đối tác giới thiệu..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
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
              disabled={createCase.isPending}
              className="text-xs h-8"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={createCase.isPending || isProductsLoading}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              {createCase.isPending ? 'Đang tạo...' : 'Mở hồ sơ'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCaseModal;
