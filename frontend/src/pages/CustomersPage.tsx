import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Plus,
  ExternalLink,
  AlertCircle,
  Clock,
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
import { useCustomers } from '../hooks/useCustomers';
import { useProducts } from '../hooks/useProducts';
import { useTags } from '../hooks/useTags';
import { CustomerSummary } from '../types/models';
import { CreateCustomerModal } from '../features/customers/CreateCustomerModal';

export const CustomersPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Queries for filter options
  const { data: products } = useProducts();
  const { data: tags } = useTags();

  // Direct source of truth from URL query params
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const product = searchParams.get('product') || '';
  const need = searchParams.get('need') || '';
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

  // Sync local search term if URL changes externally (e.g. back/forward, navbar search)
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
    product: product || undefined,
    need: need.trim() || undefined,
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

  const activeFilterCount = [
    Boolean(search.trim()),
    Boolean(status),
    Boolean(product),
    Boolean(need.trim()),
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

  // Table Columns - strictly prioritized for rapid scanning:
  // Name -> Status -> Need -> Last Activity -> Follow-up -> Recommendation
  const columns: Column<CustomerSummary>[] = [
    {
      key: 'fullName',
      header: 'Khách hàng',
      sortable: true,
      width: '210px',
      render: (row) => (
        <div className="flex flex-col min-w-0 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-100 hover:text-blue-400 transition-colors truncate">
              {row.fullName}
            </span>
            {row.priority && row.priority !== 'LOW' && (
              <span
                className={`text-[9px] font-mono px-1 py-0.2 rounded font-semibold uppercase ${
                  row.priority === 'URGENT' || row.priority === 'HIGH'
                    ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                    : 'bg-amber-950/60 text-amber-300 border border-amber-800/40'
                }`}
              >
                {row.priority === 'URGENT' ? 'Khẩn cấp' : row.priority === 'HIGH' ? 'Cao' : 'Trung bình'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-slate-400 font-mono">
              {row.phone}
            </span>
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
      key: 'overallStatus',
      header: 'Trạng thái',
      sortable: true,
      width: '100px',
      render: (row) => <StatusBadge status={row.overallStatus} />,
    },
    {
      key: 'needs',
      header: 'Nhu cầu chính',
      width: '150px',
      render: (row) => {
        const primaryNeed = row.needs?.[0];
        if (!primaryNeed) {
          return <span className="text-slate-600 font-mono text-[11px]">Chưa khai báo</span>;
        }
        return (
          <div className="flex items-center gap-1 max-w-[145px]">
            <span
              title={`Trạng thái: ${primaryNeed.status}`}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-950/50 text-amber-300 border border-amber-800/40 truncate"
            >
              {primaryNeed.needType.replace(/_/g, ' ')}
            </span>
            {row.needs && row.needs.length > 1 && (
              <span className="text-[10px] text-slate-500 font-mono shrink-0">
                +{row.needs.length - 1}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'lastActivity',
      header: 'Tương tác gần nhất',
      width: '160px',
      render: (row) => {
        const act = row.activities?.[0];
        if (!act) {
          return <span className="text-slate-600 font-mono text-[11px]">Chưa có tương tác</span>;
        }
        return (
          <div className="flex flex-col min-w-0" title={`${act.title} (${act.type})`}>
            <span className="text-[11px] text-slate-300 truncate font-sans">
              {act.title}
            </span>
            <DateDisplay date={act.occurredAt} relativeContext className="text-[10px]" />
          </div>
        );
      },
    },
    {
      key: 'nextFollowUp',
      header: 'Lịch chăm sóc',
      width: '165px',
      render: (row) => {
        const fu = row.followUps?.[0];
        if (!fu) {
          return <span className="text-slate-600 font-mono text-[11px]">Chưa lên lịch</span>;
        }
        const isOverdue = new Date(fu.dueAt).getTime() < Date.now();
        return (
          <div className="flex flex-col min-w-0" title={fu.title}>
            <div className="flex items-center gap-1">
              {isOverdue ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-rose-400 bg-rose-950/60 px-1 rounded border border-rose-800/40">
                  <AlertCircle className="w-2.5 h-2.5" /> Quá hạn
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-400">
                  <Clock className="w-2.5 h-2.5" />
                </span>
              )}
              <DateDisplay date={fu.dueAt} relativeContext className="text-[10px]" />
            </div>
            <span className="text-[10px] text-slate-400 truncate mt-0.5">{fu.title}</span>
          </div>
        );
      },
    },
    {
      key: 'recommendation',
      header: 'Đề xuất phù hợp',
      width: '170px',
      render: (row) => {
        const rec = row.recommendations?.[0];
        if (!rec) {
          return <span className="text-slate-600 font-mono text-[11px]">Chưa có đề xuất</span>;
        }
        return (
          <div className="flex flex-col min-w-0" title={rec.reason}>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-medium text-purple-300 truncate">
                {rec.targetProduct?.name || 'Sản phẩm phù hợp'}
              </span>
              {rec.score && (
                <span className="text-[9px] font-mono font-bold px-1 rounded bg-purple-950/80 text-purple-300 border border-purple-800/50 shrink-0">
                  {Math.round(Number(rec.score))}%
                </span>
              )}
            </div>
            <span className="text-[10px] text-slate-400 truncate mt-0.5">
              {rec.reason}
            </span>
          </div>
        );
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
            navigate(`/customers/${row.id}`);
          }}
          className="h-6 px-2 text-[11px] gap-1 hover:border-blue-500/60 hover:text-blue-300 font-mono"
        >
          <span>360°</span>
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
        description="Quản lý thông tin định danh, trạng thái tài khoản, nhu cầu tài chính và lịch sử hồ sơ."
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
              className="text-xs h-8 gap-1.5 bg-blue-600 hover:bg-blue-500 text-white"
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
          <option value="LEAD">Tiềm năng (LEAD)</option>
          <option value="PROSPECT">Triển vọng (PROSPECT)</option>
          <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
          <option value="DORMANT">Không hoạt động (DORMANT)</option>
          <option value="LOST">Đã mất (LOST)</option>
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

        {/* Need Filter */}
        <input
          type="text"
          placeholder="Lọc nhu cầu..."
          value={need}
          onChange={(e) => updateFilters({ need: e.target.value.trim() || undefined, page: 1 })}
          className="h-8 w-28 px-2 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono"
        />

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

      {/* Main Table */}
      <DataTable
        columns={columns}
        data={customers}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        isEmpty={customers.length === 0}
        emptyTitle="Chưa có khách hàng nào"
        emptyDescription={
          activeFilterCount > 0
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
