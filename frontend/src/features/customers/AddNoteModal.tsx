import React, { useState } from 'react';
import { X, FileText, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useCreateNote } from '../../hooks/useNotes';

export interface AddNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
}

export const AddNoteModal: React.FC<AddNoteModalProps> = ({
  isOpen,
  onClose,
  customerId,
}) => {
  const createNote = useCreateNote(customerId);
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Nội dung ghi chú không được để trống');
      return;
    }

    try {
      await createNote.mutateAsync(content.trim());
      setContent('');
      setError('');
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Không thể lưu ghi chú');
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
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">Thêm ghi chú khách hàng</h3>
              <p className="text-[10px] text-slate-400">Ghi chú nội bộ hoặc quan sát bảo mật của nhân viên</p>
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
                Nội dung ghi chú <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={5}
                placeholder="Nhập thông tin bối cảnh khách hàng, lưu ý nghiệp vụ, đánh giá rủi ro hoặc thông tin cần nhớ..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
                autoFocus
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 bg-slate-950/80 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={createNote.isPending}
              className="text-xs h-8"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={createNote.isPending}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              {createNote.isPending ? 'Đang lưu...' : 'Lưu ghi chú'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddNoteModal;
