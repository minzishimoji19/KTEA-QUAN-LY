import React from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, CalendarPlus, Send, X, Info, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useAuth } from '../../context/AuthContext';

export interface QuickActionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickActionModal: React.FC<QuickActionModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { role } = useAuth();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 shadow-xl overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/40">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 font-mono">Thao tác nhanh</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Lối tắt tác vụ nhanh phục vụ vận hành hàng ngày
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action List */}
        <div className="p-4 space-y-2.5">
          {role === 'ADMIN' ? (
            <>
              <div
                onClick={() => {
                  onClose();
                  navigate('/customers');
                }}
                className="flex items-center justify-between p-3 rounded-md bg-slate-850 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/80 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-200">Đăng ký khách hàng mới</p>
                    <p className="text-[10px] text-slate-400">Mở danh bạ quản lý khách hàng</p>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  Danh bạ
                </Badge>
              </div>

              <div
                onClick={() => {
                  onClose();
                  navigate('/follow-ups');
                }}
                className="flex items-center justify-between p-3 rounded-md bg-slate-850 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/80 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <CalendarPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-200">Đặt lịch chăm sóc khách</p>
                    <p className="text-[10px] text-slate-400">Mở hàng đợi lịch chăm sóc</p>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  Lịch hẹn
                </Badge>
              </div>

              <div
                onClick={() => {
                  onClose();
                  navigate('/push');
                }}
                className="flex items-center justify-between p-3 rounded-md bg-slate-850 border border-slate-800 hover:border-purple-500/50 hover:bg-slate-800/80 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-200">Chuyển xử lý đề xuất</p>
                    <p className="text-[10px] text-slate-400">Mở trung tâm chuyển khách</p>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  Chuyển khách
                </Badge>
              </div>
            </>
          ) : (
            <>
              <div
                onClick={() => {
                  onClose();
                  navigate('/customers');
                }}
                className="flex items-center justify-between p-3 rounded-md bg-slate-850 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-800/80 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-200">Khách hàng của tôi</p>
                    <p className="text-[10px] text-slate-400">Danh sách khách hàng được phân công</p>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  Cá nhân
                </Badge>
              </div>

              <div
                onClick={() => {
                  onClose();
                  navigate('/follow-ups');
                }}
                className="flex items-center justify-between p-3 rounded-md bg-slate-850 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-800/80 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <CalendarPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-200">Lịch chăm sóc phân công</p>
                    <p className="text-[10px] text-slate-400">Xem và xử lý các lịch hẹn đến hạn</p>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">
                  Lịch hẹn
                </Badge>
              </div>
            </>
          )}

          <div className="p-2.5 rounded bg-slate-950/60 border border-slate-800/70 flex items-start gap-2 text-[11px] text-slate-400">
            <Info className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
            <span>
              {role === 'ADMIN'
                ? 'Tất cả thao tác nhanh đều đồng bộ trực tiếp với cơ sở dữ liệu và tự động cập nhật nhật ký hoạt động.'
                : 'Thao tác chỉ áp dụng cho danh sách khách hàng được Quản trị viên phân công cho bạn.'}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-3 bg-slate-950/60 border-t border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-7">
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuickActionModal;
