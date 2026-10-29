/**
 * AkinatorSessionsWorkspace.tsx
 *
 * Dedicated Admin Workspace for managing, searching, filtering, and processing
 * completed Akinator quiz sessions:
 * - High-level operational stats cards
 * - Search by Customer name, phone, email (raw & edited)
 * - Filtering by Workflow status, Evaluation status, and Date range
 * - Paginated responsive data table
 * - Click-to-open session detail & processing modal
 *
 * Strict boundary:
 * - Data is fetched 100% from backend API (no mock data).
 * - Transfer to CRM Customers is NOT available in this phase.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  AlertCircle,
  Eye,
  X,
} from 'lucide-react';
import { akinatorAdminApi } from '../../services/akinatorService';
import {
  AkinatorSessionListItem,
  AkinatorWorkflowStatus,
  AkinatorEvaluationStatus,
  AkinatorSessionListFilter,
} from '../../types/akinator';
import { formatDateTime } from '../../utils/formatters';
import { AkinatorSessionDetailModal } from './AkinatorSessionDetailModal';

const WORKFLOW_STATUS_CONFIG: Record<
  AkinatorWorkflowStatus,
  { label: string; badgeClass: string }
> = {
  PENDING_PROCESSING: {
    label: 'Chờ xử lý',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  IN_PROGRESS: {
    label: 'Đang xử lý',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  },
  NEEDS_MORE_INFO: {
    label: 'Cần bổ sung',
    badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  },
  PENDING_APPROVAL: {
    label: 'Chờ duyệt',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  },
  APPROVED: {
    label: 'Đã duyệt',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
  TRANSFERRED: {
    label: 'Đã chuyển CRM',
    badgeClass: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
  },
  REJECTED: {
    label: 'Từ chối',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  },
};

export const AkinatorSessionsWorkspace: React.FC = () => {
  const [sessions, setSessions] = useState<AkinatorSessionListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [totalItems, setTotalItems] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filter & Search states
  const [searchInput, setSearchInput] = useState<string>('');
  const [selectedWorkflowStatus, setSelectedWorkflowStatus] = useState<string>('ALL');
  const [selectedEvalStatus, setSelectedEvalStatus] = useState<string>('ALL');
  const [fromDateInput, setFromDateInput] = useState<string>('');
  const [toDateInput, setToDateInput] = useState<string>('');

  // Selected session for Detail Modal
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const filter: AkinatorSessionListFilter = {
        page: currentPage,
        pageSize,
        quizStatus: 'COMPLETED',
      };

      if (searchInput.trim()) {
        filter.search = searchInput.trim();
      }
      if (selectedWorkflowStatus !== 'ALL') {
        filter.workflowStatus = selectedWorkflowStatus as AkinatorWorkflowStatus;
      }
      if (selectedEvalStatus !== 'ALL') {
        filter.evaluationStatus = selectedEvalStatus as AkinatorEvaluationStatus;
      }
      if (fromDateInput.trim()) {
        filter.fromDate = fromDateInput.trim();
      }
      if (toDateInput.trim()) {
        filter.toDate = toDateInput.trim();
      }

      const res = await akinatorAdminApi.listSessions(filter);
      setSessions(res.items || []);
      setTotalItems(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách hồ sơ Akinator');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, searchInput, selectedWorkflowStatus, selectedEvalStatus, fromDateInput, toDateInput]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchSessions();
  };

  const handleResetFilters = () => {
    setSearchInput('');
    setSelectedWorkflowStatus('ALL');
    setSelectedEvalStatus('ALL');
    setFromDateInput('');
    setToDateInput('');
    setCurrentPage(1);
  };

  const handleOpenDetail = (id: string) => {
    setActiveSessionId(id);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetail = () => {
    setIsDetailModalOpen(false);
    setActiveSessionId(null);
  };

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Compute stat counters from current items (for visual feedback)
  const stats = {
    pendingProcessing: sessions.filter((s) => s.workflowStatus === 'PENDING_PROCESSING').length,
    inProgress: sessions.filter((s) => s.workflowStatus === 'IN_PROGRESS').length,
    needsMoreInfo: sessions.filter((s) => s.workflowStatus === 'NEEDS_MORE_INFO').length,
    pendingApproval: sessions.filter((s) => s.workflowStatus === 'PENDING_APPROVAL').length,
    approved: sessions.filter((s) => s.workflowStatus === 'APPROVED').length,
    rejected: sessions.filter((s) => s.workflowStatus === 'REJECTED').length,
  };

  return (
    <div className="space-y-6">
      {/* Top Operational Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 block truncate">
            Chờ tiếp nhận
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-amber-400">
              {stats.pendingProcessing}
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 block truncate">
            Đang tư vấn / xử lý
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-blue-400">
              {stats.inProgress}
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 block truncate">
            Cần bổ sung
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-orange-400">
              {stats.needsMoreInfo}
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 block truncate">
            Chờ phê duyệt
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-purple-400">
              {stats.pendingApproval}
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 block truncate">
            Đã duyệt
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-emerald-400">
              {stats.approved}
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
          <span className="text-[11px] font-medium text-slate-400 block truncate">
            Từ chối
          </span>
          <div className="flex items-center justify-between">
            <span className="text-xl font-bold font-mono text-rose-400">
              {stats.rejected}
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Tìm theo Tên khách, Số điện thoại hoặc Email..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Workflow Status Filter */}
          <div className="w-full sm:w-48">
            <select
              value={selectedWorkflowStatus}
              onChange={(e) => {
                setSelectedWorkflowStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Tất cả trạng thái xử lý</option>
              <option value="PENDING_PROCESSING">Chờ xử lý</option>
              <option value="IN_PROGRESS">Đang xử lý</option>
              <option value="NEEDS_MORE_INFO">Cần bổ sung</option>
              <option value="PENDING_APPROVAL">Chờ duyệt</option>
              <option value="APPROVED">Đã duyệt</option>
              <option value="TRANSFERRED">Đã chuyển CRM</option>
              <option value="REJECTED">Từ chối</option>
            </select>
          </div>

          {/* Evaluation Status Filter */}
          <div className="w-full sm:w-44">
            <select
              value={selectedEvalStatus}
              onChange={(e) => {
                setSelectedEvalStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Tất cả kết quả sơ bộ</option>
              <option value="EVALUATED">Đã có kết quả</option>
              <option value="INSUFFICIENT_DATA">Chưa đủ dữ liệu</option>
            </select>
          </div>

          {/* Date Range Inputs */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={fromDateInput}
              onChange={(e) => setFromDateInput(e.target.value)}
              placeholder="Từ ngày (dd/MM/yyyy)"
              className="w-32 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />
            <span className="text-slate-500 text-xs">-</span>
            <input
              type="text"
              value={toDateInput}
              onChange={(e) => setToDateInput(e.target.value)}
              placeholder="Đến ngày (dd/MM/yyyy)"
              className="w-32 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-md shadow-blue-600/20 transition-colors"
            >
              Lọc
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
              title="Đặt lại bộ lọc"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Main Table Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        {isLoading && sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 text-slate-400 space-y-3">
            <RotateCcw className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-xs">Đang tải danh sách hồ sơ Akinator...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-semibold text-rose-300">Không thể tải dữ liệu</p>
            <p className="text-xs text-rose-400">{error}</p>
            <button
              type="button"
              onClick={fetchSessions}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-medium"
            >
              Thử lại
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-12 text-center space-y-3 text-slate-400">
            <FileText className="w-10 h-10 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-300">Không tìm thấy hồ sơ Akinator nào</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Chưa có phiên quiz nào hoàn thành khớp với bộ lọc tìm kiếm hiện tại.
            </p>
            {(searchInput || selectedWorkflowStatus !== 'ALL' || selectedEvalStatus !== 'ALL') && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Xóa toàn bộ bộ lọc
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Mã hồ sơ</th>
                  <th className="py-3.5 px-4">Khách hàng / Liên hệ</th>
                  <th className="py-3.5 px-4">Hoàn tất lúc</th>
                  <th className="py-3.5 px-4 text-center">Bộ câu hỏi</th>
                  <th className="py-3.5 px-4 text-center">Số câu</th>
                  <th className="py-3.5 px-4">Kết quả sơ bộ</th>
                  <th className="py-3.5 px-4">Trạng thái xử lý</th>
                  <th className="py-3.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sessions.map((s) => {
                  const effectiveName = s.adminReview?.editedFullName || s.rawFullName;
                  const isNameEdited =
                    s.adminReview?.editedFullName &&
                    s.adminReview.editedFullName !== s.rawFullName;
                  const effectivePhone = s.adminReview?.editedPhone || s.rawPhone;

                  return (
                    <tr
                      key={s.id}
                      onClick={() => handleOpenDetail(s.id)}
                      className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                    >
                      {/* Short ID */}
                      <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="group-hover:text-blue-400 transition-colors">
                            {s.id.slice(0, 8)}...
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleCopyId(e, s.id)}
                            className="text-slate-600 hover:text-slate-300 p-1"
                            title="Sao chép toàn bộ ID"
                          >
                            {copiedId === s.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Customer / Contact */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-100">
                              {effectiveName || (
                                <span className="text-slate-500 italic">Chưa có tên</span>
                              )}
                            </span>
                            {isNameEdited && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-blue-400"
                                title="Đã được Admin chuẩn hóa"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400">
                            {effectivePhone && (
                              <span className="font-mono">{effectivePhone}</span>
                            )}
                            {s.adminReview?.editedEmail && (
                              <span className="text-slate-500 truncate max-w-[140px]">
                                {s.adminReview.editedEmail}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Completed At */}
                      <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                        {formatDateTime(s.completedAt)}
                      </td>

                      {/* Config Version */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                          v{s.configVersion.versionNumber}
                        </span>
                      </td>

                      {/* Answer count */}
                      <td className="py-3.5 px-4 text-center font-mono text-slate-300 whitespace-nowrap">
                        {s._count?.rawAnswers ?? '--'}
                      </td>

                      {/* Preliminary Result */}
                      <td className="py-3.5 px-4 max-w-xs">
                        {s.result ? (
                          <div className="space-y-0.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-semibold border ${
                                s.result.evaluationStatus === 'EVALUATED'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              }`}
                            >
                              {s.result.evaluationStatus === 'EVALUATED'
                                ? 'Có kết quả'
                                : 'Thiếu dữ liệu'}
                            </span>
                            <div className="text-[11px] font-medium text-slate-300 truncate">
                              {s.result.summaryTitle}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic text-[11px]">Chưa đánh giá</span>
                        )}
                      </td>

                      {/* Workflow Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {s.workflowStatus ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              WORKFLOW_STATUS_CONFIG[s.workflowStatus]?.badgeClass ||
                              'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {WORKFLOW_STATUS_CONFIG[s.workflowStatus]?.label || s.workflowStatus}
                          </span>
                        ) : (
                          <span className="text-slate-500">--</span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(s.id);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 transition-all font-medium text-xs flex items-center gap-1.5 ml-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalItems > 0 && (
          <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>Hiển thị</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-200"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span>
                hồ sơ trên tổng số <strong className="text-slate-200">{totalItems}</strong> hồ sơ
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="mr-2">
                Trang <strong className="text-slate-200">{currentPage}</strong> / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isLoading}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-slate-800"
                title="Trang trước"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || isLoading}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 border border-slate-800"
                title="Trang sau"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Session Detail Modal */}
      <AkinatorSessionDetailModal
        sessionId={activeSessionId}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetail}
        onSessionUpdated={fetchSessions}
      />
    </div>
  );
};
