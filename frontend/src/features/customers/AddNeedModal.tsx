import React, { useState } from 'react';
import { X, Layers, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useCreateNeed } from '../../hooks/useNeeds';
import { NeedStatus } from '../../types/models';

export interface AddNeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
}

const COMMON_NEEDS = [
  'HOME_MORTGAGE',
  'REFINANCE',
  'UNSECURED_PERSONAL_LOAN',
  'SME_WORKING_CAPITAL',
  'CREDIT_CARD_LIMIT_INCREASE',
  'PREMIUM_REWARDS_CARD',
  'WEALTH_PORTFOLIO_ADVISORY',
  'HIGH_YIELD_SAVINGS',
  'BUSINESS_EQUIPMENT_FINANCING',
  'OTHER',
];

export const AddNeedModal: React.FC<AddNeedModalProps> = ({
  isOpen,
  onClose,
  customerId,
}) => {
  const createNeed = useCreateNeed(customerId);

  const [needType, setNeedType] = useState('HOME_MORTGAGE');
  const [customNeedType, setCustomNeedType] = useState('');
  const [status, setStatus] = useState<NeedStatus>('OPEN');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalType = needType === 'OTHER' ? customNeedType.trim() : needType;
    if (!finalType) {
      setError('Vui lòng chọn hoặc nhập nhóm nhu cầu');
      return;
    }

    try {
      await createNeed.mutateAsync({
        needType: finalType,
        status,
        notes: notes.trim() || null,
        detectedAt: new Date().toISOString(),
      });
      setNotes('');
      setError('');
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Không thể ghi nhận nhu cầu của khách hàng');
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
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">Ghi nhận nhu cầu / Ý định</h3>
              <p className="text-[10px] text-slate-400">Thu thập nhu cầu tài chính phục vụ đề xuất và tư vấn sản phẩm</p>
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
                Nhóm nhu cầu <span className="text-red-400">*</span>
              </label>
              <select
                value={needType}
                onChange={(e) => setNeedType(e.target.value)}
                className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
              >
                {COMMON_NEEDS.map((n) => (
                  <option key={n} value={n}>
                    {n === 'HOME_MORTGAGE' ? 'Vay mua nhà (HOME MORTGAGE)' :
                     n === 'REFINANCE' ? 'Tái tài trợ / Đáo hạn (REFINANCE)' :
                     n === 'UNSECURED_PERSONAL_LOAN' ? 'Vay tín chấp tiêu dùng (UNSECURED PERSONAL LOAN)' :
                     n === 'SME_WORKING_CAPITAL' ? 'Vốn lưu động DN vừa & nhỏ (SME WORKING CAPITAL)' :
                     n === 'CREDIT_CARD_LIMIT_INCREASE' ? 'Nâng hạn mức thẻ (CREDIT CARD LIMIT INCREASE)' :
                     n === 'PREMIUM_REWARDS_CARD' ? 'Thẻ tín dụng hạng sang (PREMIUM REWARDS CARD)' :
                     n === 'WEALTH_PORTFOLIO_ADVISORY' ? 'Tư vấn quản lý tài sản (WEALTH PORTFOLIO ADVISORY)' :
                     n === 'HIGH_YIELD_SAVINGS' ? 'Tiết kiệm sinh lời cao (HIGH YIELD SAVINGS)' :
                     n === 'BUSINESS_EQUIPMENT_FINANCING' ? 'Tài trợ thiết bị (BUSINESS EQUIPMENT FINANCING)' :
                     'Nhu cầu khác (OTHER)'}
                  </option>
                ))}
              </select>
            </div>

            {needType === 'OTHER' && (
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Mô tả nhu cầu tùy chỉnh <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: Vay vốn đầu tư dây chuyền sản xuất"
                  value={customNeedType}
                  onChange={(e) => setCustomNeedType(e.target.value)}
                  className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Trạng thái nhu cầu
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as NeedStatus)}
                className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
              >
                <option value="OPEN">Đang mở (Chưa đáp ứng)</option>
                <option value="IN_PROGRESS">Đang xử lý (Đang tư vấn / thẩm định)</option>
                <option value="RESOLVED">Đã đáp ứng (Đã chốt / hoàn tất)</option>
                <option value="DROPPED">Đã hủy (Khách từ chối / không phù hợp)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Ghi chú & Bối cảnh phát hiện
              </label>
              <textarea
                rows={3}
                placeholder="Ngân sách dự kiến, thời hạn mong muốn, lãi suất mục tiêu hoặc các ràng buộc khẩn cấp..."
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
              disabled={createNeed.isPending}
              className="text-xs h-8"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={createNeed.isPending}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              {createNeed.isPending ? 'Đang lưu...' : 'Ghi nhận nhu cầu'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddNeedModal;
