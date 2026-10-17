import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  ExternalLink,
  Trash2,
  Layers,
  CalendarCheck,
  AlertTriangle,
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import {
  PageHeader,
  FilterBar,
  SearchInput,
  DataTable,
  Column,
  StatusBadge,
  TagBadge,
  DateDisplay,
  Pagination,
  ErrorState,
} from '../components/common';
import { Button } from '../components/ui/Button';
import { useCustomers, useBulkAction } from '../hooks/useCustomers';
import { useProducts } from '../hooks/useProducts';
import { useTags } from '../hooks/useTags';
import { useCustomerSources } from '../hooks/useCustomerSources';
import { CustomerSummary, CustomerStatus, PriorityLevel, BulkActionResult } from '../types/models';
import { CreateCustomerModal } from '../features/customers/CreateCustomerModal';
import { ScheduleFollowUpModal } from '../features/customers/ScheduleFollowUpModal';

interface CopyPhoneButtonProps {
  phone?: string | null;
}

const CopyPhoneButton: React.FC<CopyPhoneButtonProps> = ({ phone }) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const phoneStr = typeof phone === 'string' ? phone.trim() : String(phone || '').trim();
  const hasPhone = phoneStr.length > 0;

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();

    if (!hasPhone) {
      toast.warning('Không có số điện thoại để copy');
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(phoneStr);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = phoneStr;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        if (!successful) throw new Error('execCommand copy failed');
      }

      setCopied(true);
      toast.success(`Đã copy số điện thoại ${phoneStr}`);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Lỗi sao chép', 'Không thể truy cập bộ nhớ tạm hoặc trình duyệt chặn quyền clipboard.');
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={!hasPhone}
      title={hasPhone ? `Copy ${phoneStr}` : 'Chưa có số điện thoại để copy'}
      aria-label={hasPhone ? `Copy số điện thoại ${phoneStr}` : 'Chưa có số điện thoại'}
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono transition-all border shrink-0 select-none cursor-pointer',
        copied
          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/80 font-medium'
          : hasPhone
          ? 'bg-slate-800/90 hover:bg-slate-700 active:scale-95 text-slate-300 hover:text-white border-slate-700 hover:border-slate-500 shadow-xs'
          : 'opacity-40 cursor-not-allowed bg-slate-900/60 text-slate-600 border-slate-800'
      )}
    >
      {copied ? (
        <>
          <Check className="w-2.5 h-2.5 text-emerald-400" />
          <span>Đã copy</span>
        </>
      ) : (
        <>
          <Copy className="w-2.5 h-2.5 text-slate-400 group-hover:text-slate-200" />
          <span>Copy</span>
        </>
      )}
    </button>
  );
};

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();

  // Queries for filter options
  const { data: products } = useProducts();
  const { data: tags } = useTags();
  const { data: sources } = useCustomerSources();

  // Direct source of truth from URL query params
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const priority = searchParams.get('priority') || '';
  const sourceId = searchParams.get('sourceId') || searchParams.get('source') || '';
  const product = searchParams.get('product') || '';
  const tag = searchParams.get('tag') || '';
  const startDate = searchParams.get('startDate') || '';
  const endDate = searchParams.get('endDate') || '';
  const page = Number(searchParams.get('page')) || 1;
  const pageSize = Number(searchParams.get('pageSize')) || 10;
  const sortBy = searchParams.get('sortBy') || 'createdAt';
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

  // Local state for instant typing responsiveness
  const [searchTerm, setSearchTerm] = useState(search);

  // Quick create modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Bulk action selection state
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [bulkPriority, setBulkPriority] = useState<string>('');
  const [bulkTagId, setBulkTagId] = useState<string>('');
  const [bulkNotification, setBulkNotification] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
    details?: Array<{ id: string; name?: string; reason: string }>;
  } | null>(null);

  // Requirement 1 & 4 Modals State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isAssignSourceModalOpen, setIsAssignSourceModalOpen] = useState(false);
  const [selectedBulkSourceId, setSelectedBulkSourceId] = useState('');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  const bulkAction = useBulkAction();

  // Sync local search term if URL changes externally
  useEffect(() => {
    setSearchTerm(search);
  }, [search]);

  // Central filter update helper
  const updateFilters = (updates: Record<string, string | number | undefined | null>) => {
    const nextParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, val]) => {
      if (val === undefined || val === null || val === '' || (key === 'page' && val === 1)) {
        nextParams.delete(key);
      } else {
        nextParams.set(key, String(val));
      }
    });
    setSearchParams(nextParams, { replace: true });
  };

  // Query customers with TanStack Query
  const { data, isLoading, isError, refetch } = useCustomers({
    page,
    pageSize,
    search: search.trim() || undefined,
    status: status || undefined,
    priority: priority || undefined,
    sourceId: sourceId || undefined,
    product: product || undefined,
    tag: tag || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    sortBy,
    sortOrder,
  });

  const customers = data?.data || [];

  const pagination = data?.pagination || {
    page: 1,
    pageSize,
    total: 0,
    totalPages: 1,
  };

  const selectedSource = sources?.find((s) => s.id === sourceId);

  const activeFilterCount = [
    Boolean(search.trim()),
    Boolean(status),
    Boolean(priority),
    Boolean(sourceId),
    Boolean(product),
    Boolean(tag),
    Boolean(startDate),
    Boolean(endDate),
  ].filter(Boolean).length;

  const handleResetFilters = () => {
    setSearchTerm('');
    setSearchParams({}, { replace: true });
  };

  const handleSort = (key: string) => {
    if (sortBy === key) {
      updateFilters({ sortOrder: sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      updateFilters({ sortBy: key, sortOrder: 'asc' });
    }
  };

  // Bulk status update
  const handleApplyBulkStatus = async () => {
    if (!bulkStatus || selectedCustomerIds.length === 0) return;
    try {
      const res = await bulkAction.mutateAsync({
        action: 'UPDATE_STATUS',
        customerIds: selectedCustomerIds,
        payload: { status: bulkStatus as CustomerStatus },
      });
      setBulkNotification({
        type: 'success',
        message: `Đã cập nhật trạng thái cho ${res.affected} khách hàng thành công.`,
      });
      setSelectedCustomerIds([]);
      setBulkStatus('');
    } catch (err: any) {
      setBulkNotification({
        type: 'error',
        message: err.message || 'Không thể cập nhật trạng thái hàng loạt.',
      });
    }
  };

  // Bulk priority update
  const handleApplyBulkPriority = async () => {
    if (!bulkPriority || selectedCustomerIds.length === 0) return;
    try {
      const res = await bulkAction.mutateAsync({
        action: 'UPDATE_PRIORITY',
        customerIds: selectedCustomerIds,
        payload: { priority: bulkPriority as PriorityLevel },
      });
      setBulkNotification({
        type: 'success',
        message: `Đã cập nhật nhu cầu cho ${res.affected} khách hàng thành công.`,
      });
      setSelectedCustomerIds([]);
      setBulkPriority('');
    } catch (err: any) {
      setBulkNotification({
        type: 'error',
        message: err.message || 'Không thể cập nhật nhu cầu hàng loạt.',
      });
    }
  };

  // Bulk tag assignment
  const handleApplyBulkTag = async () => {
    if (!bulkTagId || selectedCustomerIds.length === 0) return;
    try {
      const res = await bulkAction.mutateAsync({
        action: 'ADD_TAG',
        customerIds: selectedCustomerIds,
        payload: { tagId: bulkTagId },
      });
      setBulkNotification({
        type: 'success',
        message: `Đã gắn nhãn cho ${res.affected} khách hàng thành công.`,
      });
      setSelectedCustomerIds([]);
      setBulkTagId('');
    } catch (err: any) {
      setBulkNotification({
        type: 'error',
        message: err.message || 'Không thể gắn nhãn hàng loạt.',
      });
    }
  };

  // Requirement 1.3: Gán nguồn khách hàng hàng loạt
  const handleConfirmAssignSource = async () => {
    if (!selectedBulkSourceId || selectedCustomerIds.length === 0) return;
    try {
      const res = await bulkAction.mutateAsync({
        action: 'ASSIGN_SOURCE',
        customerIds: selectedCustomerIds,
        payload: { sourceId: selectedBulkSourceId },
      });
      setBulkNotification({
        type: 'success',
        message: `Đã gán nguồn cho ${res.affected} khách hàng thành công.`,
      });
      setSelectedCustomerIds([]);
      setIsAssignSourceModalOpen(false);
      setSelectedBulkSourceId('');
    } catch (err: any) {
      setBulkNotification({
        type: 'error',
        message: err.message || 'Không thể gán nguồn khách hàng hàng loạt.',
      });
    }
  };

  // Requirement 1.2: Xóa khách hàng đã chọn hàng loạt (có bảo vệ dữ liệu)
  const handleConfirmBulkDelete = async () => {
    if (selectedCustomerIds.length === 0) return;
    try {
      const res = (await bulkAction.mutateAsync({
        action: 'DELETE_CUSTOMERS',
        customerIds: selectedCustomerIds,
        payload: {},
      })) as BulkActionResult;

      if (res.failedCount && res.failedCount > 0) {
        setBulkNotification({
          type: res.affected > 0 ? 'warning' : 'error',
          message: `Đã xóa thành công ${res.affected} khách hàng. Có ${res.failedCount} khách hàng không thể xóa vì có dữ liệu liên quan (hồ sơ vay, ghi chú hoặc lịch chăm sóc).`,
          details: res.failedDetails,
        });
      } else {
        setBulkNotification({
          type: 'success',
          message: `Đã xóa thành công toàn bộ ${res.affected} khách hàng đã chọn.`,
        });
      }

      setSelectedCustomerIds([]);
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      setBulkNotification({
        type: 'error',
        message: err.message || 'Đã xảy ra lỗi khi thực hiện xóa hàng loạt.',
      });
      setIsDeleteModalOpen(false);
    }
  };

  // Phân biệt rõ chọn trong trang hiện tại và chọn xuyên nhiều trang
  const pageCustomerIds = customers.map((c) => c.id);
  const selectedOnCurrentPage = pageCustomerIds.filter((id) => selectedCustomerIds.includes(id));
  const isAllPageSelected =
    customers.length > 0 && selectedOnCurrentPage.length === customers.length;

  const handleToggleSelectAllPage = () => {
    if (isAllPageSelected) {
      // Bỏ chọn các khách hàng trên trang hiện tại
      setSelectedCustomerIds(selectedCustomerIds.filter((id) => !pageCustomerIds.includes(id)));
    } else {
      // Chọn tất cả khách hàng trên trang này
      const nextSelection = Array.from(new Set([...selectedCustomerIds, ...pageCustomerIds]));
      setSelectedCustomerIds(nextSelection);
    }
  };

  const handleToggleSelectCustomer = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedCustomerIds.includes(id)) {
      setSelectedCustomerIds(selectedCustomerIds.filter((selectedId) => selectedId !== id));
    } else {
      setSelectedCustomerIds([...selectedCustomerIds, id]);
    }
  };

  // Table Columns
  const columns: Column<CustomerSummary>[] = [
    ...(role !== 'PARTNER'
      ? [
          {
            key: 'select',
            header: (
              <input
                type="checkbox"
                checked={isAllPageSelected}
                onChange={handleToggleSelectAllPage}
                className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                title="Chọn / bỏ chọn tất cả khách hàng trên trang này"
              />
            ),
            width: '36px',
            align: 'center' as const,
            render: (row: CustomerSummary) => (
              <input
                type="checkbox"
                checked={selectedCustomerIds.includes(row.id)}
                onClick={(e) => handleToggleSelectCustomer(row.id, e)}
                onChange={() => {}}
                className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
              />
            ),
          },
        ]
      : []),
    {
      key: 'fullName',
      header: 'Khách hàng',
      sortable: true,
      width: '180px',
      render: (row) => (
        <div className="flex flex-col min-w-0 py-0.5">
          <span className="font-semibold text-slate-100 hover:text-blue-400 transition-colors truncate">
            {row.fullName}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            {row.customerTags && row.customerTags.length > 0 && (
              <div className="flex items-center gap-1">
                {row.customerTags.slice(0, 1).map((ct) => (
                  <TagBadge
                    key={ct.tag.id}
                    name={ct.tag.name}
                    color={ct.tag.color}
                    className="text-[9px] py-0 px-1 leading-tight"
                  />
                ))}
                {row.customerTags.length > 1 && (
                  <span className="text-[9px] text-slate-500 font-mono">
                    +{row.customerTags.length - 1}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Số điện thoại',
      width: '160px',
      render: (row) => (
        <div className="flex items-center gap-1.5 whitespace-nowrap min-w-0 py-0.5">
          <span className="text-xs text-slate-200 font-mono font-medium tracking-tight select-all">
            {row.phone || '--'}
          </span>
          <CopyPhoneButton phone={row.phone} />
        </div>
      ),
    },
    {
      key: 'source',
      header: 'Nguồn khách',
      width: '130px',
      render: (row) => {
        const sourceName = row.customerSource?.name || row.source || 'Tự nhiên';
        const isInactive = row.customerSource && row.customerSource.active === false;
        return (
          <div className="flex items-center gap-1 max-w-[125px]">
            <span className="text-xs text-slate-200 font-medium truncate" title={sourceName}>
              {sourceName}
            </span>
            {isInactive && (
              <span
                className="text-[9px] font-mono px-1 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0"
                title="Nguồn khách này hiện đã ngưng hoạt động"
              >
                Inactive
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'overallStatus',
      header: 'Trạng thái',
      sortable: true,
      width: '120px',
      render: (row) => <StatusBadge status={row.overallStatus} />,
    },
    {
      key: 'priority',
      header: 'Nhu cầu / Ưu tiên',
      width: '130px',
      render: (row) => {
        if (!row.priority || row.priority === 'CHUA_CO_NHU_CAU') {
          return <span className="text-slate-500 font-sans text-xs">Chưa có nhu cầu</span>;
        }
        if (row.priority === 'THANH_KHOAN') {
          return (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold bg-blue-950/60 text-blue-300 border border-blue-800/40">
              Thanh khoản
            </span>
          );
        }
        if (row.priority === 'TIN_DUNG') {
          return (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/40">
              Tín dụng
            </span>
          );
        }
        return (
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold bg-purple-950/80 text-purple-300 border border-purple-800/60">
            Thanh khoản & Tín dụng
          </span>
        );
      },
    },
    {
      key: 'casesCount',
      header: 'Số hồ sơ',
      width: '90px',
      align: 'center',
      render: (row) => {
        const count = row._count?.cases ?? (row.cases?.length || 0);
        return (
          <span
            className={`inline-flex items-center justify-center font-mono text-xs px-2 py-0.5 rounded-full border ${
              count > 0
                ? 'bg-purple-950/60 text-purple-300 border-purple-800/50 font-semibold'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            {count}
          </span>
        );
      },
    },
    {
      key: 'latestCase',
      header: 'Hồ sơ gần nhất',
      width: '190px',
      render: (row) => {
        const latestCase = row.cases?.[0];
        if (!latestCase) {
          return <span className="text-slate-600 font-mono text-[11px]">Chưa có hồ sơ</span>;
        }
        return (
          <div className="flex flex-col min-w-0 py-0.5">
            <span className="text-xs font-semibold text-slate-200 truncate">
              {latestCase.product?.name || 'Chưa chọn sản phẩm'}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <StatusBadge status={latestCase.caseStatus} className="text-[10px] py-0 px-1.5" />
              {latestCase.progress && latestCase.progress !== 'NOT_SELECTED' && (
                <span className="text-[10px] font-mono text-slate-400 truncate">
                  ({latestCase.progress})
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'careCount',
      header: 'Số lần chăm sóc',
      width: '130px',
      align: 'center',
      render: (row) => {
        const count = row.careCount ?? 0;
        return (
          <span
            className={`inline-flex items-center justify-center font-mono text-xs px-2.5 py-0.5 rounded-full border ${
              count > 0
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50 font-semibold'
                : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
          >
            {count}
          </span>
        );
      },
    },
    {
      key: 'lastCareAt',
      header: 'Lần chăm sóc gần nhất',
      width: '170px',
      render: (row) => {
        if (!row.lastCareAt) {
          return <span className="text-slate-500 font-sans text-xs">Chưa có lịch sử chăm sóc</span>;
        }
        return <DateDisplay date={row.lastCareAt} className="text-xs font-mono" />;
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '80px',
      render: (row) => (
        <Button
          variant="outline"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/customers/${row.id}`, {
              state: { returnUrl: `/customers?${searchParams.toString()}` },
            });
          }}
          className="h-6 px-2 text-[11px] gap-1 hover:border-blue-500/60 hover:text-blue-300 font-mono"
        >
          <span>Chi tiết</span>
          <ExternalLink className="w-3 h-3" />
        </Button>
      ),
    },
  ];

  if (isError) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto">
        <PageHeader
          title="Danh bạ khách hàng"
          category="Khách hàng"
          description="Quản lý thông tin định danh, trạng thái tài khoản, nhu cầu tài chính và lịch sử hồ sơ."
        />
        <ErrorState
          title="Không thể tải danh sách khách hàng"
          description="Đã xảy ra lỗi khi kết nối với máy chủ dữ liệu. Vui lòng thử lại."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  // Active sources for bulk assign
  const activeSources = (sources || []).filter((s) => s.active);

  // Selected customer list items for schedule modal
  const selectedCustomerObjects = customers
    .filter((c) => selectedCustomerIds.includes(c.id))
    .map((c) => ({ id: c.id, fullName: c.fullName, phone: c.phone }));

  return (
    <div className="space-y-3.5 max-w-7xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title={role === 'PARTNER' ? 'Khách hàng của tôi' : 'Danh bạ khách hàng'}
        category={role === 'PARTNER' ? 'Phân công' : 'Khách hàng'}
        description={
          role === 'PARTNER'
            ? 'Danh sách khách hàng được Quản trị viên phân công cho bạn xử lý và chăm sóc.'
            : 'Quản lý thông tin định danh, trạng thái tài khoản, nhu cầu tài chính và hồ sơ thẩm định.'
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="text-xs h-8"
            >
              Làm mới
            </Button>
            {role !== 'PARTNER' && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateOpen(true)}
                className="text-xs h-8 gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm khách hàng</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Comprehensive Filter Bar */}
      <FilterBar activeCount={activeFilterCount} onReset={handleResetFilters}>
        {/* Search */}
        <SearchInput
          value={searchTerm}
          onChange={(val) => {
            setSearchTerm(val);
            updateFilters({ search: val.trim() || undefined, page: 1 });
          }}
          placeholder="Tìm tên, số điện thoại, email... (/)"
          className="w-56"
        />

        {/* Status Filter */}
        <select
          value={status}
          onChange={(e) => updateFilters({ status: e.target.value || undefined, page: 1 })}
          className="h-8 bg-slate-900 border border-slate-800 rounded px-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
        >
          <option value="">Tất cả trạng thái</option>
          <optgroup label="Trạng thái hồ sơ">
            <option value="NOT_SELECTED">1. Chưa có sản phẩm</option>
            <option value="REGISTRATION_CREATED">2. Đăng ký tạo</option>
            <option value="REGISTRATION_COMPLETED">3. Hoàn tất đăng ký</option>
            <option value="UNDER_REVIEW">4. Đang thẩm định</option>
            <option value="APPROVED">5. Đã duyệt</option>
            <option value="CARD_ISSUED">6. Phát hành thẻ / Hợp đồng</option>
            <option value="CARD_ACTIVATED">7. Kích hoạt</option>
            <option value="COMPLETED">8. Hoàn tất</option>
          </optgroup>
          <optgroup label="Khách chưa có hồ sơ">
            <option value="LEAD_MOI">Lead mới</option>
            <option value="DANG_TIEP_CAN">Đang tiếp cận</option>
            <option value="DANG_TU_VAN">Đang tư vấn</option>
            <option value="THANH_CONG">Thành công</option>
            <option value="KHONG_KHA_THI">Không khả thi</option>
          </optgroup>
        </select>

        {/* Priority / Need Filter */}
        <select
          value={priority}
          onChange={(e) => updateFilters({ priority: e.target.value || undefined, page: 1 })}
          className="h-8 bg-slate-900 border border-slate-800 rounded px-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
        >
          <option value="">Tất cả nhu cầu</option>
          <option value="CHUA_CO_NHU_CAU">Chưa có nhu cầu</option>
          <option value="THANH_KHOAN">Thanh khoản</option>
          <option value="TIN_DUNG">Tín dụng</option>
          <option value="THANH_KHOAN_TIN_DUNG">Thanh khoản & Tín dụng</option>
        </select>

        {/* Source Filter */}
        <select
          value={sourceId}
          onChange={(e) => {
            const val = e.target.value;
            updateFilters({
              sourceId: val || undefined,
              source: undefined,
              page: 1,
            });
          }}
          className="h-8 bg-slate-900 border border-slate-800 rounded px-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
        >
          <option value="">Tất cả nguồn khách</option>
          {(sources || []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} {!s.active ? '(Inactive)' : ''}
            </option>
          ))}
        </select>

        {/* Product Filter */}
        <select
          value={product}
          onChange={(e) => updateFilters({ product: e.target.value || undefined, page: 1 })}
          className="h-8 bg-slate-900 border border-slate-800 rounded px-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
        >
          <option value="">Tất cả sản phẩm</option>
          {(products || []).map((p) => (
            <option key={p.id} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Tag Filter */}
        <select
          value={tag}
          onChange={(e) => updateFilters({ tag: e.target.value || undefined, page: 1 })}
          className="h-8 bg-slate-900 border border-slate-800 rounded px-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
        >
          <option value="">Tất cả nhãn</option>
          {(tags || []).map((t) => (
            <option key={t.id} value={t.name}>
              {t.name}
            </option>
          ))}
        </select>

        {/* Date Filter: Start & End Date */}
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={startDate}
            onChange={(e) => updateFilters({ startDate: e.target.value || undefined, page: 1 })}
            title="Từ ngày tạo"
            className="h-8 px-1.5 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-200 font-mono focus:outline-none focus:border-blue-500"
          />
          <span className="text-slate-600 text-xs">đến</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => updateFilters({ endDate: e.target.value || undefined, page: 1 })}
            title="Đến ngày tạo"
            className="h-8 px-1.5 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-200 font-mono focus:outline-none focus:border-blue-500"
          />
        </div>
      </FilterBar>

      {/* Notification banner for bulk operations */}
      {bulkNotification && (
        <div
          className={`p-3 rounded text-xs border space-y-1.5 animate-in fade-in duration-150 ${
            bulkNotification.type === 'success'
              ? 'bg-emerald-950/70 text-emerald-200 border-emerald-800/80'
              : bulkNotification.type === 'warning'
              ? 'bg-amber-950/70 text-amber-200 border-amber-800/80'
              : 'bg-rose-950/70 text-rose-200 border-rose-800/80'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {bulkNotification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              )}
              <span className="font-medium">{bulkNotification.message}</span>
            </div>
            <button
              onClick={() => setBulkNotification(null)}
              className="text-slate-400 hover:text-slate-200 text-xs ml-3 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {bulkNotification.details && bulkNotification.details.length > 0 && (
            <div className="mt-1.5 pl-6 space-y-0.5 text-[11px] font-mono text-slate-300">
              {bulkNotification.details.slice(0, 5).map((d) => (
                <p key={d.id}>• {d.name || d.id}: {d.reason}</p>
              ))}
              {bulkNotification.details.length > 5 && (
                <p className="italic text-slate-400">và {bulkNotification.details.length - 5} khách hàng khác...</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sticky Bulk Action Toolbar (ADMIN only) */}
      {role !== 'PARTNER' && selectedCustomerIds.length > 0 && (
        <div className="bg-slate-900/95 border border-blue-500/40 rounded-lg p-2.5 shadow-xl flex flex-wrap items-center justify-between gap-3 backdrop-blur animate-in fade-in duration-200">
          {/* Left: Selection Counter & Clear */}
          <div className="flex items-center flex-wrap gap-2">
            <span className="inline-flex items-center justify-center bg-blue-600 text-white font-mono text-xs font-bold px-2.5 py-0.5 rounded-full">
              {selectedCustomerIds.length}
            </span>
            <span className="text-xs font-semibold text-slate-100">
              khách hàng được chọn
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              (trên trang này: {selectedOnCurrentPage.length}/{customers.length})
            </span>
            {!isAllPageSelected && (
              <button
                type="button"
                onClick={handleToggleSelectAllPage}
                className="text-[11px] text-blue-400 hover:text-blue-300 underline cursor-pointer ml-1"
              >
                Chọn tất cả trang này
              </button>
            )}
            <button
              onClick={() => setSelectedCustomerIds([])}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline ml-1 cursor-pointer"
            >
              Bỏ chọn tất cả
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. Lên lịch chăm sóc cho nhiều khách hàng (Req 4) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsScheduleModalOpen(true)}
              className="h-7 text-xs px-2.5 gap-1.5 border-amber-800/80 text-amber-300 hover:bg-amber-950/40 font-medium"
              title="Lên lịch chăm sóc đồng thời cho các khách hàng đã chọn"
            >
              <CalendarCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Lên lịch chăm sóc</span>
            </Button>

            {/* 2. Gán nguồn khách hàng (Req 1.3) */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAssignSourceModalOpen(true)}
              className="h-7 text-xs px-2.5 gap-1.5 border-blue-800/80 text-blue-300 hover:bg-blue-950/40 font-medium"
              title="Gán nguồn khách hàng cho các khách đã chọn"
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>Thêm nguồn khách hàng</span>
            </Button>

            {/* 3. Cập nhật trạng thái */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value)}
                className="h-7 bg-slate-900 border-0 rounded px-2 text-xs text-slate-200 focus:outline-none"
              >
                <option value="">Trạng thái...</option>
                <option value="LEAD_MOI">Lead mới</option>
                <option value="DANG_TIEP_CAN">Đang tiếp cận</option>
                <option value="DANG_TU_VAN">Đang tư vấn</option>
                <option value="THANH_CONG">Thành công</option>
                <option value="KHONG_KHA_THI">Không khả thi</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                disabled={!bulkStatus || bulkAction.isPending}
                onClick={handleApplyBulkStatus}
                className="h-7 text-xs px-2"
              >
                Cập nhật
              </Button>
            </div>

            {/* 4. Cập nhật nhu cầu */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
              <select
                value={bulkPriority}
                onChange={(e) => setBulkPriority(e.target.value)}
                className="h-7 bg-slate-900 border-0 rounded px-2 text-xs text-slate-200 focus:outline-none"
              >
                <option value="">Nhu cầu...</option>
                <option value="CHUA_CO_NHU_CAU">Chưa có nhu cầu</option>
                <option value="THANH_KHOAN">Thanh khoản</option>
                <option value="TIN_DUNG">Tín dụng</option>
                <option value="THANH_KHOAN_TIN_DUNG">Thanh khoản & Tín dụng</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                disabled={!bulkPriority || bulkAction.isPending}
                onClick={handleApplyBulkPriority}
                className="h-7 text-xs px-2"
              >
                Cập nhật
              </Button>
            </div>

            {/* 5. Gắn nhãn */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
              <select
                value={bulkTagId}
                onChange={(e) => setBulkTagId(e.target.value)}
                className="h-7 bg-slate-900 border-0 rounded px-2 text-xs text-slate-200 focus:outline-none max-w-[110px]"
              >
                <option value="">Gắn nhãn...</option>
                {(tags || []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                disabled={!bulkTagId || bulkAction.isPending}
                onClick={handleApplyBulkTag}
                className="h-7 text-xs px-2"
              >
                Gắn
              </Button>
            </div>

            {/* 6. Xóa khách hàng đã chọn (Req 1.2) */}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteModalOpen(true)}
              className="h-7 text-xs px-2.5 gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-medium ml-1"
              title="Xóa các khách hàng đã chọn"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa khách hàng đã chọn</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={customers}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        isEmpty={customers.length === 0}
        emptyTitle={role === 'PARTNER' ? 'Chưa có khách hàng' : 'Chưa có khách hàng phù hợp'}
        emptyDescription={
          role === 'PARTNER'
            ? activeFilterCount > 0
              ? 'Không có khách hàng nào khớp với điều kiện lọc. Vui lòng điều chỉnh hoặc xóa bộ lọc.'
              : 'Bạn chưa được phân công khách hàng nào hoặc tất cả phân công đã hoàn tất.'
            : selectedSource
            ? `Không có khách hàng thuộc nguồn ${selectedSource.name}.`
            : activeFilterCount > 0
            ? 'Không có khách hàng nào khớp với điều kiện lọc. Vui lòng điều chỉnh hoặc xóa bộ lọc.'
            : 'Danh bạ khách hàng hiện đang trống. Nhấn "Thêm khách hàng" để tạo hồ sơ đầu tiên.'
        }
        emptyActionLabel={
          role === 'PARTNER'
            ? activeFilterCount > 0
              ? 'Xóa bộ lọc'
              : undefined
            : activeFilterCount > 0
            ? 'Xóa bộ lọc'
            : 'Thêm khách hàng'
        }
        onEmptyAction={
          role === 'PARTNER'
            ? activeFilterCount > 0
              ? handleResetFilters
              : undefined
            : activeFilterCount > 0
            ? handleResetFilters
            : () => setIsCreateOpen(true)
        }
        onRowClick={(row) =>
          navigate(`/customers/${row.id}`, {
            state: { returnUrl: `/customers?${searchParams.toString()}` },
          })
        }
      />

      {/* Pagination Controls */}
      {pagination.total > 0 && (
        <Pagination
          page={pagination.page || 1}
          totalPages={pagination.totalPages || 1}
          pageSize={pagination.pageSize || 10}
          total={pagination.total || 0}
          onPageChange={(newPage) => updateFilters({ page: newPage })}
          onPageSizeChange={(newSize) => {
            updateFilters({ pageSize: newSize, page: 1 });
          }}
        />
      )}

      {/* Quick Create Customer Modal (ADMIN only) */}
      {role !== 'PARTNER' && (
        <CreateCustomerModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
        />
      )}

      {/* Requirement 1.3: Modal Gán Nguồn Khách Hàng */}
      {isAssignSourceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-100">
          <div
            className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-100"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 font-mono">Thêm nguồn khách hàng</h3>
                  <p className="text-[10px] text-slate-400">Gán nguồn phân loại cho các khách hàng được chọn</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignSourceModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-200">
                Bạn đang chuẩn bị gán nguồn cho{' '}
                <strong className="text-blue-400 font-mono font-bold">
                  {selectedCustomerIds.length}
                </strong>{' '}
                khách hàng đã chọn.
              </p>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Chọn nguồn cần gán <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedBulkSourceId}
                  onChange={(e) => setSelectedBulkSourceId(e.target.value)}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
                >
                  <option value="">-- Chọn nguồn khách hàng đang hoạt động --</option>
                  {activeSources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-2.5 rounded bg-blue-950/30 border border-blue-800/40 text-[11px] text-blue-300">
                Lưu ý: Nguồn của các khách hàng được chọn sẽ chỉ được cập nhật sau khi bạn nhấn xác nhận.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-3 bg-slate-950/80 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAssignSourceModalOpen(false)}
                disabled={bulkAction.isPending}
                className="text-xs h-8"
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={!selectedBulkSourceId || bulkAction.isPending}
                onClick={handleConfirmAssignSource}
                className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white font-medium"
              >
                {bulkAction.isPending ? 'Đang cập nhật...' : 'Xác nhận gán nguồn'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Requirement 1.2: Modal Xác Nhận Xóa Hàng Loạt */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-100">
          <div
            className="w-full max-w-md rounded-lg border border-red-900/50 bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-100"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-red-950/30">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 font-mono">Xác nhận xóa khách hàng</h3>
                  <p className="text-[10px] text-slate-400">Thao tác này sẽ xóa hồ sơ khách hàng khỏi hệ thống</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-200">
                Bạn có chắc chắn muốn xóa{' '}
                <strong className="text-red-400 font-mono font-bold">
                  {selectedCustomerIds.length}
                </strong>{' '}
                khách hàng đã chọn?
              </p>

              <div className="p-3 rounded bg-amber-950/40 border border-amber-800/60 text-amber-300 space-y-1 text-[11px]">
                <div className="flex items-center gap-1.5 font-semibold text-amber-200">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Chính sách bảo vệ dữ liệu an toàn</span>
                </div>
                <p>
                  Để bảo toàn dữ liệu lịch sử kinh doanh, hệ thống sẽ tự động kiểm tra và <strong>từ chối xóa</strong> các khách hàng đang có <strong>hồ sơ vay, ghi chú nghiệp vụ hoặc lịch chăm sóc</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-3 bg-slate-950/80 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={bulkAction.isPending}
                className="text-xs h-8"
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={bulkAction.isPending}
                onClick={handleConfirmBulkDelete}
                className="text-xs h-8 bg-rose-600 hover:bg-rose-500 text-white font-medium"
              >
                {bulkAction.isPending ? 'Đang xóa...' : `Xác nhận xóa (${selectedCustomerIds.length})`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Requirement 4: Modal Lên Lịch Chăm Sóc Cho Khách Hàng Đã Chọn */}
      <ScheduleFollowUpModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        initialSelectedCustomers={selectedCustomerObjects}
      />
    </div>
  );
};

export default CustomersPage;
