import React, { useState, useEffect, useRef } from 'react';
import { X, CalendarCheck, AlertCircle, Search, Users, User, Check, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useCreateFollowUp, useCreateBulkFollowUp } from '../../hooks/useFollowUps';
import { customerService } from '../../services/customerService';
import { useCaretakers } from '../../hooks/useCaretakers';

export interface SelectedCustomerItem {
  id: string;
  fullName: string;
  phone?: string;
}

export interface ScheduleFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId?: string;
  customerName?: string;
  initialSelectedCustomers?: SelectedCustomerItem[];
}

export const ScheduleFollowUpModal: React.FC<ScheduleFollowUpModalProps> = ({
  isOpen,
  onClose,
  customerId,
  customerName,
  initialSelectedCustomers,
}) => {
  const createFollowUp = useCreateFollowUp();
  const createBulkFollowUp = useCreateBulkFollowUp();
  const { data: caretakers, isLoading: isCaretakersLoading } = useCaretakers(true);

  // Tomorrow by default
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const [selectedCustomers, setSelectedCustomers] = useState<SelectedCustomerItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SelectedCustomerItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState(tomorrow.toISOString().slice(0, 16));
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialSelectedCustomers && initialSelectedCustomers.length > 0) {
        setSelectedCustomers(initialSelectedCustomers);
      } else if (customerId) {
        setSelectedCustomers([{ id: customerId, fullName: customerName || 'Khách hàng' }]);
      } else {
        setSelectedCustomers([]);
      }

      setTitle(
        customerName
          ? `Chăm sóc khách hàng ${customerName}`
          : 'Lịch chăm sóc khách hàng định kỳ'
      );
      setDueAt(tomorrow.toISOString().slice(0, 16));
      setAssignedTo('');
      setDescription('');
      setError('');
      setSuccessMessage('');
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [isOpen, customerId, customerName, initialSelectedCustomers]);

  // Search customers debounced
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsDropdownOpen(false);
      return;
    }

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await customerService.getCustomers({ search: searchQuery.trim(), pageSize: 8 });
        setSearchResults(
          (res.data || []).map((c) => ({
            id: c.id,
            fullName: c.fullName,
            phone: c.phone,
          }))
        );
        setIsDropdownOpen(true);
      } catch (err) {
        console.error('Error searching customers:', err);
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery]);

  if (!isOpen) return null;

  const handleAddCustomer = (c: SelectedCustomerItem) => {
    if (!selectedCustomers.some((item) => item.id === c.id)) {
      setSelectedCustomers([...selectedCustomers, c]);
    }
    setSearchQuery('');
    setIsDropdownOpen(false);
  };

  const handleRemoveCustomer = (id: string) => {
    setSelectedCustomers(selectedCustomers.filter((item) => item.id !== id));
  };

  const handleClearAllCustomers = () => {
    setSelectedCustomers([]);
  };

  const isPending = createFollowUp.isPending || createBulkFollowUp.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (selectedCustomers.length === 0) {
      setError('Vui lòng chọn ít nhất một khách hàng để lên lịch chăm sóc');
      return;
    }
    if (!title.trim()) {
      setError('Vui lòng nhập tiêu đề nhiệm vụ');
      return;
    }
    if (!dueAt) {
      setError('Vui lòng chọn ngày giờ hạn');
      return;
    }

    try {
      const dueIso = new Date(dueAt).toISOString();
      const caretakerVal = assignedTo || null;
      const descVal = description.trim() || null;

      if (selectedCustomers.length === 1) {
        await createFollowUp.mutateAsync({
          customerId: selectedCustomers[0].id,
          title: title.trim(),
          description: descVal,
          dueAt: dueIso,
          assignedTo: caretakerVal,
          status: 'PENDING',
        });
      } else {
        await createBulkFollowUp.mutateAsync({
          customerIds: selectedCustomers.map((c) => c.id),
          title: title.trim(),
          description: descVal,
          dueAt: dueIso,
          assignedTo: caretakerVal,
          status: 'PENDING',
        });
      }

      setSuccessMessage(`Đã lên lịch thành công cho ${selectedCustomers.length} khách hàng!`);
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      setError((err as Error).message || 'Không thể lên lịch chăm sóc');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-100">
      <div
        className="w-full max-w-lg rounded-lg border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">Lên lịch chăm sóc khách hàng</h3>
              <p className="text-[10px] text-slate-400">
                Lên lịch chăm sóc độc lập cho từng khách hàng hoặc đồng loạt cho nhiều khách hàng
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
          <div className="p-4 space-y-3.5 text-xs max-h-[78vh] overflow-y-auto">
            {error && (
              <div className="p-2.5 rounded bg-red-950/50 border border-red-800/60 text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-2.5 rounded bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Requirement 4.1: Chọn nhiều khách hàng */}
            <div className="space-y-1.5 bg-slate-950/60 p-2.5 rounded border border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-slate-200 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span>Khách hàng cần chăm sóc ({selectedCustomers.length})</span>
                  <span className="text-red-400">*</span>
                </label>
                {selectedCustomers.length > 1 && (
                  <button
                    type="button"
                    onClick={handleClearAllCustomers}
                    className="text-[10px] text-red-400 hover:text-red-300 underline cursor-pointer"
                  >
                    Bỏ chọn tất cả
                  </button>
                )}
              </div>

              {/* Selected Customer Badges */}
              {selectedCustomers.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-slate-900/60 rounded border border-slate-800/80">
                  {selectedCustomers.map((cust) => (
                    <span
                      key={cust.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-blue-950/80 border border-blue-800/60 text-blue-200"
                    >
                      <User className="w-2.5 h-2.5 text-blue-400" />
                      <span className="font-medium max-w-[120px] truncate">{cust.fullName}</span>
                      {cust.phone && (
                        <span className="text-[9px] font-mono text-slate-400">({cust.phone})</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveCustomer(cust.id)}
                        className="hover:text-red-400 ml-0.5 text-slate-400 p-0.5"
                        title="Bỏ khách hàng này"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-amber-400/90 italic">
                  Chưa có khách hàng nào được chọn. Vui lòng tìm kiếm bên dưới để thêm.
                </p>
              )}

              {/* Search to add more customers */}
              <div className="relative pt-1">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm thêm khách hàng theo tên hoặc số điện thoại..."
                    className="w-full h-8 pl-8 pr-3 bg-slate-900 border border-slate-800 rounded text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 text-xs"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                  {isSearching && (
                    <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin absolute right-2.5 top-2.5" />
                  )}
                </div>

                {/* Search Results Dropdown */}
                {isDropdownOpen && searchResults.length > 0 && (
                  <div className="absolute left-0 right-0 z-20 mt-1 max-h-40 overflow-y-auto rounded-md bg-slate-900 border border-slate-700 shadow-xl">
                    {searchResults.map((cust) => {
                      const isSelected = selectedCustomers.some((item) => item.id === cust.id);
                      return (
                        <div
                          key={cust.id}
                          onClick={() => !isSelected && handleAddCustomer(cust)}
                          className={`flex items-center justify-between px-3 py-1.5 cursor-pointer text-xs transition-colors ${
                            isSelected
                              ? 'bg-slate-800/40 text-slate-500 cursor-not-allowed'
                              : 'hover:bg-blue-600/20 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{cust.fullName}</span>
                            <span className="text-[10px] font-mono text-slate-400">{cust.phone}</span>
                          </div>
                          {isSelected ? (
                            <span className="text-[10px] text-blue-400 font-mono">Đã chọn</span>
                          ) : (
                            <span className="text-[10px] text-slate-400 hover:text-white">+ Thêm</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Tiêu đề nhiệm vụ / Mục tiêu chăm sóc <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Gọi điện tư vấn tiến độ hồ sơ hoặc chăm sóc tái tục"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Time & Caretaker */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Ngày giờ hẹn <span className="text-red-400">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Requirement 2 & 4.5: Người chăm sóc */}
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Người chăm sóc
                </label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  disabled={isCaretakersLoading}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-medium focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Chưa phân công --</option>
                  {caretakers && caretakers.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Hướng dẫn nhiệm vụ / Nội dung cần trao đổi
              </label>
              <textarea
                rows={3}
                placeholder="Nội dung kịch bản gọi, hồ sơ cần chuẩn bị hoặc lưu ý đặc thù..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
              />
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-between p-3 bg-slate-950/80 border-t border-slate-800">
            <span className="text-[11px] text-slate-400">
              Tổng số lịch sẽ tạo:{' '}
              <strong className="text-blue-400 font-mono font-bold">
                {selectedCustomers.length}
              </strong>
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                disabled={isPending}
                className="text-xs h-8"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isPending || selectedCustomers.length === 0}
                className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white font-medium gap-1.5"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {isPending
                    ? 'Đang lên lịch...'
                    : selectedCustomers.length > 1
                    ? `Lên lịch (${selectedCustomers.length} khách)`
                    : 'Lên lịch hẹn'}
                </span>
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleFollowUpModal;
