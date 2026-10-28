import React, { useState, useEffect, useMemo } from 'react';
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
  Filter,
  CheckSquare,
  Square,
  X,
  User,
  RotateCcw,
  UserCheck,
  Search,
  Loader2,
  History,
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
import { useToast } from '../context/ToastContext';
import {
  useFollowUps,
  useUpdateFollowUp,
  useDeleteFollowUp,
  useBulkCompleteFollowUps,
  useBulkDeleteFollowUps,
} from '../hooks/useFollowUps';
import { useEligibleCaregivers } from '../hooks/useCaretakers';
import { followUpService } from '../services/followUpService';
import { FollowUp } from '../types/models';
import { AuthUser } from '../types/auth';
import { categorizeFollowUps } from '../utils/followUpUtils';
import { EditFollowUpModal } from '../features/customers/EditFollowUpModal';
import { ScheduleFollowUpModal } from '../features/customers/ScheduleFollowUpModal';
import { useAuth } from '../context/AuthContext';

export const FollowUpsPage: React.FC = () => {
  const { role } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: caregivers, isLoading: isCaregiversLoading } = useEligibleCaregivers();
  const { toast } = useToast();

  const assignmentScopeParam = (searchParams.get('assignmentScope') as 'all' | 'current' | 'historical') || 'all';
  const [assignmentScope, setAssignmentScope] = useState<'all' | 'current' | 'historical'>(assignmentScopeParam);

  const { data: followUps, isLoading, isError, refetch } = useFollowUps({
    filter: 'all',
    assignmentScope: role === 'PARTNER' ? assignmentScope : undefined,
  });
  const updateFollowUp = useUpdateFollowUp();
  const deleteFollowUp = useDeleteFollowUp();
  const bulkCompleteMutation = useBulkCompleteFollowUps();
  const bulkDeleteMutation = useBulkDeleteFollowUps();

  // Modals state
  const [editingTask, setEditingTask] = useState<FollowUp | null>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  // Bulk actions state
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isBulkCompleteConfirmOpen, setIsBulkCompleteConfirmOpen] = useState(false);
  const [isBulkReopenConfirmOpen, setIsBulkReopenConfirmOpen] = useState(false);
  const [isBulkReassignModalOpen, setIsBulkReassignModalOpen] = useState(false);
  const [selectedBulkCaregiverId, setSelectedBulkCaregiverId] = useState('');
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);

  // Active section tab
  const filterParam = searchParams.get('filter') as 'all' | 'today' | 'overdue' | 'upcoming' | 'completed' | null;
  const initialView = filterParam && ['all', 'today', 'overdue', 'upcoming', 'completed'].includes(filterParam)
    ? filterParam
    : 'all';
  const [sectionView, setSectionView] = useState<'all' | 'today' | 'overdue' | 'upcoming' | 'completed'>(initialView);

  // Status Filter state: 'all' | 'OPEN' | 'COMPLETED'
  const statusParam = (searchParams.get('status') as 'all' | 'OPEN' | 'COMPLETED') || 'all';
  const [statusFilter, setStatusFilter] = useState<'all' | 'OPEN' | 'COMPLETED'>(statusParam);

  // Search query state
  const searchParam = searchParams.get('q') || '';
  const [searchQuery, setSearchQuery] = useState(searchParam);

  // Caretaker filter state (Chăm sóc bởi ai)
  const assignedToParam = searchParams.get('assignedTo') || 'all';
  const [caretakerFilter, setCaretakerFilter] = useState<string>(assignedToParam);

  useEffect(() => {
    if (filterParam && ['all', 'today', 'overdue', 'upcoming', 'completed'].includes(filterParam)) {
      setSectionView(filterParam);
    }
  }, [filterParam]);

  useEffect(() => {
    const currentAssignedTo = searchParams.get('assignedTo') || 'all';
    setCaretakerFilter(currentAssignedTo);
  }, [searchParams]);

  useEffect(() => {
    const currentStatus = (searchParams.get('status') as 'all' | 'OPEN' | 'COMPLETED') || 'all';
    setStatusFilter(currentStatus);
    const currentScope = (searchParams.get('assignmentScope') as 'all' | 'current' | 'historical') || 'all';
    setAssignmentScope(currentScope);
  }, [searchParams]);

  const handleSelectAssignmentScope = (scope: 'all' | 'current' | 'historical') => {
    setAssignmentScope(scope);
    const newParams = new URLSearchParams(searchParams);
    if (scope === 'all') {
      newParams.delete('assignmentScope');
    } else {
      newParams.set('assignmentScope', scope);
    }
    setSearchParams(newParams);
    setSelectedTaskIds([]);
  };

  const handleSelectSection = (view: 'all' | 'today' | 'overdue' | 'upcoming' | 'completed') => {
    setSectionView(view);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('filter', view);
    setSearchParams(newParams);
  };

  const handleSelectStatus = (st: 'all' | 'OPEN' | 'COMPLETED') => {
    setStatusFilter(st);
    const newParams = new URLSearchParams(searchParams);
    if (st === 'all') {
      newParams.delete('status');
    } else {
      newParams.set('status', st);
    }
    setSearchParams(newParams);
    setSelectedTaskIds([]);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    const newParams = new URLSearchParams(searchParams);
    if (!query.trim()) {
      newParams.delete('q');
    } else {
      newParams.set('q', query.trim());
    }
    setSearchParams(newParams);
    setSelectedTaskIds([]);
  };

  const handleSelectCaretaker = (caretaker: string) => {
    setCaretakerFilter(caretaker);
    const newParams = new URLSearchParams(searchParams);
    if (caretaker === 'all') {
      newParams.delete('assignedTo');
    } else {
      newParams.set('assignedTo', caretaker);
    }
    setSearchParams(newParams);
    setSelectedTaskIds([]); // Reset selection when filtering changes
  };

  // Filter tasks by caregiver, status, and search query
  const filteredTasks = useMemo(() => {
    const rawList = followUps || [];
    return rawList.filter((task) => {
      // 1. Caretaker Filter
      if (caretakerFilter !== 'all') {
        if (caretakerFilter === 'unassigned') {
          if (task.assignedTo || task.assignedToUserId) return false;
        } else {
          const match =
            task.assignedToUserId === caretakerFilter ||
            task.assignedTo?.toLowerCase() === caretakerFilter.toLowerCase() ||
            task.assignedToUser?.fullName?.toLowerCase() === caretakerFilter.toLowerCase();
          if (!match) return false;
        }
      }

      // 2. Status Filter
      if (statusFilter === 'OPEN') {
        if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
      } else if (statusFilter === 'COMPLETED') {
        if (task.status !== 'COMPLETED') return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchCustomer = task.customer?.fullName?.toLowerCase().includes(q);
        const matchPhone = task.customer?.phone?.toLowerCase().includes(q);
        const matchTitle = task.title?.toLowerCase().includes(q);
        const matchDesc = task.description?.toLowerCase().includes(q);
        if (!matchCustomer && !matchPhone && !matchTitle && !matchDesc) return false;
      }

      return true;
    });
  }, [followUps, caretakerFilter, statusFilter, searchQuery]);

  // Current caregivers summary for selected tasks
  const currentCaregiversSummary = useMemo(() => {
    const counts: Record<string, number> = {};
    const selectedTasks = (followUps || []).filter((t) => selectedTaskIds.includes(t.id));
    selectedTasks.forEach((t) => {
      const name = t.assignedToUser?.fullName || t.assignedTo || 'Chưa phân công';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => `${name} (${count})`)
      .join(', ');
  }, [followUps, selectedTaskIds]);

  const completedSelectedCount = useMemo(() => {
    return (followUps || []).filter(
      (t) => selectedTaskIds.includes(t.id) && t.status === 'COMPLETED'
    ).length;
  }, [followUps, selectedTaskIds]);

  const { today, overdue, upcoming, completed } = categorizeFollowUps(filteredTasks);

  // Visible tasks in current active section
  const visibleTasks = useMemo(() => {
    switch (sectionView) {
      case 'today':
        return today;
      case 'overdue':
        return overdue;
      case 'upcoming':
        return upcoming;
      case 'completed':
        return completed;
      case 'all':
      default:
        return [...today, ...overdue, ...upcoming, ...completed];
    }
  }, [sectionView, today, overdue, upcoming, completed]);

  // Bulk selection handlers (Partner can only bulk-select currently assigned editable tasks)
  const visibleTaskIds = useMemo(
    () =>
      visibleTasks
        .filter((t) => role === 'ADMIN' || (!t.isHistoricalForMe && t.canEdit !== false))
        .map((t) => t.id),
    [visibleTasks, role]
  );
  const isAllVisibleSelected =
    visibleTaskIds.length > 0 && visibleTaskIds.every((id) => selectedTaskIds.includes(id));

  const handleToggleSelectTask = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (isAllVisibleSelected) {
      setSelectedTaskIds((prev) => prev.filter((id) => !visibleTaskIds.includes(id)));
    } else {
      setSelectedTaskIds((prev) => Array.from(new Set([...prev, ...visibleTaskIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedTaskIds([]);
  };

  const handleToggleStatus = async (task: FollowUp) => {
    const isCompleted = task.status === 'COMPLETED';
    if (isCompleted && role !== 'ADMIN') {
      toast.error('Không có quyền', 'Chỉ Quản trị viên (ADMIN) mới có quyền mở lại lịch chăm sóc đã hoàn thành.');
      return;
    }
    try {
      await updateFollowUp.mutateAsync({
        id: task.id,
        data: {
          status: isCompleted ? 'PENDING' : 'COMPLETED',
          ...(role === 'ADMIN'
            ? { completedAt: isCompleted ? null : new Date().toISOString() }
            : {}),
        },
      });
      toast.success(
        isCompleted
          ? 'Đã mở lại lịch chăm sóc.'
          : 'Đã đánh dấu hoàn thành lịch chăm sóc.'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Không thể cập nhật trạng thái lịch chăm sóc';
      toast.error('Lỗi cập nhật lịch chăm sóc', msg);
    }
  };

  // Bulk Complete execution (ADMIN only)
  const handleExecuteBulkComplete = async () => {
    if (selectedTaskIds.length === 0 || bulkCompleteMutation.isPending) return;
    setIsBulkCompleteConfirmOpen(false);

    try {
      const result = await bulkCompleteMutation.mutateAsync(selectedTaskIds);
      if (result.failed.length === 0) {
        toast.success(`Đã đánh dấu hoàn thành ${result.succeeded.length} lịch chăm sóc.`);
      } else if (result.succeeded.length > 0) {
        const failureDetails = result.failed.map((f) => f.reason).slice(0, 2).join('; ');
        toast.warning(
          `Hoàn thành ${result.succeeded.length}/${result.total} lịch. ${result.failed.length} lịch không thể hoàn thành (${failureDetails}).`
        );
      } else {
        const reason = result.failed[0]?.reason || 'Không thể hoàn thành các lịch đã chọn';
        toast.error('Thao tác không thành công', reason);
      }
      setSelectedTaskIds([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Vui lòng thử lại sau.';
      toast.error('Lỗi khi hoàn thành lịch chăm sóc', msg);
    }
  };

  // Bulk Reopen execution (ADMIN only)
  const handleExecuteBulkReopen = async () => {
    if (selectedTaskIds.length === 0) return;
    setIsBulkReopenConfirmOpen(false);

    try {
      const result = await followUpService.reopenBulkFollowUps(selectedTaskIds);
      if (result.failed.length === 0) {
        toast.success(`Đã mở lại thành công ${result.succeeded.length} lịch chăm sóc.`);
      } else if (result.succeeded.length > 0) {
        const failureDetails = result.failed.map((f) => f.reason).slice(0, 2).join('; ');
        toast.warning(
          `Đã mở lại ${result.succeeded.length}/${result.total} lịch. ${result.failed.length} lịch không thể mở lại (${failureDetails}).`
        );
      } else {
        const reason = result.failed[0]?.reason || 'Không thể mở lại các lịch đã chọn';
        toast.error('Thao tác không thành công', reason);
      }
      setSelectedTaskIds([]);
      refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Vui lòng thử lại sau.';
      toast.error('Lỗi khi mở lại lịch chăm sóc', msg);
    }
  };

  // Bulk Reassign Caregiver execution (ADMIN only)
  const handleExecuteBulkReassign = async () => {
    if (selectedTaskIds.length === 0) return;
    setIsSubmittingReassign(true);

    try {
      const foundCaregiver = caregivers?.find((u) => u.id === selectedBulkCaregiverId);
      const targetName = foundCaregiver ? foundCaregiver.fullName : (selectedBulkCaregiverId === 'unassigned' ? null : null);
      const targetUserId = foundCaregiver ? foundCaregiver.id : null;

      const result = await followUpService.reassignBulkFollowUps({
        ids: selectedTaskIds,
        assignedToUserId: targetUserId,
        assignedTo: targetName,
      });

      if (result.failed.length === 0) {
        toast.success(
          `Đã đổi người chăm sóc cho ${result.succeeded.length} lịch sang "${result.targetCaregiver || 'Chưa phân công'}".`
        );
      } else if (result.succeeded.length > 0) {
        const failureDetails = result.failed.map((f) => f.reason).slice(0, 2).join('; ');
        toast.warning(
          `Đã đổi người chăm sóc cho ${result.succeeded.length}/${result.total} lịch. ${result.failed.length} lịch thất bại (${failureDetails}).`
        );
      } else {
        const reason = result.failed[0]?.reason || 'Không thể đổi người chăm sóc';
        toast.error('Thao tác không thành công', reason);
      }

      setIsBulkReassignModalOpen(false);
      setSelectedBulkCaregiverId('');
      setSelectedTaskIds([]);
      refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Vui lòng thử lại sau.';
      toast.error('Lỗi khi đổi người chăm sóc', msg);
    } finally {
      setIsSubmittingReassign(false);
    }
  };

  // Bulk Delete execution
  const handleExecuteBulkDelete = async () => {
    if (selectedTaskIds.length === 0 || bulkDeleteMutation.isPending) return;
    setIsBulkDeleteConfirmOpen(false);

    try {
      const result = await bulkDeleteMutation.mutateAsync(selectedTaskIds);
      if (result.failed.length === 0) {
        toast.success(`Đã xóa thành công ${result.succeeded.length} lịch chăm sóc.`);
      } else if (result.succeeded.length > 0) {
        const failureDetails = result.failed.map((f) => f.reason).slice(0, 2).join('; ');
        toast.warning(
          `Đã xóa ${result.succeeded.length}/${result.total} lịch. ${result.failed.length} lịch không xóa được (${failureDetails}).`
        );
      } else {
        const reason = result.failed[0]?.reason || 'Không thể xóa các lịch đã chọn';
        toast.error('Không thể xóa lịch', reason);
      }
      setSelectedTaskIds([]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Vui lòng thử lại sau.';
      toast.error('Lỗi khi xóa lịch chăm sóc', msg);
    }
  };

  const renderFollowUpCard = (task: FollowUp, isUrgent = false) => {
    const isDone = task.status === 'COMPLETED';
    const isSelected = selectedTaskIds.includes(task.id);
    const isHistorical =
      role === 'PARTNER' && Boolean(task.isHistoricalForMe || task.assignmentStatus === 'HISTORICAL');
    const canEditTask = role === 'ADMIN' || (!isHistorical && task.canEdit !== false);

    return (
      <div
        key={task.id}
        className={`p-3 rounded-lg border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          isSelected
            ? 'border-blue-600/80 bg-blue-950/20'
            : isDone || isHistorical
            ? 'border-slate-800/80 bg-slate-950/40 opacity-85'
            : isUrgent
            ? 'border-red-900/60 bg-red-950/20 hover:border-red-800/80'
            : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {/* Checkbox for bulk actions */}
          <div className="pt-0.5">
            {canEditTask ? (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleToggleSelectTask(task.id)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                title="Chọn lịch này"
              />
            ) : (
              <div className="w-4 h-4" />
            )}
          </div>

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

              {role === 'PARTNER' && (
                isHistorical ? (
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60 font-semibold flex items-center gap-1"
                    title="Lịch chăm sóc thuộc lịch sử từng được giao cho bạn (đã chuyển giao hoặc kết thúc phân công). Chỉ có quyền xem."
                  >
                    <History className="w-2.5 h-2.5 text-amber-400" />
                    <span>Lịch sử phân công · Chỉ xem</span>
                  </span>
                ) : (
                  <span
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-semibold"
                    title="Lịch chăm sóc hiện đang giao cho bạn phụ trách."
                  >
                    Đang phụ trách
                  </span>
                )
              )}

              {/* Caregiver Indicator: 👤 Name or Chưa phân công */}
              {(task.assignedToUser?.fullName || task.assignedTo) ? (
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800/60 font-semibold flex items-center gap-1"
                  title={`Người chăm sóc hiện tại: ${task.assignedToUser?.fullName || task.assignedTo}`}
                >
                  <User className="w-2.5 h-2.5 text-blue-400" />
                  <span>{task.assignedToUser?.fullName || task.assignedTo}</span>
                </span>
              ) : (
                <span
                  className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800"
                  title="Chưa phân công người chăm sóc"
                >
                  Chưa phân công
                </span>
              )}
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
                className={isUrgent && !isHistorical ? 'text-red-400 font-semibold' : 'text-slate-300'}
              />
              {task.completedAt && (
                <span className="text-emerald-400 text-[10px]">
                  Hoàn thành: <DateDisplay date={task.completedAt} />
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 self-end sm:self-center flex-shrink-0">
          {/* Cả ADMIN và PARTNER đang được giao lịch đều có quyền đánh dấu Hoàn thành; lịch lịch sử/chuyển giao bị ẩn */}
          {!isDone && task.status !== 'CANCELLED' && canEditTask && (
            <Button
              variant="primary"
              size="sm"
              disabled={updateFollowUp.isPending}
              onClick={() => handleToggleStatus(task)}
              className="h-7 px-2.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Hoàn thành</span>
            </Button>
          )}
          {isDone && role === 'ADMIN' && (
            <Button
              variant="outline"
              size="sm"
              disabled={updateFollowUp.isPending}
              onClick={() => handleToggleStatus(task)}
              className="h-7 px-2.5 text-xs font-medium"
            >
              Mở lại
            </Button>
          )}

          {canEditTask && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditingTask(task)}
              className="h-7 w-7 p-0"
              title="Chỉnh sửa lịch chăm sóc"
            >
              <Edit className="w-3 h-3 text-slate-400" />
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/customers/${task.customerId}`)}
            className="h-7 w-7 p-0"
            title="Xem chi tiết khách hàng"
          >
            <ExternalLink className="w-3 h-3 text-blue-400" />
          </Button>

          {role !== 'PARTNER' && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteTaskId(task.id)}
              className="h-7 w-7 p-0"
              title="Xóa lịch chăm sóc"
            >
              <Trash2 className="w-3 h-3 text-red-400" />
            </Button>
          )}
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

      {/* Partner Assignment Scope Tabs (Đang phụ trách vs Lịch sử phân công) */}
      {role === 'PARTNER' && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-lg p-2">
          <div className="flex items-center gap-1.5">
            {(
              [
                { key: 'all', label: 'Tất cả phạm vi' },
                { key: 'current', label: 'Đang phụ trách' },
                { key: 'historical', label: 'Lịch sử phân công (Chỉ xem)' },
              ] as const
            ).map((tab) => {
              const isActive = assignmentScope === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleSelectAssignmentScope(tab.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono transition-all flex items-center gap-1.5 ${
                    isActive
                      ? tab.key === 'historical'
                        ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40 font-semibold'
                        : 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  {tab.key === 'historical' && <History className="w-3.5 h-3.5" />}
                  {tab.key === 'current' && <UserCheck className="w-3.5 h-3.5" />}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          <span className="text-[11px] text-slate-400 font-sans pr-2">
            Lịch chăm sóc đã chuyển giao hoặc thuộc lịch sử phân công chỉ được phép xem, không thể chỉnh sửa hoặc hoàn thành.
          </span>
        </div>
      )}

      {/* Filter Row: Search + Status + Caretaker Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Tìm theo tên khách, SĐT, tiêu đề..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full h-8 pl-8 pr-7 bg-slate-950 border border-slate-800 rounded text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-sans"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => handleSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter (Yêu cầu 4) */}
          <div className="flex items-center gap-1.5 text-xs">
            <label className="text-slate-400 font-mono flex items-center gap-1 shrink-0">
              <Filter className="w-3.5 h-3.5 text-blue-400" />
              <span>Trạng thái:</span>
            </label>
            <select
              value={statusFilter}
              onChange={(e) => handleSelectStatus(e.target.value as any)}
              className="h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="OPEN">Chưa hoàn thành / Đang mở</option>
              <option value="COMPLETED">Đã hoàn thành</option>
            </select>
          </div>

          {/* Chăm sóc bởi ai - Caretaker Filter Dropdown (ADMIN only) */}
          {role !== 'PARTNER' && (
            <div className="flex items-center gap-1.5 text-xs">
              <label className="text-slate-400 font-mono flex items-center gap-1 shrink-0">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span>Người chăm sóc:</span>
              </label>
              <select
                value={caretakerFilter}
                onChange={(e) => handleSelectCaretaker(e.target.value)}
                disabled={isCaregiversLoading}
                className="h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="all">Tất cả người chăm sóc</option>
                <option value="unassigned">Chưa phân công</option>
                {caregivers &&
                  caregivers.map((u: AuthUser) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'})
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Section Filter Switcher */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-950/80 border border-slate-800 rounded-lg text-xs font-mono">
        {[
          { key: 'all', label: `Tất cả (${filteredTasks.length})` },
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

      {/* Bulk Operations Toolbar */}
      {visibleTasks.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-lg border border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
            {/* Select All Checkbox */}
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white font-mono select-none"
            >
              {isAllVisibleSelected ? (
                <CheckSquare className="w-4 h-4 text-blue-400" />
              ) : (
                <Square className="w-4 h-4 text-slate-500" />
              )}
              <span>
                {isAllVisibleSelected
                  ? 'Bỏ chọn tất cả'
                  : `Chọn tất cả đang hiển thị (${visibleTasks.length})`}
              </span>
            </button>

            {selectedTaskIds.length > 0 && (
              <span className="text-xs font-mono font-semibold text-blue-400 px-2 py-0.5 rounded bg-blue-950/80 border border-blue-800/60">
                Đã chọn {selectedTaskIds.length} lịch
              </span>
            )}
          </div>

          {selectedTaskIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {/* 1. Hoàn thành đã chọn (Cho phép cả ADMIN và PARTNER đối với lịch của mình) */}
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsBulkCompleteConfirmOpen(true)}
                disabled={bulkCompleteMutation.isPending || bulkDeleteMutation.isPending}
                className="h-7 px-3 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 font-medium"
                title="Đánh dấu hoàn thành các lịch đã chọn"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Hoàn thành ({selectedTaskIds.length})</span>
              </Button>

              {/* 2. Mở lại lịch chăm sóc (Yêu cầu 2: Chỉ ADMIN) */}
              {role === 'ADMIN' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsBulkReopenConfirmOpen(true)}
                  className="h-7 px-3 text-xs border-amber-600/80 text-amber-300 hover:bg-amber-950/40 gap-1.5 font-medium"
                  title="Mở lại các lịch chăm sóc đã hoàn thành về trạng thái Chưa hoàn thành"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mở lại ({completedSelectedCount > 0 ? completedSelectedCount : selectedTaskIds.length})</span>
                </Button>
              )}

              {/* 3. Đổi người chăm sóc (Yêu cầu 3: Chỉ ADMIN) */}
              {role === 'ADMIN' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedBulkCaregiverId('');
                    setIsBulkReassignModalOpen(true);
                  }}
                  className="h-7 px-3 text-xs border-blue-600/80 text-blue-300 hover:bg-blue-950/40 gap-1.5 font-medium"
                  title="Đổi người chăm sóc hàng loạt cho các lịch đã chọn"
                >
                  <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Đổi người chăm sóc ({selectedTaskIds.length})</span>
                </Button>
              )}

              {/* 4. Xóa lịch đã chọn */}
              {role !== 'PARTNER' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setIsBulkDeleteConfirmOpen(true)}
                  disabled={bulkCompleteMutation.isPending || bulkDeleteMutation.isPending}
                  className="h-7 px-3 text-xs gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa ({selectedTaskIds.length})</span>
                </Button>
              )}

              <button
                type="button"
                onClick={handleClearSelection}
                className="p-1 rounded text-slate-400 hover:text-slate-200"
                title="Hủy chọn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

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
      />

      {/* Single Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteTaskId)}
        title="Xóa lịch chăm sóc"
        message="Bạn có chắc chắn muốn xóa lịch chăm sóc này? Lưu ý: Nếu lịch đã hoàn thành, lịch sử chăm sóc thực tế của khách hàng sẽ được bảo lưu và không thể xóa."
        isDestructive
        confirmLabel="Xác nhận xóa"
        onConfirm={async () => {
          if (deleteTaskId) {
            try {
              await deleteFollowUp.mutateAsync(deleteTaskId);
              toast.success('Đã xóa lịch chăm sóc thành công');
              setDeleteTaskId(null);
            } catch (err) {
              const msg = err instanceof Error ? err.message : 'Lỗi khi xóa lịch chăm sóc';
              toast.error('Không thể xóa lịch chăm sóc', msg);
              setDeleteTaskId(null);
            }
          }
        }}
        onCancel={() => setDeleteTaskId(null)}
      />

      {/* Bulk Complete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isBulkCompleteConfirmOpen}
        title="Hoàn thành lịch chăm sóc hàng loạt"
        message={`Bạn có chắc chắn muốn đánh dấu hoàn thành ${selectedTaskIds.length} lịch chăm sóc đã chọn? Các lịch đã hủy hoặc không hợp lệ sẽ không được tự động hoàn thành.`}
        confirmLabel="Xác nhận hoàn thành"
        onConfirm={handleExecuteBulkComplete}
        onCancel={() => setIsBulkCompleteConfirmOpen(false)}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isBulkDeleteConfirmOpen}
        title="Xóa lịch chăm sóc hàng loạt"
        message={`Bạn có chắc chắn muốn xóa ${selectedTaskIds.length} lịch chăm sóc đã chọn? Các lịch đã hoàn thành sẽ được bảo lưu để giữ nguyên lịch sử chăm sóc thực tế của khách hàng.`}
        isDestructive
        confirmLabel="Xác nhận xóa"
        onConfirm={handleExecuteBulkDelete}
        onCancel={() => setIsBulkDeleteConfirmOpen(false)}
      />

      {/* Bulk Reopen Confirmation Dialog (Yêu cầu 2) */}
      <ConfirmDialog
        isOpen={isBulkReopenConfirmOpen}
        title="Mở lại lịch chăm sóc hàng loạt"
        message={`Bạn có chắc chắn muốn mở lại ${
          completedSelectedCount > 0 ? completedSelectedCount : selectedTaskIds.length
        } lịch chăm sóc đã hoàn thành trong số ${
          selectedTaskIds.length
        } lịch được chọn? Sau khi mở lại, trạng thái sẽ chuyển về Chưa hoàn thành (PENDING) để tiếp tục theo dõi, mọi lịch sử trao đổi và ghi chú vẫn được bảo lưu toàn vẹn.`}
        confirmLabel="Xác nhận mở lại"
        onConfirm={handleExecuteBulkReopen}
        onCancel={() => setIsBulkReopenConfirmOpen(false)}
      />

      {/* Bulk Reassign Caregiver Modal (Yêu cầu 3) */}
      {isBulkReassignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 font-mono">
                    Đổi người chăm sóc hàng loạt
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Phân công lại nhân viên phụ trách cho các lịch chăm sóc đã chọn
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkReassignModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-3.5 text-xs">
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800 space-y-1.5 font-mono">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Số lịch bị ảnh hưởng:</span>
                  <span className="font-bold text-blue-400 px-1.5 py-0.5 rounded bg-blue-950/80 border border-blue-800/60">
                    {selectedTaskIds.length} lịch
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                  <span className="text-slate-500">Người chăm sóc hiện tại: </span>
                  <span className="text-slate-200">{currentCaregiversSummary || 'Chưa phân công'}</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1.5">
                  Chọn người chăm sóc mới
                </label>
                <select
                  value={selectedBulkCaregiverId}
                  onChange={(e) => setSelectedBulkCaregiverId(e.target.value)}
                  disabled={isCaregiversLoading || isSubmittingReassign}
                  className="w-full h-9 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-medium focus:outline-none focus:border-blue-500"
                >
                  <option value="">-- Chưa phân công (Bỏ người chăm sóc) --</option>
                  {caregivers &&
                    caregivers.map((u: AuthUser) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Hệ thống sẽ cập nhật người phụ trách cho toàn bộ các lịch đã chọn và tự động đồng bộ quyền truy cập khách hàng.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 p-3 bg-slate-950/80 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsBulkReassignModalOpen(false)}
                disabled={isSubmittingReassign}
                className="text-xs h-8"
              >
                Hủy
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleExecuteBulkReassign}
                disabled={isSubmittingReassign}
                className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white gap-1.5 font-medium"
              >
                {isSubmittingReassign ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <UserCheck className="w-3.5 h-3.5" />
                )}
                <span>Xác nhận đổi người chăm sóc</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowUpsPage;
