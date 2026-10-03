import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Edit,
  Trash2,
  Plus,
} from 'lucide-react';
import {
  PageHeader,
  StatCard,
  StatusBadge,
  DateDisplay,
  EmptyState,
  LoadingState,
  ErrorState,
  ConfirmDialog,
} from '../components/common';
import { Skeleton, CardSkeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { useFollowUps, useUpdateFollowUp, useDeleteFollowUp } from '../hooks/useFollowUps';
import { FollowUp } from '../types/models';
import { categorizeFollowUps } from '../utils/followUpUtils';
import { EditFollowUpModal } from '../features/customers/EditFollowUpModal';
import { ScheduleFollowUpModal } from '../features/customers/ScheduleFollowUpModal';

export const FollowUpsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: followUps, isLoading, isError, refetch } = useFollowUps({ filter: 'all' });
  const updateFollowUp = useUpdateFollowUp();
  const deleteFollowUp = useDeleteFollowUp();

  // Modals state
  const [editingTask, setEditingTask] = useState<FollowUp | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  // Active section tab or show all sections
  const filterParam = searchParams.get('filter') as 'all' | 'today' | 'overdue' | 'upcoming' | 'completed' | null;
  const initialView = filterParam && ['all', 'today', 'overdue', 'upcoming', 'completed'].includes(filterParam)
    ? filterParam
    : 'all';
  const [sectionView, setSectionView] = useState<'all' | 'today' | 'overdue' | 'upcoming' | 'completed'>(initialView);

  React.useEffect(() => {
    if (filterParam && ['all', 'today', 'overdue', 'upcoming', 'completed'].includes(filterParam)) {
      setSectionView(filterParam);
    }
  }, [filterParam]);

  const handleSelectSection = (view: 'all' | 'today' | 'overdue' | 'upcoming' | 'completed') => {
    setSectionView(view);
    setSearchParams({ filter: view });
  };

  const allTasks = followUps || [];
  const { today, overdue, upcoming, completed } = categorizeFollowUps(allTasks);

  const handleToggleStatus = async (task: FollowUp) => {
    const isCompleted = task.status === 'COMPLETED';
    await updateFollowUp.mutateAsync({
      id: task.id,
      data: {
        status: isCompleted ? 'PENDING' : 'COMPLETED',
        completedAt: isCompleted ? null : new Date().toISOString(),
      },
    });
  };

  const renderFollowUpCard = (task: FollowUp, isUrgent = false) => {
    const isDone = task.status === 'COMPLETED';

    return (
      <div
        key={task.id}
        className={`p-3 rounded-lg border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          isDone
            ? 'border-slate-800/80 bg-slate-950/40 opacity-75'
            : isUrgent
            ? 'border-red-900/60 bg-red-950/20 hover:border-red-800/80'
            : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
        }`}
      >
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              onClick={() => navigate(`/customers/${task.customerId}`)}
              className="text-xs font-semibold text-slate-100 hover:text-blue-400 cursor-pointer transition-colors"
            >
              {task.customer?.fullName || 'Khách hàng'}
            </span>
            {task.customer?.phone && (
              <span className="text-[10px] font-mono text-slate-500">
                ({task.customer.phone})
              </span>
            )}
            <StatusBadge status={task.status} />
          </div>

          <h4
            className={`text-xs font-medium ${
              isDone ? 'line-through text-slate-500' : 'text-slate-200'
            }`}
          >
            {task.title}
          </h4>

          {task.description && (
            <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[11px] font-mono">
            <span className="text-slate-500">Hạn:</span>
            <DateDisplay
              date={task.dueAt}
              showTime
              relativeContext
              className={isUrgent ? 'text-red-400 font-semibold' : 'text-slate-300'}
            />
            {task.completedAt && (
              <span className="text-emerald-400 text-[10px]">
                Hoàn thành: <DateDisplay date={task.completedAt} />
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 self-end sm:self-center flex-shrink-0">
          <Button
            variant={isDone ? 'outline' : 'primary'}
            size="sm"
            onClick={() => handleToggleStatus(task)}
            className={`h-7 px-2.5 text-xs font-medium ${
              !isDone ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : ''
            }`}
          >
            {isDone ? 'Mở lại' : 'Hoàn thành'}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditingTask(task)}
            className="h-7 w-7 p-0"
            title="Chỉnh sửa lịch chăm sóc"
          >
            <Edit className="w-3 h-3 text-slate-400" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/customers/${task.customerId}`)}
            className="h-7 w-7 p-0"
            title="Xem chi tiết khách hàng"
          >
            <ExternalLink className="w-3 h-3 text-blue-400" />
          </Button>

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteTaskId(task.id)}
            className="h-7 w-7 p-0"
            title="Xóa lịch chăm sóc"
          >
            <Trash2 className="w-3 h-3 text-red-400" />
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto">
        <PageHeader
          title="Lịch chăm sóc"
          category="Vận hành"
          description="Danh sách công việc chăm sóc khách hàng phân loại theo mức độ ưu tiên và thời gian."
        />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3.5 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>
        <CardSkeleton count={3} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto">
        <PageHeader
          title="Lịch chăm sóc"
          category="Vận hành"
          description="Danh sách công việc chăm sóc khách hàng phân loại theo mức độ ưu tiên và thời gian."
        />
        <ErrorState
          title="Không thể tải lịch chăm sóc"
          description="Không thể kết nối đến dịch vụ chăm sóc khách hàng."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="Lịch chăm sóc"
        category="Vận hành"
        description="Danh sách công việc chăm sóc khách hàng phân loại theo mức độ ưu tiên và thời gian."
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
              onClick={() => setIsScheduleOpen(true)}
              className="text-xs h-8 gap-1.5 bg-amber-600 hover:bg-amber-500 text-white"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Lên lịch chăm sóc</span>
            </Button>
          </div>
        }
      />

      {/* Urgency Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Hôm nay"
          value={today.length}
          subtext="Cần liên hệ ngay"
          icon={<Clock className="w-4 h-4 text-amber-400" />}
          isLoading={isLoading}
          onClick={() => handleSelectSection('today')}
        />
        <StatCard
          label="Quá hạn"
          value={overdue.length}
          subtext={overdue.length > 0 ? 'Cần xử lý khẩn cấp' : 'Đúng tiến độ'}
          trend={overdue.length > 0 ? { value: `${overdue.length} Quá hạn`, isPositive: false } : undefined}
          icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
          isLoading={isLoading}
          onClick={() => handleSelectSection('overdue')}
        />
        <StatCard
          label="Sắp tới"
          value={upcoming.length}
          subtext="Kế hoạch liên hệ tiếp theo"
          icon={<CalendarCheck className="w-4 h-4 text-blue-400" />}
          isLoading={isLoading}
          onClick={() => handleSelectSection('upcoming')}
        />
        <StatCard
          label="Đã hoàn thành"
          value={completed.length}
          subtext="Lịch sử chăm sóc đã lưu"
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          isLoading={isLoading}
          onClick={() => handleSelectSection('completed')}
        />
      </div>

      {/* Section Filter Switcher */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono w-fit">
        {[
          { key: 'all', label: `Tất cả (${allTasks.length})` },
          { key: 'today', label: `Hôm nay (${today.length})` },
          { key: 'overdue', label: `Quá hạn (${overdue.length})` },
          { key: 'upcoming', label: `Sắp tới (${upcoming.length})` },
          { key: 'completed', label: `Đã hoàn thành (${completed.length})` },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => handleSelectSection(t.key as typeof sectionView)}
            className={`px-3 py-1.5 rounded transition-colors ${
              sectionView === t.key
                ? 'bg-blue-600 text-white font-medium shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-8">
          <LoadingState message="Đang tải danh sách lịch chăm sóc..." />
        </div>
      ) : (
        <div className="space-y-5">
          {/* SECTION 1: TODAY */}
          {(sectionView === 'all' || sectionView === 'today') && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                    Lịch chăm sóc hôm nay ({today.length})
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Cần hoàn thành trong ngày hôm nay
                </span>
              </div>

              {today.length === 0 ? (
                <EmptyState
                  title="Không có công việc đến hạn hôm nay"
                  description="Lịch trình công việc hôm nay đã hoàn tất hoặc chưa có nhiệm vụ mới."
                  actionLabel="+ Lên lịch chăm sóc"
                  onAction={() => setIsScheduleOpen(true)}
                />
              ) : (
                <div className="space-y-2">
                  {today.map((task) => renderFollowUpCard(task))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 2: OVERDUE */}
          {(sectionView === 'all' || sectionView === 'overdue') && (
            <div className="rounded-lg border border-red-900/40 bg-red-950/10 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-red-900/40">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-red-300 font-mono">
                    Lịch chăm sóc quá hạn ({overdue.length})
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-red-400">
                  Đã vượt quá ngày giờ dự kiến
                </span>
              </div>

              {overdue.length === 0 ? (
                <EmptyState
                  title="Không có công việc quá hạn"
                  description="Rất tốt! Không có nhiệm vụ nào bị quá hạn xử lý."
                />
              ) : (
                <div className="space-y-2">
                  {overdue.map((task) => renderFollowUpCard(task, true))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 3: UPCOMING */}
          {(sectionView === 'all' || sectionView === 'upcoming') && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="w-4 h-4 text-blue-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                    Lịch chăm sóc sắp tới ({upcoming.length})
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Lên lịch cho các ngày tới
                </span>
              </div>

              {upcoming.length === 0 ? (
                <EmptyState
                  title="Không có công việc sắp tới"
                  description="Hiện chưa có lịch chăm sóc nào được lên cho các ngày tới."
                  actionLabel="+ Lên lịch chăm sóc"
                  onAction={() => setIsScheduleOpen(true)}
                />
              ) : (
                <div className="space-y-2">
                  {upcoming.map((task) => renderFollowUpCard(task))}
                </div>
              )}
            </div>
          )}

          {/* SECTION 4: RECENTLY COMPLETED */}
          {(sectionView === 'all' || sectionView === 'completed') && (
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                    Mới hoàn thành gần đây ({completed.length})
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Lịch sử công việc đã xử lý (được lưu trữ đầy đủ)
                </span>
              </div>

              {completed.length === 0 ? (
                <EmptyState
                  title="Chưa có công việc hoàn thành"
                  description="Các công việc đã hoàn tất sẽ hiển thị tại đây để phục vụ tra cứu lịch sử."
                />
              ) : (
                <div className="space-y-2">
                  {completed.map((task) => renderFollowUpCard(task))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Edit Follow-up Modal */}
      <EditFollowUpModal
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
        followUp={editingTask}
      />

      {/* Schedule Follow-up Modal */}
      <ScheduleFollowUpModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        customerId={allTasks[0]?.customerId || ''}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTaskId)}
        title="Xóa lịch chăm sóc"
        message="Bạn có chắc chắn muốn xóa vĩnh viễn bản ghi lịch chăm sóc này không?"
        isDestructive
        confirmLabel="Xác nhận xóa"
        onConfirm={async () => {
          if (deleteTaskId) {
            await deleteFollowUp.mutateAsync(deleteTaskId);
            setDeleteTaskId(null);
          }
        }}
        onCancel={() => setDeleteTaskId(null)}
      />
    </div>
  );
};

export default FollowUpsPage;
