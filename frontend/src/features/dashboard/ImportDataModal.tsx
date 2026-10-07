import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { X, Upload, FileText, CheckCircle2, Download, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useCreateCustomer } from '../../hooks/useCustomers';
import { DASHBOARD_QUERY_KEY } from '../../hooks/useDashboard';

export interface ImportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedCustomer {
  fullName: string;
  phone: string;
  email?: string;
  overallStatus?: string;
  source?: string;
  isValid: boolean;
  error?: string;
}

interface FailureDetail {
  name: string;
  phone: string;
  reason: string;
}

const SAMPLE_CSV = `fullName,phone,email,overallStatus,source
Nguyen Van An,0901234567,an.nguyen@example.com,LEAD_MOI,Website
Tran Thi Bich,0912345678,bich.tran@example.com,DANG_TIEP_CAN,Referral
Le Hoang Minh,0987654321,minh.le@example.com,DANG_TU_VAN,Direct Outreach
Pham Duc Nam,0978123456,nam.pham@example.com,LEAD_MOI,Branch Walk-in`;

export const ImportDataModal: React.FC<ImportDataModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const createCustomer = useCreateCustomer();

  const [rawText, setRawText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedCustomer[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<{
    success: number;
    failed: number;
    cancelled?: boolean;
  } | null>(null);
  const [failedRows, setFailedRows] = useState<FailureDetail[]>([]);

  const isCancelledRef = React.useRef(false);

  if (!isOpen) return null;

  const handleParse = (text: string) => {
    setRawText(text);
    setResultMessage(null);
    setFailedRows([]);
    setFileError(null);
    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = text.trim().split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      setParsedRows([]);
      return;
    }

    // Check if first line is header
    const firstLine = lines[0].toLowerCase();
    const hasHeader = firstLine.includes('fullname') || firstLine.includes('phone') || firstLine.includes('name');
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const seenPhones = new Set<string>();

    const rows: ParsedCustomer[] = dataLines.map((line, idx) => {
      const parts = line.split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
      const fullName = parts[0] || '';
      const phone = parts[1] || '';
      const email = parts[2] || '';
      const overallStatus = parts[3] ? parts[3].toUpperCase() : 'LEAD_MOI';
      const source = parts[4] || 'Batch Import';

      const statusMap: Record<string, string> = {
        LEAD: 'LEAD_MOI',
        PROSPECT: 'DANG_TIEP_CAN',
        ACTIVE: 'DANG_TU_VAN',
        DORMANT: 'KHONG_KHA_THI',
        LOST: 'KHONG_KHA_THI',
        LEAD_MOI: 'LEAD_MOI',
        DANG_TIEP_CAN: 'DANG_TIEP_CAN',
        DANG_TU_VAN: 'DANG_TU_VAN',
        THANH_CONG: 'THANH_CONG',
        KHONG_KHA_THI: 'KHONG_KHA_THI',
      };
      const statusFinal = statusMap[overallStatus] || 'LEAD_MOI';

      if (!fullName) {
        return { fullName, phone, email, overallStatus: statusFinal, source, isValid: false, error: `Dòng ${idx + 1}: Thiếu họ tên` };
      }
      if (!phone || phone.length < 8) {
        return { fullName, phone, email, overallStatus: statusFinal, source, isValid: false, error: `Dòng ${idx + 1}: Yêu cầu số điện thoại hợp lệ (tối thiểu 8 số)` };
      }

      const cleanPhone = phone.replace(/[\s-]/g, '');
      if (seenPhones.has(cleanPhone)) {
        return { fullName, phone, email, overallStatus: statusFinal, source, isValid: false, error: `Dòng ${idx + 1}: Trùng số điện thoại trong tệp (${cleanPhone})` };
      }
      seenPhones.add(cleanPhone);

      return {
        fullName,
        phone,
        email: email || undefined,
        overallStatus: statusFinal,
        source,
        isValid: true,
      };
    });

    setParsedRows(rows);
  };

  const handleLoadSample = () => {
    handleParse(SAMPLE_CSV);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Security & sanity checks: validate file type and size
    if (file.size > 5 * 1024 * 1024) {
      setFileError('Tệp vượt quá kích thước cho phép tối đa (5MB). Vui lòng tải lên tệp nhỏ hơn.');
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setFileError('Không thể đọc tệp đã chọn. Vui lòng đảm bảo đây là tệp văn bản/CSV hợp lệ.');
    };
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        handleParse(content);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = async () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) return;

    isCancelledRef.current = false;
    setIsProcessing(true);
    setResultMessage(null);
    setFailedRows([]);

    let successCount = 0;
    const failures: FailureDetail[] = [];

    for (let i = 0; i < validRows.length; i++) {
      if (isCancelledRef.current) {
        break;
      }
      const row = validRows[i];
      try {
        await createCustomer.mutateAsync({
          fullName: row.fullName,
          phone: row.phone,
          email: row.email || null,
          overallStatus: row.overallStatus as any,
          source: row.source || 'Nhập hàng loạt',
        });
        successCount++;
      } catch (err: any) {
        const reason =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'Nhập thất bại';
        failures.push({
          name: row.fullName,
          phone: row.phone,
          reason,
        });
      }
    }

    const wasCancelled = isCancelledRef.current;
    setIsProcessing(false);
    setFailedRows(failures);
    setResultMessage({
      success: successCount,
      failed: failures.length,
      cancelled: wasCancelled,
    });

    queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: ['customers'] });
  };

  const handleCancelImport = () => {
    if (isProcessing) {
      isCancelledRef.current = true;
    } else {
      onClose();
    }
  };

  const handleModalClose = () => {
    if (isProcessing) {
      isCancelledRef.current = true;
    }
    onClose();
  };

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const invalidCount = parsedRows.filter((r) => !r.isValid).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2 text-slate-100">
            <Upload className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="font-semibold text-base font-mono">Nhập danh bạ khách hàng</h3>
              <p className="text-[11px] text-slate-400">
                Nạp hàng loạt khách hàng qua tệp CSV hoặc dán văn bản
              </p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          {/* File Upload Error Banner */}
          {fileError && (
            <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-lg text-xs text-rose-300">
              {fileError}
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-slate-800 bg-slate-950/60">
            <div className="flex items-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-200 transition-colors">
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>Tải tệp CSV lên</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isProcessing}
                />
              </label>
              <button
                type="button"
                onClick={handleLoadSample}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs text-slate-300 transition-colors disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Nạp dữ liệu mẫu</span>
              </button>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              Định dạng: Họ tên, Số điện thoại, Email, Trạng thái, Nguồn
            </span>
          </div>

          {/* Paste Input Area */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Dán dữ liệu CSV (ngăn cách bởi dấu phẩy):
            </label>
            <textarea
              rows={5}
              disabled={isProcessing}
              placeholder="Nguyen Van An, 0901234567, an.nguyen@example.com, LEAD, Website..."
              value={rawText}
              onChange={(e) => handleParse(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
          </div>

          {/* Validation & Preview Summary */}
          {parsedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium">Dữ liệu phân tích ({parsedRows.length})</span>
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="text-emerald-400">✓ {validCount} hợp lệ</span>
                  {invalidCount > 0 && <span className="text-rose-400">✗ {invalidCount} không hợp lệ</span>}
                </div>
              </div>

              {/* Table Preview */}
              <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-lg bg-slate-950/80">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 font-mono text-[10px] sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="p-2">Họ và tên</th>
                      <th className="p-2">Số điện thoại</th>
                      <th className="p-2">Trạng thái</th>
                      <th className="p-2">Nguồn</th>
                      <th className="p-2 text-right">Đánh giá</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                    {parsedRows.slice(0, 10).map((r, idx) => (
                      <tr key={idx} className={r.isValid ? 'text-slate-300' : 'text-rose-300 bg-rose-950/20'}>
                        <td className="p-2 font-sans font-medium">{r.fullName || '—'}</td>
                        <td className="p-2">{r.phone || '—'}</td>
                        <td className="p-2">{r.overallStatus}</td>
                        <td className="p-2 text-slate-400">{r.source}</td>
                        <td className="p-2 text-right">
                          {r.isValid ? (
                            <span className="text-emerald-400">Sẵn sàng</span>
                          ) : (
                            <span className="text-rose-400 text-[10px]">{r.error}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedRows.length > 10 && (
                  <div className="p-2 text-[10px] text-center text-slate-500 font-mono bg-slate-900/50">
                    + {parsedRows.length - 10} khách hàng khác sẵn sàng
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Import Result Notification */}
          {resultMessage && (
            <div className="space-y-2">
              <div
                className={`p-3 rounded-lg flex items-center justify-between text-xs ${
                  resultMessage.failed > 0 || resultMessage.cancelled
                    ? 'bg-amber-950/40 border border-amber-900/60 text-amber-300'
                    : 'bg-emerald-950/40 border border-emerald-900/60 text-emerald-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className={`w-4 h-4 flex-shrink-0 ${
                      resultMessage.failed > 0 || resultMessage.cancelled
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  />
                  <span>
                    Đã nhập thành công <strong>{resultMessage.success}</strong> khách hàng!
                    {resultMessage.failed > 0 && ` (${resultMessage.failed} bản ghi lỗi)`}
                    {resultMessage.cancelled && ' [Tiến trình đã bị người dùng hủy]'}
                  </span>
                </div>
                <Button variant="ghost" size="sm" onClick={onClose} className="h-6 text-xs text-slate-300">
                  Hoàn tất
                </Button>
              </div>

              {/* Partial Failures Details */}
              {failedRows.length > 0 && (
                <div className="p-3 bg-rose-950/30 border border-rose-900/50 rounded-lg space-y-1.5">
                  <div className="text-[11px] font-semibold text-rose-300">
                    Chi tiết bản ghi lỗi ({failedRows.length}):
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 font-mono text-[10px]">
                    {failedRows.map((fail, idx) => (
                      <div key={idx} className="flex items-center justify-between text-rose-200/90 py-0.5 border-b border-rose-900/30 last:border-0">
                        <span>{fail.name} ({fail.phone})</span>
                        <span className="text-rose-400 truncate max-w-[250px]">{fail.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={isProcessing ? handleCancelImport : handleModalClose}
            className={isProcessing ? 'border-amber-700/60 text-amber-300 hover:bg-amber-950/40' : ''}
          >
            {isProcessing ? 'Hủy nhập' : 'Đóng'}
          </Button>

          <Button
            variant="primary"
            size="sm"
            type="button"
            disabled={isProcessing || validCount === 0}
            onClick={handleExecuteImport}
            className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5"
          >
            <span>{isProcessing ? 'Đang nhập...' : `Nhập ${validCount} khách hàng`}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImportDataModal;
