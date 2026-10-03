import React, { useState, useEffect } from 'react';
import { X, Tag as TagIcon, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useCreateTag, useUpdateTag } from '../../hooks/useTags';
import { Tag } from '../../types/models';

export interface TagModalProps {
  isOpen: boolean;
  onClose: () => void;
  tag?: Tag | null;
}

const COLOR_PRESETS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#64748b', // slate
];

export const TagModal: React.FC<TagModalProps> = ({ isOpen, onClose, tag }) => {
  const isEditing = Boolean(tag);
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();

  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (tag) {
      setName(tag.name);
      setColor(tag.color || COLOR_PRESETS[0]);
    } else {
      setName('');
      setColor(COLOR_PRESETS[0]);
    }
    setError('');
  }, [tag, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên thẻ');
      return;
    }

    try {
      if (isEditing && tag) {
        await updateTag.mutateAsync({
          id: tag.id,
          data: { name: name.trim(), color },
        });
      } else {
        await createTag.mutateAsync({
          name: name.trim(),
          color,
        });
      }
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Không thể lưu thẻ');
    }
  };

  const isSubmitting = createTag.isPending || updateTag.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-slate-100">
            <TagIcon className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-base font-mono">
              {isEditing ? 'Chỉnh sửa thẻ khách hàng' : 'Tạo thẻ khách hàng'}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Tên thẻ *</label>
            <input
              type="text"
              required
              placeholder="VD: Khách hàng VIP, Tiềm năng cao..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-300">Màu nhận diện</label>
            <div className="flex items-center gap-2">
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform ${
                    color === c ? 'scale-125 border-white shadow-md' : 'border-transparent hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-400">Xem trước:</span>
              <span
                className="px-2 py-0.5 rounded text-xs font-mono font-medium text-white shadow-sm"
                style={{ backgroundColor: color }}
              >
                {name || 'Thẻ mẫu'}
              </span>
            </div>
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
              {isSubmitting ? 'Đang lưu...' : isEditing ? 'Lưu thẻ' : 'Tạo thẻ'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TagModal;
