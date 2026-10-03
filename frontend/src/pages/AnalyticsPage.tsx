import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Briefcase,
  Target,
  Send,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { PageHeader, DataTable, Column } from '../components/common';
import { Button } from '../components/ui/Button';
import { AnalyticsMetricCard } from '../components/analytics/AnalyticsMetricCard';
import { DateRangePicker } from '../components/analytics/DateRangePicker';
import { DistributionBar } from '../components/analytics/DistributionBar';
import { TimeSeriesChart } from '../components/analytics/TimeSeriesChart';
import {
  useAnalyticsOverview,
  useCustomerAnalytics,
  useCaseAnalytics,
  useNeedAnalytics,
  usePushAnalytics,
} from '../hooks/useAnalytics';

export const AnalyticsPage: React.FC = () => {
  const navigate = useNavigate();

  // Date Filter State
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Active Tab State
  const [activeTab, setActiveTab] = useState<
    'overview' | 'customers' | 'cases' | 'needs' | 'push'
  >('overview');

  const filter = {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  // 5 Analytics Endpoints
  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    refetch: refetchOverview,
  } = useAnalyticsOverview(filter);

  const {
    data: customerData,
    refetch: refetchCustomers,
  } = useCustomerAnalytics(filter);

  const {
    data: caseData,
    isLoading: isCaseLoading,
    refetch: refetchCases,
  } = useCaseAnalytics(filter);

  const {
    data: needData,
    isLoading: isNeedLoading,
    refetch: refetchNeeds,
  } = useNeedAnalytics(filter);

  const {
    data: pushData,
    isLoading: isPushLoading,
    refetch: refetchPush,
  } = usePushAnalytics(filter);

  const handleRefreshAll = () => {
    refetchOverview();
    refetchCustomers();
    refetchCases();
    refetchNeeds();
    refetchPush();
  };

  const metrics = overviewData?.metrics;
  const defs = overviewData?.definitions || {};

  // Status Color Helper
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-500';
      case 'PROSPECT':
        return 'bg-blue-500';
      case 'LEAD':
        return 'bg-amber-500';
      case 'DORMANT':
        return 'bg-slate-500';
      case 'LOST':
        return 'bg-red-500';
      case 'APPROVED':
      case 'SUCCESS':
        return 'bg-emerald-500';
      case 'REJECTED':
      case 'FAILED':
        return 'bg-red-500';
      default:
        return 'bg-indigo-500';
    }
  };

  // Case Table Columns
  const caseProductColumns: Column<any>[] = [
    {
      key: 'product',
      header: 'Sản phẩm',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-100 text-xs">{row.productName}</span>
          <span className="text-[10px] font-mono text-blue-400">{row.productCode}</span>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Tổng số hồ sơ',
      render: (row) => <span className="font-mono text-xs">{row.total}</span>,
    },
    {
      key: 'approved',
      header: 'Đã duyệt',
      render: (row) => (
        <span className="font-mono text-xs text-emerald-400 font-semibold">
          {row.approved}
        </span>
      ),
    },
    {
      key: 'rejected',
      header: 'Từ chối',
      render: (row) => (
        <span className="font-mono text-xs text-red-400 font-semibold">
          {row.rejected}
        </span>
      ),
    },
    {
      key: 'pending',
      header: 'Đang xử lý',
      render: (row) => <span className="font-mono text-xs text-amber-400">{row.pending}</span>,
    },
    {
      key: 'rate',
      header: 'Tỷ lệ duyệt (Đã xử lý)',
      render: (row) => (
        <div className="flex flex-col" title={row.approvalRateOnResolved.definition}>
          <span className="font-mono text-xs text-slate-200">
            {row.approvalRateOnResolved.value}%
          </span>
          <span className="text-[9px] font-mono text-slate-500">
            {row.approvalRateOnResolved.numerator}/{row.approvalRateOnResolved.denominator} đã xử lý
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <PageHeader
        title="Phân tích dữ liệu"
        category="Dữ liệu & Danh mục"
        description="Chỉ số khách hàng tổng hợp, tiến độ hồ sơ, phân tích nhu cầu và tỷ lệ chuyển đổi giới thiệu."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              className="text-xs h-8 gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Làm mới</span>
            </Button>
          </div>
        }
      />

      {/* Date Range Selector Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={(s, e) => {
            setStartDate(s);
            setEndDate(e);
          }}
        />

        {(startDate || endDate) && (
          <span className="text-xs font-mono text-blue-400 bg-blue-950/40 border border-blue-800/40 px-2.5 py-1 rounded-lg">
            Khoảng thời gian: {startDate || 'Bắt đầu'} đến {endDate || 'Hiện tại'}
          </span>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Briefcase className="w-3.5 h-3.5" />
          <span>Tổng quan</span>
        </button>

        <button
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'customers'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Phân tích khách hàng</span>
        </button>

        <button
          onClick={() => setActiveTab('cases')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'cases'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Phân tích hồ sơ</span>
        </button>

        <button
          onClick={() => setActiveTab('needs')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'needs'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Phân tích nhu cầu</span>
        </button>

        <button
          onClick={() => setActiveTab('push')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'push'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Phân tích chuyển khách</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 1. EXECUTIVE OVERVIEW TAB                                  */}
      {/* ======================================================== */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Top Row: Customer Lifecycle KPIs */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 font-semibold">
              Khách hàng & Mức độ tương tác
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <AnalyticsMetricCard
                label="Tổng số khách hàng"
                value={metrics?.totalCustomers ?? 0}
                subtext="Toàn bộ khách hàng trong cơ sở dữ liệu"
                definition={defs.totalCustomers}
                icon={<Users className="w-4 h-4 text-blue-400" />}
                isLoading={isOverviewLoading}
                onClick={() => navigate('/customers')}
                drillDownLabel="Xem danh sách"
              />
              <AnalyticsMetricCard
                label="Khách hàng mới"
                value={metrics?.newCustomersInPeriod ?? 0}
                subtext={startDate || endDate ? 'Tạo trong khoảng thời gian' : 'Tất cả thời gian'}
                definition={defs.newCustomersInPeriod}
                icon={<Users className="w-4 h-4 text-indigo-400" />}
                isLoading={isOverviewLoading}
                onClick={() =>
                  navigate(
                    `/customers${
                      startDate || endDate
                        ? `?startDate=${startDate}&endDate=${endDate}`
                        : ''
                    }`
                  )
                }
                drillDownLabel="Xem khách mới"
              />
              <AnalyticsMetricCard
                label="Khách hàng đang hoạt động"
                value={metrics?.activeCustomers ?? 0}
                subtext={`${
                  metrics?.totalCustomers
                    ? Math.round(
                        (metrics.activeCustomers / metrics.totalCustomers) * 100
                      )
                    : 0
                }% tổng danh mục`}
                definition={defs.activeCustomers}
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                isLoading={isOverviewLoading}
                onClick={() => navigate('/customers?status=ACTIVE')}
                drillDownLabel="Lọc đang hoạt động"
              />
              <AnalyticsMetricCard
                label="Nhu cầu đang mở"
                value={metrics?.customersWithActiveNeeds ?? 0}
                subtext="Khách hàng đang có nhu cầu"
                definition={defs.customersWithActiveNeeds}
                icon={<Target className="w-4 h-4 text-amber-400" />}
                isLoading={isOverviewLoading}
              />
            </div>
          </div>

          {/* Second Row: Operational Queue & Pipeline */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 font-semibold">
              Hàng đợi vận hành & Cơ hội
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <AnalyticsMetricCard
                label="Cần chăm sóc"
                value={metrics?.customersRequiringFollowUp ?? 0}
                subtext="Lịch chăm sóc đang chờ"
                definition={defs.customersRequiringFollowUp}
                icon={<Clock className="w-4 h-4 text-blue-400" />}
                isLoading={isOverviewLoading}
                onClick={() => navigate('/follow-ups')}
                drillDownLabel="Lịch chăm sóc"
              />
              <AnalyticsMetricCard
                label="Lịch quá hạn"
                value={metrics?.overdueFollowUps ?? 0}
                subtext="Đã quá thời hạn dự kiến"
                definition={defs.overdueFollowUps}
                icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
                isLoading={isOverviewLoading}
                onClick={() => navigate('/follow-ups?filter=overdue')}
                drillDownLabel="Mở quá hạn"
              />
              <AnalyticsMetricCard
                label="Đề xuất chuyển khách"
                value={metrics?.pushCandidates ?? 0}
                subtext="Đề xuất sẵn sàng chuyển"
                definition={defs.pushCandidates}
                icon={<Sparkles className="w-4 h-4 text-purple-400" />}
                isLoading={isOverviewLoading}
                onClick={() => navigate('/push')}
                drillDownLabel="Trung tâm xử lý"
              />
            </div>
          </div>

          {/* Third Row: Applications & Referral Conversion */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 font-semibold">
              Hồ sơ & Chuyển khách ngoại bộ
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <AnalyticsMetricCard
                label="Tổng số hồ sơ"
                value={metrics?.totalCases ?? 0}
                subtext="Hồ sơ sản phẩm tài chính"
                definition={defs.totalCases}
                icon={<Briefcase className="w-4 h-4 text-blue-400" />}
                isLoading={isOverviewLoading}
              />
              <AnalyticsMetricCard
                label="Hồ sơ đã duyệt"
                value={metrics?.successfulCases ?? 0}
                subtext={`${
                  metrics?.totalCases
                    ? Math.round(
                        (metrics.successfulCases / metrics.totalCases) * 100
                      )
                    : 0
                }% tỷ lệ duyệt`}
                definition={defs.successfulCases}
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                isLoading={isOverviewLoading}
              />
              <AnalyticsMetricCard
                label="Lượt chuyển khách"
                value={metrics?.totalPushes ?? 0}
                subtext="Số lượt chuyển đã tạo"
                definition={defs.totalPushes}
                icon={<Send className="w-4 h-4 text-purple-400" />}
                isLoading={isOverviewLoading}
                onClick={() => navigate('/push')}
                drillDownLabel="Trung tâm xử lý"
              />
              <AnalyticsMetricCard
                label="Chuyển khách thành công"
                value={metrics?.successfulPushes ?? 0}
                subtext={`${metrics?.failedPushes ?? 0} thất bại / từ chối`}
                definition={defs.successfulPushes}
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                isLoading={isOverviewLoading}
                onClick={() => navigate('/push')}
                drillDownLabel="Xem kết quả"
              />
            </div>
          </div>

          {/* Overview Breakdown Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
            <DistributionBar
              title="Khách hàng theo trạng thái"
              question="Phân bổ khách hàng qua các giai đoạn vòng đời?"
              totalLabel={`Tổng số: ${metrics?.totalCustomers ?? 0}`}
              items={(overviewData?.customersByStatus || []).map((s) => ({
                key: s.status,
                label: s.status,
                count: s.count,
                percentage: s.percentage,
                color: getStatusColor(s.status),
              }))}
              onItemClick={(item) => navigate(`/customers?status=${item.key}`)}
              drillDownTooltip="Lọc danh sách khách hàng theo trạng thái này"
            />

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-semibold text-slate-200 font-sans uppercase tracking-wider mb-2">
                  Tình trạng hệ thống & Giải thích
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Toàn bộ chỉ số phân tích được tổng hợp trực tiếp từ cơ sở dữ liệu giao dịch. Công thức tính toán xác định rõ tử số và mẫu số để đảm bảo tính minh bạch.
                </p>
                <div className="mt-4 space-y-2 text-xs font-mono text-slate-300">
                  <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400">Hồ sơ đang chờ xử lý:</span>
                    <span className="font-bold text-amber-400">{metrics?.pendingCases ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400">Hồ sơ bị từ chối:</span>
                    <span className="font-bold text-red-400">{metrics?.failedCases ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-slate-400">Lượt chuyển thất bại / từ chối:</span>
                    <span className="font-bold text-red-400">{metrics?.failedPushes ?? 0}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 mt-4 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">
                  Mô hình: Bộ quy tắc Giai đoạn 1
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/push')}
                  className="h-7 text-xs"
                >
                  Đến Trung tâm xử lý
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. CUSTOMER ANALYTICS TAB                                */}
      {/* ======================================================== */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Customers by Status */}
            <DistributionBar
              title="Khách hàng theo trạng thái"
              question="Tỷ lệ khách hàng đang hoạt động so với tiềm năng hoặc ngưng hoạt động?"
              totalLabel={`Tổng số: ${customerData?.summary.totalCustomers ?? 0}`}
              items={(customerData?.byStatus || []).map((s) => ({
                key: s.status,
                label: s.status,
                count: s.count,
                percentage: s.percentage,
                color: getStatusColor(s.status),
              }))}
              onItemClick={(item) => navigate(`/customers?status=${item.key}`)}
              drillDownTooltip="Nhấn để mở trang Khách hàng lọc theo trạng thái này"
            />

            {/* Customers by Product (Drilldown enabled!) */}
            <DistributionBar
              title="Khách hàng theo sản phẩm"
              question="Sản phẩm tài chính nào thu hút lượng hồ sơ đăng ký lớn nhất?"
              totalLabel="Hồ sơ theo sản phẩm"
              items={(customerData?.byProduct || []).map((p) => ({
                key: p.productCode,
                label: p.productName,
                count: p.customerCount,
                percentage: Math.round(
                  (p.customerCount / Math.max(1, customerData?.summary.totalCustomers || 1)) *
                    100
                ),
                subtext: `${p.totalCases} tổng hồ sơ (${p.approvedCases} đã duyệt)`,
                color: 'bg-blue-500',
              }))}
              onItemClick={(item) => navigate(`/customers?product=${item.key}`)}
              drillDownTooltip="Nhấn để xem khách hàng có hồ sơ sản phẩm này"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Customers by Need */}
            <DistributionBar
              title="Khách hàng theo nhu cầu"
              question="Các nhu cầu và ý định tài chính chủ yếu khách hàng đang thể hiện?"
              items={(customerData?.byNeed || []).map((n) => ({
                key: n.needType,
                label: n.needType.replace(/_/g, ' '),
                count: n.customerCount,
                percentage: n.percentage,
                subtext: `${n.count} lượt ghi nhận nhu cầu`,
                color: 'bg-amber-500',
              }))}
              onItemClick={(item) => navigate(`/customers?need=${item.key}`)}
              drillDownTooltip="Nhấn để xem khách hàng có nhu cầu này"
            />

            {/* Customers by Acquisition Source */}
            <DistributionBar
              title="Khách hàng theo nguồn"
              question="Kênh tiếp cận nào mang lại lượng khách hàng tiềm năng cao nhất?"
              items={(customerData?.bySource || []).map((s) => ({
                key: s.source,
                label: s.source.replace(/_/g, ' '),
                count: s.count,
                percentage: s.percentage,
                color: 'bg-indigo-500',
              }))}
            />
          </div>

          {/* Customer Creation Trend Chart */}
          <TimeSeriesChart
            title="Số lượng khách hàng theo thời gian"
            question="Quy mô danh mục khách hàng có tăng trưởng đều đặn qua các ngày không?"
            data={customerData?.creationTrend || []}
            color="#3b82f6"
            height={160}
          />
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. CASE ANALYTICS TAB                                    */}
      {/* ======================================================== */}
      {activeTab === 'cases' && (
        <div className="space-y-4">
          {/* Top Metric Cards: Success vs Failure */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AnalyticsMetricCard
              label="Hồ sơ đã xử lý xong"
              value={caseData?.successVsFailure.resolvedTotal ?? 0}
              subtext="Đã duyệt + Từ chối + Đã hủy"
              definition="Tất cả hồ sơ đã có kết quả cuối cùng. Không bao gồm hồ sơ đang chờ hoặc đang thẩm định."
              icon={<FolderOpen className="w-4 h-4 text-blue-400" />}
              isLoading={isCaseLoading}
            />
            <AnalyticsMetricCard
              label="Tỷ lệ duyệt (Đã xử lý)"
              value={`${caseData?.successVsFailure.approvalRateOnResolved.value ?? 0}%`}
              subtext={`${caseData?.successVsFailure.approved ?? 0} trên ${
                caseData?.successVsFailure.resolvedTotal ?? 0
              } đã xử lý`}
              definition={caseData?.successVsFailure.approvalRateOnResolved.definition}
              formula={`${caseData?.successVsFailure.approvalRateOnResolved.numerator} / ${caseData?.successVsFailure.approvalRateOnResolved.denominator}`}
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              trend={{
                value: `${caseData?.successVsFailure.approvalRateOnResolved.value ?? 0}%`,
                isPositive: (caseData?.successVsFailure.approvalRateOnResolved.value ?? 0) >= 50,
              }}
              isLoading={isCaseLoading}
            />
            <AnalyticsMetricCard
              label="Tỷ lệ từ chối (Đã xử lý)"
              value={`${caseData?.successVsFailure.rejectionRateOnResolved.value ?? 0}%`}
              subtext={`${caseData?.successVsFailure.rejected ?? 0} hồ sơ bị từ chối`}
              definition={caseData?.successVsFailure.rejectionRateOnResolved.definition}
              formula={`${caseData?.successVsFailure.rejectionRateOnResolved.numerator} / ${caseData?.successVsFailure.rejectionRateOnResolved.denominator}`}
              icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
              isLoading={isCaseLoading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Cases by Status */}
            <DistributionBar
              title="Hồ sơ theo trạng thái"
              question="Tỷ lệ hồ sơ đã được xử lý so với hồ sơ đang chờ thẩm định?"
              totalLabel={`Tổng số: ${caseData?.totalCases ?? 0}`}
              items={(caseData?.byStatus || []).map((s) => ({
                key: s.status,
                label: s.status,
                count: s.count,
                percentage: s.percentage,
                color: getStatusColor(s.status),
              }))}
            />

            {/* Cases Over Time */}
            <TimeSeriesChart
              title="Số lượng hồ sơ theo thời gian"
              question="Khối lượng hồ sơ tiếp nhận và xử lý thay đổi như thế nào theo thời gian?"
              data={(caseData?.casesOverTime || []).map((c) => ({
                date: c.date,
                count: c.total,
              }))}
              color="#10b981"
              height={160}
            />
          </div>

          {/* Cases by Product Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-slate-200 font-sans uppercase tracking-wider">
              Kết quả xử lý theo sản phẩm
            </h4>
            <DataTable
              columns={caseProductColumns}
              data={caseData?.byProduct || []}
              keyExtractor={(row) => row.productId}
              isLoading={isCaseLoading}
              isEmpty={(caseData?.byProduct || []).length === 0}
              emptyTitle="Chưa có hồ sơ nào"
              emptyDescription="Chưa có hồ sơ đăng ký nào cho các sản phẩm tài chính."
            />
          </div>

          {/* Top Failure Reasons */}
          {caseData?.topFailureReasons && caseData.topFailureReasons.length > 0 && (
            <div className="p-4 rounded-xl border border-red-950/60 bg-red-950/20 space-y-2">
              <h4 className="text-xs font-semibold text-red-300 font-sans uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span>Lý do từ chối hồ sơ chính</span>
              </h4>
              <div className="space-y-1.5 pt-1">
                {caseData.topFailureReasons.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs p-2 rounded bg-slate-950/60 border border-red-900/30 font-mono"
                  >
                    <span className="text-slate-300 truncate max-w-xl">{r.reason}</span>
                    <span className="text-red-400 font-bold ml-2">{r.count} hồ sơ</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. NEED ANALYTICS TAB                                    */}
      {/* ======================================================== */}
      {activeTab === 'needs' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <AnalyticsMetricCard
              label="Tổng số nhu cầu đã ghi nhận"
              value={needData?.totalNeeds ?? 0}
              subtext="Nhu cầu tài chính của khách hàng"
              definition="Tổng số nhu cầu tài chính được ghi nhận qua điện thoại, tiếp xúc trực tiếp hoặc tư vấn."
              icon={<Target className="w-4 h-4 text-blue-400" />}
              isLoading={isNeedLoading}
            />
            <AnalyticsMetricCard
              label="Nhu cầu đang xử lý"
              value={(needData?.activeNeeds || []).reduce((a, b) => a + b.count, 0)}
              subtext="Nhu cầu Mở hoặc Đang xử lý"
              definition="Các yêu cầu tài chính chưa được đáp ứng hoặc chưa đóng."
              icon={<Clock className="w-4 h-4 text-amber-400" />}
              isLoading={isNeedLoading}
            />
            <AnalyticsMetricCard
              label="Nhu cầu đã đáp ứng"
              value={(needData?.resolvedNeeds || []).reduce((a, b) => a + b.count, 0)}
              subtext="Đã khớp với sản phẩm thành công"
              definition="Nhu cầu đã hoàn tất hoặc đóng thành công."
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              isLoading={isNeedLoading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Most Common Needs */}
            <DistributionBar
              title="Khách hàng theo nhu cầu phổ biến"
              question="Nhu cầu tài chính nào đại diện cho cơ hội phục vụ lớn nhất?"
              items={(needData?.mostCommonNeeds || []).map((n) => ({
                key: n.needType,
                label: n.needType.replace(/_/g, ' '),
                count: n.total,
                percentage: n.percentage,
                subtext: `${n.open} Đang mở, ${n.inProgress} Đang xử lý, ${n.resolved} Đã hoàn tất`,
                color: 'bg-amber-500',
              }))}
              onItemClick={(item) => navigate(`/customers?need=${item.key}`)}
              drillDownTooltip="Lọc danh mục khách hàng theo nhu cầu này"
            />

            {/* Need Detection Timeline */}
            <TimeSeriesChart
              title="Xu hướng phát hiện nhu cầu"
              question="Tần suất phát hiện các nhu cầu mới diễn ra như thế nào theo thời gian?"
              data={needData?.trendOverTime || []}
              color="#f59e0b"
              height={160}
            />
          </div>

          {/* Needs by Product Mapping */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
            <h4 className="text-xs font-semibold text-slate-200 font-sans uppercase tracking-wider">
              Liên kết nhu cầu với sản phẩm
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(needData?.needsByProduct || []).map((np, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 flex flex-col justify-between text-xs"
                >
                  <div>
                    <span className="font-semibold text-slate-200 text-sm">
                      {np.needType.replace(/_/g, ' ')}
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Sản phẩm phù hợp:{' '}
                      <span className="text-blue-400 font-mono">
                        {np.relatedProducts.length > 0
                          ? np.relatedProducts.join(', ')
                          : 'Tư vấn tổng quát'}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800 font-mono text-[11px]">
                    <span className="text-slate-500">Lượng nhu cầu: {np.needCount}</span>
                    <span className="text-emerald-400">Hồ sơ liên quan: {np.associatedCasesCount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 5. PUSH ANALYTICS TAB                                    */}
      {/* ======================================================== */}
      {activeTab === 'push' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <AnalyticsMetricCard
              label="Đề xuất đã tạo"
              value={pushData?.recommendationsGenerated ?? 0}
              subtext="Kết quả từ bộ quy tắc"
              definition="Tổng số cơ hội được phát hiện bởi công cụ quy tắc."
              icon={<Sparkles className="w-4 h-4 text-blue-400" />}
              isLoading={isPushLoading}
              onClick={() => navigate('/push')}
              drillDownLabel="Trung tâm xử lý"
            />
            <AnalyticsMetricCard
              label="Lượt chuyển khách"
              value={pushData?.pushesCreated ?? 0}
              subtext="Nhân viên điều phối"
              definition="Bản ghi chuyển khách đã gửi tới bộ phận chuyên viên."
              icon={<Send className="w-4 h-4 text-purple-400" />}
              isLoading={isPushLoading}
              onClick={() => navigate('/push')}
              drillDownLabel="Xem danh sách chuyển"
            />
            <AnalyticsMetricCard
              label="Tỷ lệ chuyển thành công"
              value={`${pushData?.pushSuccessMetrics.successRateOfTerminalPushes.value ?? 0}%`}
              subtext={`${pushData?.pushSuccessMetrics.successfulPushes ?? 0} trên ${
                pushData?.pushSuccessMetrics.terminalPushes ?? 0
              } đã hoàn tất`}
              definition={
                pushData?.pushSuccessMetrics.successRateOfTerminalPushes.definition
              }
              formula={`${pushData?.pushSuccessMetrics.successRateOfTerminalPushes.numerator} / ${pushData?.pushSuccessMetrics.successRateOfTerminalPushes.denominator}`}
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              trend={{
                value: `${pushData?.pushSuccessMetrics.successRateOfTerminalPushes.value ?? 0}%`,
                isPositive:
                  (pushData?.pushSuccessMetrics.successRateOfTerminalPushes.value ?? 0) >= 50,
              }}
              isLoading={isPushLoading}
            />
            <AnalyticsMetricCard
              label="Tỷ lệ thành công tổng thể"
              value={`${pushData?.pushSuccessMetrics.successRateOfTotalPushes.value ?? 0}%`}
              subtext="Thành công / Tổng số lượt chuyển"
              definition={pushData?.pushSuccessMetrics.successRateOfTotalPushes.definition}
              formula={`${pushData?.pushSuccessMetrics.successRateOfTotalPushes.numerator} / ${pushData?.pushSuccessMetrics.successRateOfTotalPushes.denominator}`}
              icon={<Target className="w-4 h-4 text-indigo-400" />}
              isLoading={isPushLoading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Push Outcome Distribution */}
            <DistributionBar
              title="Kết quả chuyển khách"
              question="Tỷ lệ chuyển đổi tổng thể và tình trạng các lượt chuyển khách ra sao?"
              totalLabel={`Tổng số: ${pushData?.pushesCreated ?? 0}`}
              items={(pushData?.resultDistribution || []).map((s) => ({
                key: s.status,
                label: s.status,
                count: s.count,
                percentage: s.percentage,
                color: getStatusColor(s.status),
              }))}
              onItemClick={() => navigate('/push')}
              drillDownTooltip="Mở Trung tâm xử lý để quản lý các lượt chuyển"
            />

            {/* Push Trend Over Time */}
            <TimeSeriesChart
              title="Lượt chuyển khách theo thời gian"
              question="Tốc độ nhân viên vận hành điều phối cơ hội tới các bộ phận diễn ra như thế nào?"
              data={(pushData?.pushTrendOverTime || []).map((p) => ({
                date: p.date,
                count: p.total,
              }))}
              color="#a855f7"
              height={160}
            />
          </div>

          {/* Referral Failure Feedback */}
          {pushData?.topFailureReasons && pushData.topFailureReasons.length > 0 && (
            <div className="p-4 rounded-xl border border-red-950/60 bg-red-950/20 space-y-2">
              <h4 className="text-xs font-semibold text-red-300 font-sans uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span>Phản hồi thất bại / từ chối tiếp nhận</span>
              </h4>
              <div className="space-y-1.5 pt-1">
                {pushData.topFailureReasons.map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-xs p-2 rounded bg-slate-950/60 border border-red-900/30 font-mono"
                  >
                    <span className="text-slate-300 truncate max-w-xl">{r.reason}</span>
                    <span className="text-red-400 font-bold ml-2">{r.count} lượt chuyển</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AnalyticsPage;
