import React, { useState, useEffect } from 'react';
import { X, Link2, Unlink, AlertTriangle, CheckCircle2, ShieldAlert, UserCheck } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAvailablePartners, useLinkCaretaker, useUnlinkCaretaker } from '../../hooks/useCaretakers';
import { useToast } from '../../context/ToastContext';
import { Caretaker } from '../../types/models';

export interface LinkCaretakerModalProps {
  isOpen: boolean;
  onClose: () => void;
  caretaker: Caretaker | null;
  onSuccess?: () => void;
}

export const LinkCaretakerModal: React.FC<LinkCaretakerModalProps> = ({
  isOpen,
  onClose,
  caretaker,
  onSuccess,
}) => {
  const { data: partners, isLoading: isPartnersLoading } = useAvailablePartners();
  const linkCaretaker = useLinkCaretaker();
  const unlinkCaretaker = useUnlinkCaretaker();
  const { toast } = useToast();

  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isUnlinking, setIsUnlinking] = useState(false);

  useEffect(() => {
    if (caretaker) {
      setSelectedUserId(caretaker.userId || '');
      setError('');
      setIsUnlinking(false);
    }
  }, [caretaker, isOpen]);

  if (!isOpen || !caretaker) return null;

  const isPending = linkCaretaker.isPending || unlinkCaretaker.isPending;
  const isCurrentlyLinked = Boolean(caretaker.userId && caretaker.user);

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Vui lòng chọn tài khoản đối tác để liên kết');
      return;
    }

    try {
      await linkCaretaker.mutateAsync({
        caretakerId: caretaker.id,
        userId: selectedUserId,
      });

      const selectedPartner = partners?.find((p) => p.id === selectedUserId);
      toast.success(
        'Liên kết thành công',
        `Người chăm sóc "${caretaker.name}" đã được liên kết với tài khoản "${selectedPartner?.fullName || selectedUserId}".`
      );

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi liên kết tài khoản';
      setError(msg);
    }
  };

  const handleUnlinkConfirm = async () => {
    try {
      await unlinkCaretaker.mutateAsync(caretaker.id);
      toast.success(
        'Đã gỡ liên kết',
        `Đã gỡ liên kết tài khoản khỏi người chăm sóc "${caretaker.name}". Dữ liệu lịch sử vẫn được bảo toàn.`
      );
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi gỡ liên kết';
      setError(msg);
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
            <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">
                Liên kết tài khoản người chăm sóc
              </h3>
              <p className="text-[10px] text-slate-400">
                Chỉ định tài khoản PARTNER đại diện cho người chăm sóc &quot;{caretaker.name}&quot;
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

        {/* Form Body */}
        <form onSubmit={handleLinkSubmit}>
          <div className="p-4 space-y-4 text-xs">
            {error && (
              <div className="p-2.5 rounded bg-rose-950/50 border border-rose-800/60 text-rose-300 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Caretaker Info Card */}
            <div className="p-3 bg-slate-950/80 rounded border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Người chăm sóc:</span>
                <span className="font-semibold text-slate-200 text-sm font-mono">{caretaker.name}</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Trạng thái hiện tại:</span>
                {caretaker.active ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Đang hoạt động
                  </span>
                ) : (
                  <span className="text-slate-500 font-medium">Đã ngưng hoạt động</span>
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
                <span className="text-slate-400">Tài khoản liên kết hiện tại:</span>
                {isCurrentlyLinked ? (
                  <div className="text-right">
                    <span className="font-medium text-blue-300 block">{caretaker.user?.fullName}</span>
                    <span className="text-[10px] text-slate-400 font-mono block">{caretaker.user?.email}</span>
                  </div>
                ) : (
                  <span className="text-amber-400 italic">Chưa liên kết tài khoản nào</span>
                )}
              </div>
            </div>

            {/* Partner Selection Dropdown */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Chọn tài khoản đối tác (PARTNER) <span className="text-rose-400">*</span>
              </label>
              <select
                value={selectedUserId}
                onChange={(e) => {
                  setSelectedUserId(e.target.value);
                  setError('');
                }}
                disabled={isPartnersLoading || isPending}
                className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 font-medium focus:outline-none focus:border-blue-500"
              >
                <option value="">-- Chọn tài khoản đối tác --</option>
                {partners &&
                  partners.map((partner) => {
                    const isSuspended = partner.status !== 'ACTIVE';
                    const isAlreadyLinkedOther =
                      partner.isLinked && partner.linkedCaretaker?.id !== caretaker.id;

                    let label = `${partner.fullName} (${partner.email})`;
                    if (isSuspended) label += ` [Tài khoản bị khóa]`;
                    else if (isAlreadyLinkedOther)
                      label += ` [Đã liên kết với: ${partner.linkedCaretaker?.name}]`;

                    return (
                      <option
                        key={partner.id}
                        value={partner.id}
                        disabled={isSuspended || isAlreadyLinkedOther}
                      >
                        {label}
                      </option>
                    );
                  })}
              </select>
              <p className="mt-1 text-[10px] text-slate-500">
                Chỉ hiển thị các tài khoản có vai trò ĐỐI TÁC (PARTNER). Tài khoản ADMIN không xuất hiện tại đây.
              </p>
            </div>

            {/* Warning & Policy Notice */}
            <div className="p-3 rounded bg-blue-950/30 border border-blue-800/40 text-blue-200 text-[11px] space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-blue-300">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span>Quy tắc bảo vệ dữ liệu</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-300 text-[10px]">
                <li>Việc liên kết không tự động cấp quyền truy cập toàn bộ khách hàng cũ.</li>
                <li>Lịch chăm sóc tạo mới với người chăm sóc này sẽ đồng bộ quyền phụ trách cho đối tác tương ứng.</li>
                <li>Không làm mất lịch sử các nhiệm vụ và lịch chăm sóc trước đây.</li>
              </ul>
            </div>

            {/* Confirmation section if Unlinking */}
            {isUnlinking && (
              <div className="p-3 rounded bg-rose-950/40 border border-rose-800/60 text-rose-200 text-[11px] space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-rose-300">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Xác nhận gỡ liên kết tài khoản?</span>
                </div>
                <p className="text-[10px] text-rose-300/90 leading-relaxed">
                  Người chăm sóc &quot;{caretaker.name}&quot; sẽ trở về trạng thái chưa liên kết tài khoản.
                  Lịch sử chăm sóc đã tạo không bị xóa.
                </p>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setIsUnlinking(false)}
                    disabled={isPending}
                  >
                    Hủy bỏ
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-xs bg-rose-600 hover:bg-rose-500 text-white"
                    onClick={handleUnlinkConfirm}
                    disabled={isPending}
                  >
                    {isPending ? 'Đang gỡ...' : 'Đồng ý gỡ liên kết'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
            {isCurrentlyLinked && !isUnlinking ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-rose-400 border-rose-900/60 hover:bg-rose-950/50 hover:text-rose-300 text-xs h-8"
                onClick={() => setIsUnlinking(true)}
                disabled={isPending}
              >
                <Unlink className="w-3.5 h-3.5 mr-1" />
                Gỡ liên kết
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onClose}
                disabled={isPending}
                className="text-xs h-8"
              >
                Đóng
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8"
                disabled={isPending || !selectedUserId || selectedUserId === caretaker.userId}
              >
                <UserCheck className="w-3.5 h-3.5 mr-1" />
                {isPending ? 'Đang xử lý...' : isCurrentlyLinked ? 'Đổi liên kết' : 'Lưu liên kết'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LinkCaretakerModal;
