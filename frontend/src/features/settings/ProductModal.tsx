import React, { useState, useEffect } from 'react';
import { X, Package, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useCreateProduct, useUpdateProduct } from '../../hooks/useProducts';
import { Product } from '../../types/models';

export interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const isEditing = Boolean(product);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (product) {
      setCode(product.code);
      setName(product.name);
      setDescription(product.description || '');
      setActive(product.active);
    } else {
      setCode('');
      setName('');
      setDescription('');
      setActive(true);
    }
    setError('');
  }, [product, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Vui lòng nhập mã sản phẩm');
      return;
    }
    if (!name.trim()) {
      setError('Vui lòng nhập tên sản phẩm');
      return;
    }

    try {
      if (isEditing && product) {
        await updateProduct.mutateAsync({
          id: product.id,
          data: {
            code: code.trim().toUpperCase(),
            name: name.trim(),
            description: description.trim() || null,
            active,
          },
        });
      } else {
        await createProduct.mutateAsync({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim() || null,
          active,
        });
      }
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Không thể lưu sản phẩm');
    }
  };

  const isSubmitting = createProduct.isPending || updateProduct.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-slate-100">
            <Package className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-base font-mono">
              {isEditing ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-lg flex items-center gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Mã sản phẩm *</label>
            <input
              type="text"
              required
              placeholder="VD: VAY_MUA_XE_UU_DAI"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 uppercase"
            />
            <p className="text-[10px] text-slate-500 font-mono">
              Mã định danh duy nhất dùng cho thuật toán đề xuất sản phẩm
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Tên sản phẩm *</label>
            <input
              type="text"
              required
              placeholder="VD: Gói vay mua ô tô ưu đãi"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Mô tả sản phẩm</label>
            <textarea
              rows={3}
              placeholder="Điều kiện áp dụng, lãi suất, hạn mức và tính năng sản phẩm..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
              />
              <span>Đang hoạt động (Được áp dụng cho đề xuất & mở hồ sơ)</span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              {isSubmitting ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;
