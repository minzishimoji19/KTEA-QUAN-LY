import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Clock,
  AlertTriangle,
  Sparkles,
  Send,
  Briefcase,
  Plus,
  Upload,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Flame,
  Activity,
  CalendarCheck,
  UserCheck,
} from 'lucide-react';
import {
  PageHeader,
  StatCard,
  StatusBadge,
  DateDisplay,
  ErrorState,
  EmptyState,
} from '../components/common';
import { Skeleton, CardSkeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { useDashboard, DASHBOARD_QUERY_KEY } from '../hooks/useDashboard';
import { useUpdateFollowUp } from '../hooks/useFollowUps';
import { DashboardFollowUp } from '../types/dashboard';
import { CreateCustomerModal } from '../features/customers/CreateCustomerModal';
import { QuickFollowUpModal } from '../features/dashboard/QuickFollowUpModal';
import { ImportDataModal } from '../features/dashboard/ImportDataModal';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Primary aggregated query
  const { data, isLoading, isError, refetch, isRefetching } = useDashboard();
  const updateFollowUp = useUpdateFollowUp();

  // Quick Action Modal states
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isQuickFollowUpOpen, setIsQuickFollowUpOpen] = useState(false);

  // Optimistic follow-up toggle
  const handleToggleFollowUp = async (task: DashboardFollowUp) => {
    const isCompleted = task.status === 'COMPLETED';
    await updateFollowUp.mutateAsync({
      id: task.id,
      data: {
        status: isCompleted ? 'PENDING' : 'COMPLETED',
        completedAt: isCompleted ? null : new Date().toISOString(),
      },
    });
    queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
  };

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto py-6">
        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-8 w-72" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
        {/* Two column card skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CardSkeleton count={2} />
          <CardSkeleton count={2} />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto py-10">
        <PageHeader
          title="Bảng điều khiển vận hành"
          category="Không gian làm việc"
          description="Nhiệm vụ cần ưu tiên xử lý ngay trong ngày."
        />
        <ErrorState
          title="Không thể tải bảng tổng quan vận hành"
          description="Không thể đồng bộ dữ liệu từ máy chủ. Vui lòng kiểm tra kết nối mạng và thử lại."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  const {
    overview,
    criticalToday,
    highPotentialCustomers,
    newRecommendations,
    recentActivities,
  } = data;

  const overdueList = criticalToday?.overdueFollowUps || [];
  const todayList = criticalToday?.todayFollowUps || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* ========================================================================= */}
      {/* 0. HEADER & QUICK ACTION TOOLBAR                                          */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase tracking-wider text-blue-400 font-semibold px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800/50">
              Không gian vận hành
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Dữ liệu thời gian thực
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Nhiệm vụ cần ưu tiên xử lý ngay
          </h1>
        </div>

        {/* 7. QUICK ACTIONS TOOLBAR */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="h-8 text-xs border-slate-700 hover:bg-slate-800 gap-1.5"
            title="Đồng bộ dữ liệu bảng điều khiển"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${isRefetching ? 'animate-spin' : ''}`} />
            <span>Đồng bộ</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportOpen(true)}
            className="h-8 text-xs border-slate-700 hover:bg-slate-800 gap-1.5 text-slate-300"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Nhập dữ liệu</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsQuickFollowUpOpen(true)}
            className="h-8 text-xs border-slate-700 hover:bg-slate-800 gap-1.5 text-slate-200"
          >
            <CalendarCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Đặt lịch chăm sóc</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/push?tab=new')}
            className="h-8 text-xs border-purple-800/60 hover:bg-purple-950/30 gap-1.5 text-purple-300"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Duyệt đề xuất</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsAddCustomerOpen(true)}
            className="h-8 text-xs bg-blue-600 hover:bg-blue-500 text-white gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm khách hàng</span>
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TIER 1: CRITICAL TODAY (Overdue Follow-ups & Today's Follow-ups)           */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-red-400 font-mono">
              Ưu tiên 1: Cần xử lý hôm nay
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Các nhiệm vụ đến hạn hoặc quá hạn cần xử lý trong ngày
          </span>
        </div>

        {/* 3. Overdue Follow-ups */}
        {overview.overdueFollowUpsCount > 0 ? (
          <div className="rounded-xl border border-red-900/60 bg-gradient-to-r from-red-950/40 via-red-950/20 to-slate-900/40 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-red-900/40">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-red-900/50 text-red-300">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-red-200">
                    Lịch chăm sóc quá hạn ({overview.overdueFollowUpsCount})
                  </h3>
                  <p className="text-xs text-red-300/80">
                    Nhiệm vụ đã vượt quá hạn mục tiêu cần tương tác phục hồi khách hàng
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/follow-ups?filter=overdue')}
                className="h-7 text-xs border-red-800/80 text-red-300 hover:bg-red-900/40 gap-1 font-mono self-start sm:self-auto"
              >
                <span>Xem tất cả {overview.overdueFollowUpsCount} lịch quá hạn</span>
                <ArrowRight className="w-3 h-3" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {overdueList.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-red-900/40 bg-slate-950/70 hover:border-red-700/60 transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        onClick={() => navigate(`/customers/${task.customerId}`)}
                        className="text-xs font-semibold text-slate-100 hover:text-blue-400 cursor-pointer transition-colors truncate"
                      >
                        {task.customer?.fullName || 'Khách hàng'}
                      </span>
                      {task.customer?.phone && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {task.customer.phone}
                        </span>
                      )}
                      <StatusBadge status={task.status} />
                    </div>
                    <p className="text-xs font-medium text-red-300/90 truncate" title={task.title}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-red-400">
                      <Clock className="w-3 h-3" />
                      <span>Hạn: <DateDisplay date={task.dueAt} showTime relativeContext /></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleToggleFollowUp(task)}
                      className="h-7 px-2.5 text-xs bg-emerald-700 hover:bg-emerald-600 text-white gap-1"
                      title="Đánh dấu hoàn thành"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Xong</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/customers/${task.customerId}`)}
                      className="h-7 w-7 p-0 border-slate-700 hover:bg-slate-800 text-slate-300"
                      title="Mở hồ sơ khách hàng"
                    >
                      <ExternalLink className="w-3 h-3 text-blue-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 rounded-xl border border-emerald-900/40 bg-emerald-950/20 text-emerald-300 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Không có lịch chăm sóc quá hạn. Hoạt động liên hệ khách hàng đang đúng tiến độ.</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/follow-ups?filter=overdue')}
              className="h-6 text-xs text-emerald-400 hover:text-emerald-300"
            >
              Kiểm tra hàng đợi
            </Button>
          </div>
        )}

        {/* 2. Today's Follow-ups */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                Lịch chăm sóc hôm nay ({overview.todayFollowUpsCount})
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/follow-ups?filter=today')}
              className="text-xs text-blue-400 hover:text-blue-300 h-6 px-1.5 gap-1 font-mono"
            >
              <span>Xem danh sách hôm nay</span>
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>

          {todayList.length === 0 ? (
            <EmptyState
              title="Không có lịch chăm sóc hôm nay"
              description="Tất cả các công việc dự kiến hôm nay đã hoàn thành hoặc chưa có lịch mới."
              actionLabel="Lên lịch chăm sóc"
              onAction={() => setIsQuickFollowUpOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {todayList.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-800 bg-slate-950/70 hover:border-slate-700 transition-colors"
                >
                  <div className="min-w-0 flex-1 pr-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        onClick={() => navigate(`/customers/${task.customerId}`)}
                        className="text-xs font-semibold text-slate-100 hover:text-blue-400 cursor-pointer transition-colors truncate"
                      >
                        {task.customer?.fullName || 'Khách hàng'}
                      </span>
                      {task.customer?.phone && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {task.customer.phone}
                        </span>
                      )}
                      <StatusBadge status={task.status} />
                    </div>
                    <p className="text-xs text-slate-300 truncate" title={task.title}>
                      {task.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-mono text-amber-400">
                      <Clock className="w-3 h-3" />
                      <span>Hôm nay: <DateDisplay date={task.dueAt} showTime /></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleFollowUp(task)}
                      className="h-7 px-2.5 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 border-slate-700 gap-1"
                      title="Đánh dấu hoàn thành"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Xong</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/customers/${task.customerId}`)}
                      className="h-7 w-7 p-0 border-slate-700 hover:bg-slate-800 text-slate-300"
                      title="Mở hồ sơ khách hàng"
                    >
                      <ExternalLink className="w-3 h-3 text-blue-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* TIER 2: CẦN CHÚ Ý (Khách hàng tiềm năng cao)                               */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-rose-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-rose-400 font-mono">
              Ưu tiên 2: Cần chú ý · Khách hàng tiềm năng cao
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Tín hiệu đề xuất từ bộ quy tắc cần nhân viên xử lý
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                Đề xuất bán thêm & Khôi phục điểm cao nhất
              </h3>
              <p className="text-[11px] text-slate-400">
                Khách hàng đáp ứng quy tắc đối chiếu nhu cầu và lịch sử giao dịch
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/push?tab=high_priority')}
              className="text-xs text-rose-400 hover:text-rose-300 h-6 px-1.5 gap-1 font-mono"
            >
              <span>Trung tâm xử lý (Ưu tiên cao)</span>
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>

          {highPotentialCustomers.length === 0 ? (
            <EmptyState
              title="Không có đề xuất tiềm năng cao"
              description="Chạy bộ quy tắc đề xuất hoặc ghi nhận nhu cầu mới để phát hiện cơ hội."
              actionLabel="Đến Trung tâm xử lý"
              onAction={() => navigate('/push?tab=new')}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {highPotentialCustomers.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/80 p-3.5 flex flex-col justify-between hover:border-slate-700 transition-all space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          onClick={() => navigate(`/customers/${rec.customerId}`)}
                          className="font-semibold text-sm text-slate-100 hover:text-blue-400 cursor-pointer transition-colors block"
                        >
                          {rec.customer?.fullName || rec.customerId}
                        </span>
                        {rec.customer?.phone && (
                          <span className="text-[11px] font-mono text-slate-400">
                            {rec.customer.phone}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-950/60 border border-rose-800/60 text-rose-300 font-mono text-xs font-bold">
                        <Flame className="w-3 h-3 text-rose-400" />
                        <span>{rec.score}%</span>
                      </div>
                    </div>

                    <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80 space-y-1">
                      <div className="text-[11px] font-mono text-blue-400 font-semibold truncate">
                        Mục tiêu: {rec.targetProduct?.name || 'Sản phẩm tài chính'}
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">
                        {rec.reason}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/customers/${rec.customerId}`)}
                      className="text-[11px] h-7 px-2 text-slate-400 hover:text-slate-200"
                    >
                      Hồ sơ
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/push?tab=high_priority`)}
                      className="text-[11px] h-7 px-2.5 border-rose-900/60 bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 gap-1 font-mono"
                    >
                      <span>Chuyển khách</span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* TIER 3: ĐỀ XUẤT (Cơ hội mới từ hệ thống)                                  */}
      {/* ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-purple-400 font-mono">
              Ưu tiên 3: Đề xuất mới
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Cơ hội đề xuất mới từ các tín hiệu khách hàng gần đây
          </span>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                Cơ hội mới chờ xử lý ({overview.newRecommendationsCount})
              </h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/push?tab=new')}
              className="text-xs text-purple-400 hover:text-purple-300 h-6 px-1.5 gap-1 font-mono"
            >
              <span>Trung tâm xử lý</span>
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>

          {newRecommendations.length === 0 ? (
            <EmptyState
              title="Không có đề xuất chờ duyệt"
              description="Tất cả các cơ hội đề xuất đã được xử lý hoặc chuyển giao."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {newRecommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 hover:border-slate-700 transition-colors flex flex-col justify-between space-y-2"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span
                        onClick={() => navigate(`/customers/${rec.customerId}`)}
                        className="text-xs font-semibold text-slate-200 hover:text-blue-400 cursor-pointer transition-colors"
                      >
                        {rec.customer?.fullName || 'Khách hàng'}
                      </span>
                      <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 border border-purple-900/60 px-1.5 py-0.5 rounded">
                        Điểm {rec.score}%
                      </span>
                    </div>

                    <div className="text-xs font-medium text-slate-100 truncate">
                      {rec.targetProduct?.name || 'Sản phẩm tài chính'}
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {rec.reason}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
                    <span>
                      Tạo <DateDisplay date={rec.generatedAt} relativeContext />
                    </span>
                    <button
                      onClick={() => navigate('/push?tab=new')}
                      className="text-purple-400 hover:text-purple-300 font-semibold"
                    >
                      Xem xét →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* TIER 4: TỔNG QUAN VẬN HÀNH & NHẬT KÝ HỆ THỐNG                              */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-400 font-mono">
              Ưu tiên 4: Tổng quan vận hành & Nhật ký hệ thống
            </h2>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Trạng thái tổng hợp danh mục và luồng sự kiện theo thời gian thực
          </span>
        </div>

        {/* 1. OVERVIEW TILES (Interactive Navigation to filtered destinations) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Tổng số khách hàng"
            value={overview.totalCustomers}
            subtext="Toàn bộ danh mục khách hàng"
            icon={<Users className="w-4 h-4 text-blue-400" />}
            onClick={() => navigate('/customers')}
          />
          <StatCard
            label="Khách hàng đang hoạt động"
            value={overview.activeCustomers}
            subtext={`${Math.round((overview.activeCustomers / (overview.totalCustomers || 1)) * 100)}% tổng danh mục`}
            icon={<UserCheck className="w-4 h-4 text-emerald-400" />}
            onClick={() => navigate('/customers?status=ACTIVE')}
          />
          <StatCard
            label="Hồ sơ đang xử lý"
            value={overview.openCases}
            subtext="Bản nháp, đã nộp & đang thẩm định"
            icon={<Briefcase className="w-4 h-4 text-amber-400" />}
            onClick={() => navigate('/customers')}
          />
          <StatCard
            label="Đang chờ chuyển khách"
            value={overview.pendingPushes}
            subtext="Đề xuất đang chuyển tới các bộ phận"
            trend={
              overview.pendingPushes > 0
                ? { value: `${overview.pendingPushes} đang chờ`, isPositive: true }
                : undefined
            }
            icon={<Send className="w-4 h-4 text-purple-400" />}
            onClick={() => navigate('/push?tab=recently_pushed')}
          />
        </div>

        {/* 6. RECENT ACTIVITY STREAM */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                Hoạt động khách hàng & Sự kiện gần đây
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {recentActivities.length} sự kiện mới nhất
            </span>
          </div>

          {recentActivities.length === 0 ? (
            <EmptyState
              title="Chưa có nhật ký hoạt động"
              description="Các tương tác khách hàng, cuộc gọi và lượt chuyển khách sẽ hiển thị tại đây khi được ghi nhận."
            />
          ) : (
            <div className="divide-y divide-slate-800/60 font-mono text-xs">
              {recentActivities.map((act) => (
                <div
                  key={act.id}
                  className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-950/40 px-2 rounded transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700/60 flex-shrink-0">
                      {act.type}
                    </span>
                    <span
                      onClick={() => navigate(`/customers/${act.customerId}`)}
                      className="font-sans font-medium text-slate-200 hover:text-blue-400 cursor-pointer truncate"
                    >
                      {act.customer?.fullName || act.customerId}
                    </span>
                    <span className="font-sans text-slate-400 truncate hidden md:inline">
                      — {act.title}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 flex-shrink-0 self-end sm:self-auto">
                    <DateDisplay date={act.occurredAt} showTime relativeContext />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* QUICK ACTION MODALS                                                       */}
      {/* ========================================================================= */}
      {isAddCustomerOpen && (
        <CreateCustomerModal
          isOpen={isAddCustomerOpen}
          onClose={() => setIsAddCustomerOpen(false)}
          onSuccess={(newId) => {
            queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
            navigate(`/customers/${newId}`);
          }}
        />
      )}

      {isImportOpen && (
        <ImportDataModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
        />
      )}

      {isQuickFollowUpOpen && (
        <QuickFollowUpModal
          isOpen={isQuickFollowUpOpen}
          onClose={() => setIsQuickFollowUpOpen(false)}
        />
      )}
    </div>
  );
};

export default DashboardPage;
