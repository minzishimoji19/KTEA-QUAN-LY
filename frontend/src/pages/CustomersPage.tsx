import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  ExternalLink,
} from 'lucide-react';
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
import { CustomerSummary, CustomerStatus, PriorityLevel } from '../types/models';
import { CreateCustomerModal } from '../features/customers/CreateCustomerModal';

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

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
  const [bulkNotification, setBulkNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  // Table Columns strictly matching business requirements:
  // - Customer name
  // - Phone
  // - Source
  // - Overall customer status
  // - Priority
  // - Number of cases (real API data)
  // - Latest case status/progress
  // - Created date
  // - Updated date
  // - Actions
  const isAllSelected =
    customers.length > 0 &&
    customers.every((c) => selectedCustomerIds.includes(c.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      const pageCustomerIds = new Set(customers.map((c) => c.id));
      setSelectedCustomerIds(selectedCustomerIds.filter((id) => !pageCustomerIds.has(id)));
    } else {
      const pageCustomerIds = customers.map((c) => c.id);
      setSelectedCustomerIds(Array.from(new Set([...selectedCustomerIds, ...pageCustomerIds])));
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

  const columns: Column<CustomerSummary>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={isAllSelected}
          onChange={handleToggleSelectAll}
          className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
          title="Chọn tất cả trên trang này"
        />
      ),
      width: '36px',
      align: 'center',
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedCustomerIds.includes(row.id)}
          onClick={(e) => handleToggleSelectCustomer(row.id, e)}
          onChange={() => {}}
          className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
        />
      ),
    },
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
      width: '120px',
      render: (row) => (
        <span className="text-xs text-slate-300 font-mono">
          {row.phone}
        </span>
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
                title="Nguồn khách này hiện đã ngừng hoạt động"
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
      key: 'createdAt',
      header: 'Ngày tạo',
      sortable: true,
      width: '115px',
      render: (row) => <DateDisplay date={row.createdAt} className="text-xs font-mono" />,
    },
    {
      key: 'updatedAt',
      header: 'Cập nhật',
      sortable: true,
      width: '115px',
      render: (row) => <DateDisplay date={row.updatedAt} className="text-xs font-mono" />,
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
            navigate(`/customers/${row.id}`);
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

  return (
    <div className="space-y-3.5 max-w-7xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="Danh bạ khách hàng"
        category="Khách hàng"
        description="Quản lý thông tin định danh, trạng thái tài khoản, nhu cầu tài chính và hồ sơ thẩm định."
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
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="text-xs h-8 gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm khách hàng</span>
            </Button>
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
          className="h-8 bg-slate-900 border border-slate-800 rounded px-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="LEAD_MOI">Lead mới (LEAD_MOI)</option>
          <option value="DANG_TIEP_CAN">Đang tiếp cận (DANG_TIEP_CAN)</option>
          <option value="DANG_TU_VAN">Đang tư vấn (DANG_TU_VAN)</option>
          <option value="THANH_CONG">Thành công (THANH_CONG)</option>
          <option value="KHONG_KHA_THI">Không khả thi (KHONG_KHA_THI)</option>
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
          className={`flex items-center justify-between px-3 py-2 rounded text-xs border ${
            bulkNotification.type === 'success'
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
              : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
          }`}
        >
          <span>{bulkNotification.message}</span>
          <button
            onClick={() => setBulkNotification(null)}
            className="text-slate-400 hover:text-slate-200 text-xs ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* Sticky Bulk Action Toolbar */}
      {selectedCustomerIds.length > 0 && (
        <div className="bg-slate-900/95 border border-blue-500/40 rounded-lg p-2.5 shadow-xl flex flex-wrap items-center justify-between gap-3 backdrop-blur animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center bg-blue-600 text-white font-mono text-xs font-semibold px-2 py-0.5 rounded-full">
              {selectedCustomerIds.length}
            </span>
            <span className="text-xs font-medium text-slate-200">
              khách hàng được chọn
            </span>
            <button
              onClick={() => setSelectedCustomerIds([])}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline ml-1 cursor-pointer"
            >
              Bỏ chọn
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Bulk Update Status */}
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

            {/* Bulk Update Priority */}
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

            {/* Bulk Add Tag */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
              <select
                value={bulkTagId}
                onChange={(e) => setBulkTagId(e.target.value)}
                className="h-7 bg-slate-900 border-0 rounded px-2 text-xs text-slate-200 focus:outline-none max-w-[120px]"
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
          </div>
        </div>
      )}

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={customers}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        isEmpty={customers.length === 0}
        emptyTitle="Chưa có khách hàng phù hợp"
        emptyDescription={
          selectedSource
            ? `Không có khách hàng thuộc nguồn ${selectedSource.name}.`
            : activeFilterCount > 0
            ? 'Không có khách hàng nào khớp với điều kiện lọc. Vui lòng điều chỉnh hoặc xóa bộ lọc.'
            : 'Danh bạ khách hàng hiện đang trống. Nhấn "Thêm khách hàng" để tạo hồ sơ đầu tiên.'
        }
        emptyActionLabel={activeFilterCount > 0 ? 'Xóa bộ lọc' : 'Thêm khách hàng'}
        onEmptyAction={
          activeFilterCount > 0 ? handleResetFilters : () => setIsCreateOpen(true)
        }
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        onRowClick={(row) => navigate(`/customers/${row.id}`)}
      />

      {/* Pagination */}
      {customers.length > 0 && (
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize || pagination.limit || pageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          onPageChange={(newPage) => updateFilters({ page: newPage })}
          onPageSizeChange={(newSize) => {
            updateFilters({ pageSize: newSize, page: 1 });
          }}
        />
      )}

      {/* Quick Create Customer Modal */}
      <CreateCustomerModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(newId) => {
          navigate(`/customers/${newId}`);
        }}
      />
    </div>
  );
};

export default CustomersPage;
