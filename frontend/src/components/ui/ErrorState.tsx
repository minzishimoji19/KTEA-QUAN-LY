import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Đã xảy ra sự cố dịch vụ',
  message,
  description,
  onRetry,
  className,
}) => {
  const displayMessage =
    description ||
    message ||
    'Không thể tải dữ liệu từ máy chủ. Vui lòng kiểm tra kết nối mạng hoặc cơ sở dữ liệu.';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 rounded-lg border border-red-900/40 bg-red-950/20 backdrop-blur-sm text-center max-w-lg mx-auto',
        className
      )}
    >
      <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-3 text-red-400">
        <AlertTriangle className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-red-200">{title}</h3>
      <p className="text-xs text-red-300/80 mt-1 max-w-sm">{displayMessage}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-red-900/40 hover:bg-red-800/50 text-red-200 border border-red-700/50 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Thử lại
        </button>
      )}
    </div>
  );
};

export default ErrorState;
