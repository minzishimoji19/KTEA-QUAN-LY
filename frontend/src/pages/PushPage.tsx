import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Send,
  CheckCircle2,
  Clock,
  Sparkles,
  RefreshCw,
  Flame,
  CheckSquare,
  History,
  ExternalLink,
  Edit3,
} from 'lucide-react';
import {
  PageHeader,
  StatCard,
  DataTable,
  Column,
  StatusBadge,
  DateDisplay,
  EmptyState,
} from '../components/common';
import { Button } from '../components/ui/Button';
import {
  useRecommendations,
  useGenerateRecommendations,
  useReviewRecommendation,
  useDismissRecommendation,
  useConvertToPush,
} from '../hooks/useRecommendations';
import { usePushRecords, useUpdatePushRecord } from '../hooks/usePushRecords';
import { useProducts } from '../hooks/useProducts';
import { Recommendation, PushRecord } from '../types/models';
import { RecommendationCard } from '../features/push/RecommendationCard';
import { PushModal } from '../features/push/PushModal';
import { PushOutcomeModal } from '../features/push/PushOutcomeModal';

export const PushPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State
  type TabType = 'new' | 'high_priority' | 'reviewed' | 'recently_pushed' | 'results';
  const tabParam = searchParams.get('tab') as TabType | null;
  const initialTab: TabType =
    tabParam && ['new', 'high_priority', 'reviewed', 'recently_pushed', 'results'].includes(tabParam)
      ? tabParam
      : 'new';

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  useEffect(() => {
    if (tabParam && ['new', 'high_priority', 'reviewed', 'recently_pushed', 'results'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Queries
  const {
    data: allRecommendations,
    isLoading: isRecsLoading,
    refetch: refetchRecs,
  } = useRecommendations();

  const {
    data: allPushes,
    isLoading: isPushesLoading,
    refetch: refetchPushes,
  } = usePushRecords();

  const { data: products } = useProducts();

  // Mutations
  const generateMutation = useGenerateRecommendations();
  const reviewMutation = useReviewRecommendation();
  const dismissMutation = useDismissRecommendation();
  const pushMutation = useConvertToPush();
  const updatePushMutation = useUpdatePushRecord();

  // Modal State
  const [pushingRec, setPushingRec] = useState<Recommendation | null>(null);
  const [editingPush, setEditingPush] = useState<PushRecord | null>(null);

  const recList = allRecommendations || [];
  const pushList = allPushes || [];

  // Filtered Recommendation subsets
  const newRecs = recList.filter(
    (r) => r.status === 'NEW' || r.status === 'ACTIVE'
  );
  const highPriorityRecs = recList.filter(
    (r) =>
      (r.status === 'NEW' || r.status === 'REVIEWED' || r.status === 'ACTIVE') &&
      Number(r.score) >= 80
  );
  const reviewedRecs = recList.filter((r) => r.status === 'REVIEWED');

  // Filtered Push subsets
  const inFlightPushes = pushList.filter(
    (p) => p.status === 'PENDING' || p.status === 'IN_PROGRESS'
  );
  const completedPushes = pushList.filter(
    (p) =>
      p.status === 'SUCCESS' || p.status === 'FAILED' || p.status === 'CANCELLED'
  );

  // Success metrics
  const successfulPushesCount = pushList.filter((p) => p.status === 'SUCCESS').length;
  const terminalPushesCount = pushList.filter(
    (p) => p.status === 'SUCCESS' || p.status === 'FAILED'
  ).length;

  const handleReview = async (rec: Recommendation) => {
    await reviewMutation.mutateAsync(rec.id);
  };

  const handleDismiss = async (rec: Recommendation) => {
    await dismissMutation.mutateAsync(rec.id);
  };

  const handleOpenPushModal = (rec: Recommendation) => {
    setPushingRec(rec);
  };

  const handleConfirmPush = async (data: {
    targetProductId: string;
    note?: string;
  }) => {
    if (!pushingRec) return;
    await pushMutation.mutateAsync({
      id: pushingRec.id,
      data,
    });
    setPushingRec(null);
    setActiveTab('recently_pushed');
  };

  const handleConfirmOutcome = async (data: {
    status: any;
    failureReason?: string;
    note?: string;
  }) => {
    if (!editingPush) return;
    await updatePushMutation.mutateAsync({
      id: editingPush.id,
      data: {
        status: data.status,
        failureReason: data.failureReason,
        note: data.note,
        resultAt: new Date().toISOString(),
      },
    });
    setEditingPush(null);
  };

  const handleRunEngine = async () => {
    await generateMutation.mutateAsync(undefined);
  };

  // Push Table Columns for Recently Pushed & Push Results
  const pushColumns: Column<PushRecord>[] = [
    {
      key: 'customer',
      header: 'Khách hàng',
      render: (row) => (
        <div className="flex flex-col min-w-0">
          <span
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/customers/${row.customerId}`);
            }}
            className="font-semibold text-slate-100 hover:text-blue-400 cursor-pointer transition-colors text-xs truncate"
          >
            {row.customer?.fullName || 'Hồ sơ khách hàng'}
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            {row.customer?.phone || row.customerId}
          </span>
        </div>
      ),
    },
    {
      key: 'product',
      header: 'Sản phẩm đề xuất',
      render: (row) => (
        <div className="flex flex-col min-w-0">
          <span className="font-medium text-slate-200 text-xs truncate">
            {row.targetProduct?.name || 'Sản phẩm tài chính'}
          </span>
          <span className="text-[10px] font-mono text-blue-400">
            {row.targetProduct?.code || '--'}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '120px',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'pushedAt',
      header: 'Thời gian chuyển',
      width: '140px',
      render: (row) => (
        <DateDisplay date={row.pushedAt} relativeContext className="text-xs" />
      ),
    },
    {
      key: 'result',
      header: 'Kết quả / Lý do từ chối',
      render: (row) => {
        if (row.status === 'FAILED') {
          return (
            <span
              className="text-red-400 text-xs truncate block max-w-xs font-mono"
              title={row.failureReason || 'Thất bại'}
            >
              Từ chối: {row.failureReason || 'Không có lý do'}
            </span>
          );
        }
        if (row.status === 'SUCCESS') {
          return (
            <span className="text-emerald-400 text-xs font-mono truncate block">
              Chuyển đổi thành công
            </span>
          );
        }
        return (
          <span className="text-slate-400 text-xs truncate block max-w-xs">
            {row.note || 'Đang xử lý tại bộ phận chuyên viên'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Thao tác',
      align: 'right',
      width: '150px',
      render: (row) => (
        <div
          className="flex items-center justify-end gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingPush(row)}
            className="h-7 text-xs px-2 gap-1 text-slate-300 hover:text-white hover:border-slate-600"
            title="Cập nhật kết quả chuyển khách"
          >
            <Edit3 className="w-3 h-3 text-blue-400" />
            <span>Cập nhật</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/customers/${row.customerId}`)}
            className="h-7 w-7 p-0"
            title="Xem chi tiết khách hàng"
          >
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="Trung tâm xử lý khách"
        category="Đề xuất & Xử lý"
        description="Cơ hội khách hàng từ hệ thống quy tắc, điều phối chuyển khách và theo dõi kết quả chuyển đổi."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchRecs();
                refetchPushes();
              }}
              className="text-xs h-8 gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              <span>Làm mới</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleRunEngine}
              disabled={generateMutation.isPending}
              className="text-xs h-8 gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {generateMutation.isPending
                  ? 'Đang đánh giá quy tắc...'
                  : 'Chạy bộ quy tắc đề xuất'}
              </span>
            </Button>
          </div>
        }
      />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <StatCard
          label="Cơ hội mới"
          value={newRecs.length}
          subtext="Đề xuất chờ nhân viên xử lý"
          icon={<Sparkles className="w-4 h-4 text-blue-400" />}
          isLoading={isRecsLoading}
          onClick={() => handleSelectTab('new')}
        />
        <StatCard
          label="Ưu tiên cao (80+)"
          value={highPriorityRecs.length}
          subtext="Tín hiệu nhu cầu rõ ràng"
          icon={<Flame className="w-4 h-4 text-rose-400" />}
          isLoading={isRecsLoading}
          onClick={() => handleSelectTab('high_priority')}
        />
        <StatCard
          label="Đang xử lý chuyển khách"
          value={inFlightPushes.length}
          subtext="Chờ chuyên viên liên hệ"
          icon={<Clock className="w-4 h-4 text-amber-400" />}
          isLoading={isPushesLoading}
          onClick={() => handleSelectTab('recently_pushed')}
        />
        <StatCard
          label="Chuyển đổi thành công"
          value={successfulPushesCount}
          subtext={
            terminalPushesCount > 0
              ? `${Math.round(
                  (successfulPushesCount / terminalPushesCount) * 100
                )}% trong số đã xử lý (${successfulPushesCount}/${terminalPushesCount})`
              : 'Chưa có lượt chuyển xử lý xong'
          }
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          isLoading={isPushesLoading}
          onClick={() => handleSelectTab('results')}
        />
      </div>

      {/* Workflow Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => handleSelectTab('new')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'new'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Đề xuất mới ({newRecs.length})</span>
        </button>

        <button
          onClick={() => handleSelectTab('high_priority')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'high_priority'
              ? 'bg-rose-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Flame className="w-3.5 h-3.5 text-rose-300" />
          <span>Ưu tiên cao ({highPriorityRecs.length})</span>
        </button>

        <button
          onClick={() => handleSelectTab('reviewed')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'reviewed'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>Đã xem xét ({reviewedRecs.length})</span>
        </button>

        <button
          onClick={() => handleSelectTab('recently_pushed')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'recently_pushed'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Đang xử lý chuyển khách ({inFlightPushes.length})</span>
        </button>

        <button
          onClick={() => handleSelectTab('results')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === 'results'
              ? 'bg-blue-600 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>Lịch sử chuyển khách ({completedPushes.length})</span>
        </button>
      </div>

      {/* TAB 1: NEW RECOMMENDATIONS */}
      {activeTab === 'new' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Cơ hội từ quy tắc hệ thống chờ nhân viên đánh giá và xử lý.
            </span>
            <span className="font-mono">{newRecs.length} đề xuất</span>
          </div>

          {newRecs.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8">
              <EmptyState
                icon={<Sparkles className="w-8 h-8 text-blue-400" />}
                title="Không có đề xuất mới"
                description="Tất cả hồ sơ khách hàng đã được xem xét hoặc chưa phát hiện thêm tín hiệu mới. Nhấn 'Chạy bộ quy tắc đề xuất' phía trên để quét lại toàn bộ dữ liệu."
                actionLabel="Chạy bộ quy tắc đề xuất"
                onAction={handleRunEngine}
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {newRecs.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onReview={handleReview}
                  onDismiss={handleDismiss}
                  onPush={handleOpenPushModal}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HIGH PRIORITY */}
      {activeTab === 'high_priority' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Cơ hội hàng đầu có điểm từ 80 trở lên dựa trên tương tác gần đây và nhu cầu phù hợp.
            </span>
            <span className="font-mono">{highPriorityRecs.length} đề xuất</span>
          </div>

          {highPriorityRecs.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8">
              <EmptyState
                icon={<Flame className="w-8 h-8 text-rose-400" />}
                title="Không có đề xuất ưu tiên cao"
                description="Hiện không có cơ hội nào đạt điểm từ 80 trở lên. Vui lòng chuyển sang tab 'Đề xuất mới' để xem toàn bộ danh sách."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {highPriorityRecs.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onReview={handleReview}
                  onDismiss={handleDismiss}
                  onPush={handleOpenPushModal}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REVIEWED QUEUE */}
      {activeTab === 'reviewed' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Các đề xuất đã được xem xét và lên kế hoạch liên hệ hoặc chuyển chuyên viên sau.
            </span>
            <span className="font-mono">{reviewedRecs.length} đề xuất</span>
          </div>

          {reviewedRecs.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8">
              <EmptyState
                icon={<CheckSquare className="w-8 h-8 text-slate-400" />}
                title="Chưa có đề xuất đã xem xét"
                description="Bạn chưa đánh dấu đề xuất nào là 'Đã xem xét'. Nhấn 'Xem xét' trên thẻ đề xuất mới để lưu vào hàng đợi này."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {reviewedRecs.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onDismiss={handleDismiss}
                  onPush={handleOpenPushModal}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: RECENTLY PUSHED */}
      {activeTab === 'recently_pushed' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Danh sách khách hàng đang được chuyển tới chuyên viên để tư vấn và hoàn thiện thủ tục.
            </span>
            <span className="font-mono">{inFlightPushes.length} đang xử lý</span>
          </div>

          <DataTable
            columns={pushColumns}
            data={inFlightPushes}
            keyExtractor={(row) => row.id}
            isLoading={isPushesLoading}
            isEmpty={inFlightPushes.length === 0}
            emptyTitle="Chưa có lượt chuyển khách đang xử lý"
            emptyDescription="Hiện không có hồ sơ nào ở trạng thái Đang chờ xử lý hoặc Đang xử lý. Hãy chuyển khách từ danh sách đề xuất để bắt đầu quy trình."
            onRowClick={(row) => setEditingPush(row)}
          />
        </div>
      )}

      {/* TAB 5: PUSH RESULTS */}
      {activeTab === 'results' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Nhật ký kết quả tiếp nhận khách hàng. Theo dõi tỷ lệ chuyển đổi thành công, lý do từ chối hoặc hủy hồ sơ.
            </span>
            <span className="font-mono">{completedPushes.length} đã hoàn tất</span>
          </div>

          <DataTable
            columns={pushColumns}
            data={completedPushes}
            keyExtractor={(row) => row.id}
            isLoading={isPushesLoading}
            isEmpty={completedPushes.length === 0}
            emptyTitle="Chưa có lịch sử kết quả chuyển khách"
            emptyDescription="Chưa có lượt chuyển khách nào có kết quả xử lý cuối cùng."
            onRowClick={(row) => setEditingPush(row)}
          />
        </div>
      )}

      {/* Push Confirmation Modal */}
      <PushModal
        isOpen={Boolean(pushingRec)}
        recommendation={pushingRec}
        products={products || []}
        isLoading={pushMutation.isPending}
        onClose={() => setPushingRec(null)}
        onConfirm={handleConfirmPush}
      />

      {/* Push Outcome Edit Modal */}
      <PushOutcomeModal
        isOpen={Boolean(editingPush)}
        pushRecord={editingPush}
        isLoading={updatePushMutation.isPending}
        onClose={() => setEditingPush(null)}
        onConfirm={handleConfirmOutcome}
      />
    </div>
  );
};

export default PushPage;
