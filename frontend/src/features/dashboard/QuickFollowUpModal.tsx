import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, CalendarCheck, AlertCircle, Search, User } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useCreateFollowUp } from '../../hooks/useFollowUps';
import { useCustomers } from '../../hooks/useCustomers';
import { DASHBOARD_QUERY_KEY } from '../../hooks/useDashboard';

export interface QuickFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCustomerId?: string;
  defaultCustomerName?: string;
}

export const QuickFollowUpModal: React.FC<QuickFollowUpModalProps> = ({
  isOpen,
  onClose,
  defaultCustomerId = '',
  defaultCustomerName = '',
}) => {
  const queryClient = useQueryClient();
  const createFollowUp = useCreateFollowUp();

  const [search, setSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(defaultCustomerId);
  const [selectedCustomerName, setSelectedCustomerName] = useState(defaultCustomerName);

  // Tomorrow morning default
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState(tomorrow.toISOString().slice(0, 16));
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  // Search customers for assignment
  const { data: customerData, isLoading: isSearching } = useCustomers({
    search: search.trim() || undefined,
    pageSize: 6,
  });

  const customersList = customerData?.data || [];

  if (!isOpen) return null;

  const handleSelectCustomer = (id: string, name: string) => {
    setSelectedCustomerId(id);
    setSelectedCustomerName(name);
    if (!title) {
      setTitle(`Chăm sóc khách hàng ${name}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setError('Vui lòng chọn khách hàng cho lịch chăm sóc');
      return;
    }
    if (!title.trim()) {
      setError('Tiêu đề công việc là bắt buộc');
      return;
    }
    if (!dueAt) {
      setError('Ngày giờ thực hiện là bắt buộc');
      return;
    }

    try {
      await createFollowUp.mutateAsync({
        customerId: selectedCustomerId,
        title: title.trim(),
        description: description.trim() || null,
        dueAt: new Date(dueAt).toISOString(),
        status: 'PENDING',
      });

      // Refetch dashboard data
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });

      setTitle('');
      setDescription('');
      setSelectedCustomerId('');
      setSelectedCustomerName('');
      setError('');
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Không thể tạo lịch chăm sóc');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-slate-100">
            <CalendarCheck className="w-5 h-5 text-amber-400" />
            <h3 className="font-semibold text-base font-mono">Tạo lịch chăm sóc</h3>
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
          {/* Customer Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Gán cho khách hàng *</label>
            {selectedCustomerId ? (
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-700 bg-slate-800/60 text-xs">
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  <span className="font-semibold text-slate-200">{selectedCustomerName}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCustomerId('');
                    setSelectedCustomerName('');
                  }}
                  className="text-slate-400 hover:text-red-400 text-[11px]"
                >
                  Thay đổi
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Tìm tên hoặc số điện thoại khách hàng..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1 border border-slate-800 rounded-lg p-1 bg-slate-950/60">
                  {isSearching ? (
                    <div className="text-[11px] text-slate-500 text-center py-2">Đang tìm kiếm...</div>
                  ) : customersList.length === 0 ? (
                    <div className="text-[11px] text-slate-500 text-center py-2">Không tìm thấy khách hàng</div>
                  ) : (
                    customersList.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => handleSelectCustomer(c.id, c.fullName)}
                        className="px-2.5 py-1.5 rounded cursor-pointer text-xs flex items-center justify-between hover:bg-slate-800 transition-colors text-slate-200"
                      >
                        <span className="font-medium">{c.fullName}</span>
                        <span className="text-[10px] font-mono text-slate-400">{c.phone}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Task Title */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Mục tiêu / Nội dung công việc *</label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Gọi điện trao đổi về hồ sơ bổ sung khoản vay..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Due Time */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Thời hạn & Giờ thực hiện *</label>
            <input
              type="datetime-local"
              required
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Notes / Context */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Ghi chú / Ngữ cảnh (Không bắt buộc)</label>
            <textarea
              rows={3}
              placeholder="Nội dung trao đổi, lưu ý hoặc thông tin nghiệp vụ cần nắm..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Hủy
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={createFollowUp.isPending || !selectedCustomerId}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {createFollowUp.isPending ? 'Đang lưu...' : 'Lên lịch chăm sóc'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickFollowUpModal;
