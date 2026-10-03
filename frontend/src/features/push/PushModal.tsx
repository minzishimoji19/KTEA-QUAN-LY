import React, { useState } from 'react';
import { Send, AlertCircle, X } from 'lucide-react';
import { Recommendation, Product } from '../../types/models';
import { Button } from '../../components/ui/Button';

export interface PushModalProps {
  isOpen: boolean;
  recommendation: Recommendation | null;
  products: Product[];
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (data: { targetProductId: string; note?: string }) => Promise<void>;
}

export const PushModal: React.FC<PushModalProps> = ({
  isOpen,
  recommendation: rec,
  products,
  isLoading,
  onClose,
  onConfirm,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(
    rec?.targetProductId || ''
  );
  const [note, setNote] = useState<string>('');

  // Sync state when recommendation opens
  React.useEffect(() => {
    if (rec) {
      setSelectedProductId(rec.targetProductId || products[0]?.id || '');
      setNote(`Chuyển khách từ quy tắc đề xuất [${rec.recommendationType}]`);
    }
  }, [rec, products]);

  if (!isOpen || !rec) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onConfirm({
      targetProductId: selectedProductId,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100">
                Xác nhận chuyển khách
              </h3>
              <p className="text-xs text-slate-400">
                Thao tác phê duyệt chuyển khách hàng tới bộ phận phụ trách
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Target Customer Banner */}
          <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 text-xs">
            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 font-semibold block">
              Khách hàng mục tiêu
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="font-semibold text-slate-200 text-sm">
                {rec.customer?.fullName || 'Hồ sơ khách hàng'}
              </span>
              <span className="font-mono text-slate-400 text-xs">
                {rec.customer?.phone || rec.customerId}
              </span>
            </div>
          </div>

          {/* Transparent Rule Match Explanation */}
          <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-900/40 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 text-blue-400 font-semibold font-mono text-[11px] mb-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Căn cứ đề xuất</span>
            </div>
            <p className="leading-relaxed text-slate-300">{rec.reason}</p>
          </div>

          {/* Product Destination Selection */}
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1.5">
              Sản phẩm / Bộ phận tiếp nhận <span className="text-red-400">*</span>
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              required
              className="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg px-3 text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </div>

          {/* Operator Note */}
          <div>
            <label className="block text-xs font-mono text-slate-300 mb-1.5">
              Ghi chú chuyển khách / Hướng dẫn xử lý (Không bắt buộc)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Thêm ngữ cảnh nhu cầu, chi nhánh ưu tiên hoặc hướng dẫn liên hệ..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 leading-relaxed font-sans"
            />
          </div>

          {/* Confirmation Notice */}
          <p className="text-[11px] text-slate-500 italic">
            Thao tác này tạo một bản ghi chuyển khách liên kết với đề xuất này. Nhân viên vận hành luôn toàn quyền kiểm soát quy trình.
          </p>

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
              disabled={isLoading || !selectedProductId}
              className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Đang chuyển...' : 'Xác nhận chuyển khách'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PushModal;
