import React, { useState } from 'react';
import { X, Package, Check, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useSelectProduct } from '../../hooks/useCases';
import { useProducts } from '../../hooks/useProducts';
import { useToast } from '../../context/ToastContext';

export interface SelectProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  customerId: string;
  currentProductId?: string | null;
  onSuccess?: () => void;
}

export const SelectProductModal: React.FC<SelectProductModalProps> = ({
  isOpen,
  onClose,
  caseId,
  customerId,
  currentProductId,
  onSuccess,
}) => {
  const { data: products, isLoading: isProductsLoading } = useProducts(true);
  const selectProduct = useSelectProduct(customerId);
  const { toast } = useToast();

  const [selectedId, setSelectedId] = useState(currentProductId || '');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Filter only active products
  const activeProducts = (products || []).filter((p) => p.active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      setError('Vui lòng chọn một sản phẩm');
      return;
    }

    try {
      await selectProduct.mutateAsync({
        id: caseId,
        productId: selectedId,
      });

      const selectedProduct = activeProducts.find((p) => p.id === selectedId);
      toast.success(
        'Đã chọn sản phẩm',
        `Hồ sơ đã được gắn với sản phẩm "${selectedProduct?.name || 'mục tiêu'}".`
      );
      setError('');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err) {
      setError((err as Error).message || 'Không thể chọn sản phẩm');
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
            <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">Chọn sản phẩm cho hồ sơ</h3>
              <p className="text-[10px] text-slate-400">Gán gói sản phẩm/dịch vụ tài chính để chuyển sang bước đăng ký</p>
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
              <label className="block text-[11px] font-medium text-slate-300 mb-2">
                Danh sách sản phẩm khả dụng ({activeProducts.length})
              </label>

              {isProductsLoading ? (
                <div className="p-4 text-center text-slate-500 text-xs">Đang tải danh sách sản phẩm...</div>
              ) : activeProducts.length === 0 ? (
                <div className="p-4 rounded border border-slate-800 bg-slate-950 text-center text-slate-400 text-xs">
                  Hiện chưa có sản phẩm nào đang hoạt động trong hệ thống.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {activeProducts.map((p) => {
                    const isSelected = selectedId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                          isSelected
                            ? 'border-blue-500 bg-blue-950/30 text-slate-100'
                            : 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-100 truncate">{p.name}</span>
                            <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                              {p.code}
                            </span>
                          </div>
                          {p.description && (
                            <p className="text-[11px] text-slate-400 line-clamp-2">{p.description}</p>
                          )}
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isSelected
                              ? 'border-blue-500 bg-blue-600 text-white'
                              : 'border-slate-700 bg-slate-900'
                          }`}
                        >
                          {isSelected && <Check className="w-2.5 h-2.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 bg-slate-950/80 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={selectProduct.isPending}
              className="text-xs h-8"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={selectProduct.isPending || !selectedId}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              {selectProduct.isPending ? 'Đang lưu...' : 'Xác nhận chọn sản phẩm'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SelectProductModal;
