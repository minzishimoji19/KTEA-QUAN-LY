import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Layers,
  Clock,
  FileText,
  CalendarCheck,
  Send,
  Sparkles,
  Edit,
  Trash2,
  Plus,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  StatCard,
  DataTable,
  StatusBadge,
  TagBadge,
  DateDisplay,
  ErrorState,
  EmptyState,
  ConfirmDialog,
} from '../components/common';
import { Skeleton, CardSkeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import {
  useCustomerDetail,
  useDeleteCustomer,
  useAddCustomerTag,
  useRemoveCustomerTag,
} from '../hooks/useCustomers';
import { useDeleteCase } from '../hooks/useCases';
import { useDeleteNeed, useUpdateNeed } from '../hooks/useNeeds';
import { useDeleteNote } from '../hooks/useNotes';
import { useUpdateFollowUp, useDeleteFollowUp } from '../hooks/useFollowUps';
import { useUpdatePushRecord } from '../hooks/usePushRecords';
import { useTags } from '../hooks/useTags';
import {
  CustomerCase,
  CustomerNeed,
  CustomerNote,
  FollowUp,
  PushRecord,
} from '../types/models';

import { EditCustomerModal } from '../features/customers/EditCustomerModal';
import { AddActivityModal } from '../features/customers/AddActivityModal';
import { AddNoteModal } from '../features/customers/AddNoteModal';
import { AddNeedModal } from '../features/customers/AddNeedModal';
import { AddCaseModal } from '../features/customers/AddCaseModal';
import { ScheduleFollowUpModal } from '../features/customers/ScheduleFollowUpModal';
import { EditFollowUpModal } from '../features/customers/EditFollowUpModal';
import { CreatePushModal } from '../features/customers/CreatePushModal';
import { ActivityTimeline } from '../features/activities/ActivityTimeline';
import { getNextPendingFollowUp } from '../utils/followUpUtils';

export const CustomerDetailPage: React.FC = () => {
  const { id, customerId } = useParams<{ id?: string; customerId?: string }>();
  const targetCustomerId = customerId || id;
  const navigate = useNavigate();

  // Queries
  const { data: customer, isLoading, isError, refetch } = useCustomerDetail(targetCustomerId);
  const { data: allTags } = useTags();

  // Mutations
  const deleteCustomer = useDeleteCustomer();
  const addCustomerTag = useAddCustomerTag(targetCustomerId || '');
  const removeCustomerTag = useRemoveCustomerTag(targetCustomerId || '');
  const deleteCase = useDeleteCase(targetCustomerId || '');
  const deleteNeed = useDeleteNeed(targetCustomerId || '');
  const updateNeed = useUpdateNeed(targetCustomerId || '');
  const deleteNote = useDeleteNote(targetCustomerId || '');
  const updateFollowUp = useUpdateFollowUp();
  const deleteFollowUp = useDeleteFollowUp();
  const updatePushRecord = useUpdatePushRecord();

  // Active section tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'cases' | 'timeline' | 'notes' | 'followups' | 'recommendations' | 'pushes'
  >('overview');

  // Quick Action Modal States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [isAddNeedOpen, setIsAddNeedOpen] = useState(false);
  const [isAddCaseOpen, setIsAddCaseOpen] = useState(false);
  const [isScheduleFollowUpOpen, setIsScheduleFollowUpOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUp | null>(null);
  const [isCreatePushOpen, setIsCreatePushOpen] = useState(false);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);

  // Destructive Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: async () => {},
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto py-4">
        {/* Profile Header Skeleton */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-32" />
            <div className="flex gap-2">
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-7 w-24" />
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="flex gap-6">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-44" />
          </div>
        </div>
        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/40 p-3.5 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>
        {/* Card Grid Skeleton */}
        <CardSkeleton count={3} />
      </div>
    );
  }

  if (isError || !customer) {
    return (
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Link to="/customers">
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" /> Quay lại danh sách khách hàng
            </Button>
          </Link>
        </div>
        <ErrorState
          title="Không tìm thấy khách hàng"
          description="Hồ sơ khách hàng được yêu cầu không tồn tại hoặc không thể tải."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  // Available tags to add that are not already assigned
  const assignedTagIds = new Set((customer.customerTags || []).map((ct) => ct.tagId));
  const availableTagsToAdd = (allTags || []).filter((t) => !assignedTagIds.has(t.id));

  // Destructive Actions Handlers
  const handleDeleteCustomer = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa hồ sơ khách hàng',
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn khách hàng "${customer.fullName}"? Mọi hồ sơ thẩm định, nhu cầu, lịch sử tương tác, ghi chú và thông tin chuyển khách liên quan sẽ bị xóa hoàn toàn.`,
      action: async () => {
        await deleteCustomer.mutateAsync(customer.id);
        navigate('/customers');
      },
    });
  };

  const handleDeleteCase = (c: CustomerCase) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa hồ sơ sản phẩm',
      message: `Bạn có chắc chắn muốn xóa hồ sơ cho sản phẩm "${c.product?.name || c.productId}"?`,
      action: async () => {
        await deleteCase.mutateAsync(c.id);
      },
    });
  };

  const handleDeleteNeed = (n: CustomerNeed) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa nhu cầu khách hàng',
      message: `Bạn có chắc chắn muốn xóa nhu cầu "${n.needType}"?`,
      action: async () => {
        await deleteNeed.mutateAsync(n.id);
      },
    });
  };

  const handleDeleteNote = (n: CustomerNote) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa ghi chú',
      message: 'Bạn có chắc chắn muốn xóa vĩnh viễn ghi chú này?',
      action: async () => {
        await deleteNote.mutateAsync(n.id);
      },
    });
  };

  const handleDeleteFollowUp = (fu: FollowUp) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Xóa lịch chăm sóc',
      message: `Bạn có chắc chắn muốn hủy công việc chăm sóc "${fu.title}"?`,
      action: async () => {
        await deleteFollowUp.mutateAsync(fu.id);
      },
    });
  };

  const handleMarkFollowUpComplete = async (fu: FollowUp) => {
    await updateFollowUp.mutateAsync({
      id: fu.id,
      data: {
        status: fu.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED',
        completedAt: fu.status === 'COMPLETED' ? null : new Date().toISOString(),
      },
    });
  };

  // Real API-derived customer case summary metrics (Section 7)
  const totalCases = customer.cases?.length || 0;
  const activeCases =
    customer.cases?.filter(
      (c) =>
        c.caseStatus === 'ACTIVE' ||
        c.caseStatus === 'UNDER_REVIEW' ||
        c.caseStatus === 'SUBMITTED' ||
        c.caseStatus === 'DRAFT'
    ).length || 0;
  const successfulCases =
    customer.cases?.filter(
      (c) =>
        c.caseStatus === 'APPROVED' ||
        c.caseStatus === 'COMPLETED' ||
        c.progress === 'COMPLETED' ||
        c.progress === 'CARD_ACTIVATED'
    ).length || 0;
  const rejectedCases =
    customer.cases?.filter((c) => c.caseStatus === 'REJECTED').length || 0;

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* 1. Header Section */}
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 space-y-3">
        {/* Navigation Breadcrumb & Back */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Link to="/customers">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Khách hàng</span>
              </Button>
            </Link>
            <span className="text-slate-600 font-mono">/</span>
            <span className="text-xs font-mono text-slate-400 truncate max-w-[200px]">
              {customer.id}
            </span>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Primary Actions required by Section 7 */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditOpen(true)}
              className="h-7 px-2.5 text-xs gap-1.5 border-slate-700 hover:border-slate-500 text-slate-200"
            >
              <Edit className="w-3 h-3 text-blue-400" />
              <span>Sửa thông tin</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddCaseOpen(true)}
              className="h-7 px-2.5 text-xs gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Tạo hồ sơ mới</span>
            </Button>

            <span className="text-slate-700 mx-0.5">|</span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddActivityOpen(true)}
              className="h-7 px-2 text-xs gap-1"
            >
              <Clock className="w-3 h-3 text-amber-400" />
              <span>+ Hoạt động</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddNoteOpen(true)}
              className="h-7 px-2 text-xs gap-1"
            >
              <FileText className="w-3 h-3 text-blue-400" />
              <span>+ Ghi chú</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddNeedOpen(true)}
              className="h-7 px-2 text-xs gap-1"
            >
              <Layers className="w-3 h-3 text-emerald-400" />
              <span>+ Nhu cầu</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsScheduleFollowUpOpen(true)}
              className="h-7 px-2 text-xs gap-1 border-amber-800/80 hover:bg-amber-950/40 text-amber-300"
            >
              <CalendarCheck className="w-3 h-3 text-amber-400" />
              <span>Lên lịch chăm sóc</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreatePushOpen(true)}
              className="h-7 px-2 text-xs gap-1 bg-purple-600 hover:bg-purple-500 text-white border-0"
            >
              <Send className="w-3 h-3" />
              <span>Chuyển khách</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteCustomer}
              className="h-7 w-7 p-0 ml-1"
              title="Xóa hồ sơ khách hàng"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Identity & Status Headline */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-bold text-slate-100 font-sans tracking-tight">
                {customer.fullName}
              </h1>
              <StatusBadge status={customer.overallStatus} />
              {customer.priority && <StatusBadge status={customer.priority} />}
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400 pt-0.5">
              <span className="flex items-center gap-1.5 text-slate-200">
                <Phone className="w-3.5 h-3.5 text-slate-500" />
                <span>{customer.phone}</span>
              </span>
              {customer.email && (
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>{customer.email}</span>
                </span>
              )}
              {customer.address && (
                <span className="flex items-center gap-1.5 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  <span>{customer.address}</span>
                </span>
              )}

              {/* Customer Source with Inactive Indicator */}
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="text-slate-500 font-sans">Nguồn:</span>
                <span className="text-slate-200 font-semibold">
                  {customer.customerSource?.name || customer.source || 'Tự nhiên'}
                </span>
                {customer.customerSource && customer.customerSource.active === false && (
                  <span
                    className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700"
                    title="Nguồn khách này hiện đã ngừng hoạt động"
                  >
                    Inactive
                  </span>
                )}
              </span>

              {/* Next Follow-up Display */}
              {(() => {
                const nextFollowUp = getNextPendingFollowUp(customer.followUps || []);
                if (nextFollowUp) {
                  return (
                    <div
                      onClick={() => setActiveTab('followups')}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs cursor-pointer hover:border-amber-700 transition-colors"
                      title="Chuyển đến tab Lịch chăm sóc"
                    >
                      <CalendarCheck className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-semibold text-slate-200 font-sans">Lịch tiếp theo:</span>
                      <span className="text-amber-200 truncate max-w-[150px]">{nextFollowUp.title}</span>
                      <span className="text-slate-600">·</span>
                      <DateDisplay date={nextFollowUp.dueAt} showTime relativeContext className="text-amber-400 font-mono text-[11px]" />
                    </div>
                  );
                }
                return (
                  <button
                    type="button"
                    onClick={() => setIsScheduleFollowUpOpen(true)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-400 transition-colors font-mono"
                  >
                    <Plus className="w-3 h-3 text-amber-400" />
                    <span>Lên lịch chăm sóc</span>
                  </button>
                );
              })()}
            </div>
          </div>

          {/* Tags list with tag manager */}
          <div className="flex flex-wrap items-center gap-1.5 relative self-start md:self-auto">
            {(customer.customerTags || []).map((ct) => (
              <TagBadge
                key={ct.tag.id}
                name={ct.tag.name}
                color={ct.tag.color}
                onRemove={() => removeCustomerTag.mutate(ct.tag.id)}
              />
            ))}

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Gắn nhãn</span>
              </button>

              {isTagDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 rounded-md border border-slate-800 bg-slate-900 shadow-xl z-30 p-1 text-xs">
                  <div className="px-2 py-1 text-[10px] font-mono text-slate-500 uppercase border-b border-slate-800 mb-1">
                    Gắn nhãn khách hàng
                  </div>
                  {availableTagsToAdd.length === 0 ? (
                    <div className="px-2 py-1 text-[11px] text-slate-500">
                      Đã gắn tất cả nhãn
                    </div>
                  ) : (
                    availableTagsToAdd.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          addCustomerTag.mutate(t.id);
                          setIsTagDropdownOpen(false);
                        }}
                        className="px-2 py-1.5 rounded hover:bg-slate-800 cursor-pointer flex items-center gap-2"
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: t.color || '#3b82f6' }}
                        />
                        <span className="truncate">{t.name}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Workspace Navigation Tabs */}
        <div className="flex items-center gap-1 pt-2 border-t border-slate-800/80 overflow-x-auto text-xs font-mono">
          {[
            { key: 'overview', label: 'Tổng quan' },
            { key: 'cases', label: `Hồ sơ (${customer.cases?.length || 0})` },
            { key: 'timeline', label: `Hoạt động (${customer.activities?.length || 0})` },
            { key: 'notes', label: `Ghi chú (${customer.notes?.length || 0})` },
            { key: 'followups', label: `Lịch chăm sóc (${customer.followUps?.length || 0})` },
            { key: 'recommendations', label: `Đề xuất (${customer.recommendations?.length || 0})` },
            { key: 'pushes', label: `Chuyển khách (${customer.pushRecords?.length || 0})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`px-3 py-1.5 rounded font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Overview Section */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Quick Metrics Bar */}
          {/* Customer Summary Cards (Section 7) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Tổng số hồ sơ"
              value={totalCases}
              subtext="Tất cả hồ sơ đã tạo"
              icon={<Briefcase className="w-4 h-4 text-purple-400" />}
              onClick={() => setActiveTab('cases')}
            />
            <StatCard
              label="Hồ sơ đang xử lý"
              value={activeCases}
              subtext="Đang trong quy trình"
              icon={<Clock className="w-4 h-4 text-blue-400" />}
              onClick={() => setActiveTab('cases')}
            />
            <StatCard
              label="Hồ sơ thành công"
              value={successfulCases}
              subtext="Đã duyệt / Hoàn tất"
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              onClick={() => setActiveTab('cases')}
            />
            <StatCard
              label="Hồ sơ bị từ chối"
              value={rejectedCases}
              subtext="Đã kết thúc quy trình"
              icon={<XCircle className="w-4 h-4 text-rose-400" />}
              onClick={() => setActiveTab('cases')}
            />
          </div>

          {/* 6-Dimension Operational Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 1. Customer Identity & Core Profile Card */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  Hồ sơ khách hàng
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditOpen(true)}
                  className="h-6 px-1.5 text-[11px] text-blue-400"
                >
                  Chỉnh sửa
                </Button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Họ và tên</span>
                  <span className="font-semibold text-slate-100">{customer.fullName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Số điện thoại</span>
                  <span className="font-mono text-slate-200">{customer.phone}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Email</span>
                  <span className="text-slate-200">{customer.email || '--'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Giới tính / Ngày sinh</span>
                  <span className="font-mono text-slate-200">
                    {customer.gender || '--'} {customer.dateOfBirth ? `• ${new Date(customer.dateOfBirth).toLocaleDateString()}` : ''}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Nguồn khách</span>
                  <div className="flex items-center gap-1 font-mono text-slate-200">
                    <span>{customer.customerSource?.name || customer.source || 'Tự nhiên'}</span>
                    {customer.customerSource && customer.customerSource.active === false && (
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Ngày tạo hồ sơ</span>
                  <span className="font-mono text-slate-300">
                    <DateDisplay date={customer.createdAt} />
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Cập nhật lần cuối</span>
                  <span className="font-mono text-slate-300">
                    <DateDisplay date={customer.updatedAt} />
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Active Applications & Cases Card */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
                  <Briefcase className="w-3.5 h-3.5 text-purple-400" />
                  Hồ sơ sản phẩm ({customer.cases?.length || 0})
                </h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('cases')}
                    className="h-6 px-1.5 text-[11px] text-slate-400 hover:text-slate-200 font-mono"
                  >
                    Xem tất cả
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddCaseOpen(true)}
                    className="h-6 px-1.5 text-[11px] text-purple-400"
                  >
                    + Thêm
                  </Button>
                </div>
              </div>

              {(!customer.cases || customer.cases.length === 0) ? (
                <EmptyState
                  title="Chưa có hồ sơ sản phẩm"
                  description="Khách hàng chưa đăng ký sản phẩm nào."
                  actionLabel="+ Mở hồ sơ"
                  onAction={() => setIsAddCaseOpen(true)}
                />
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-0.5">
                  {customer.cases.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => navigate(`/customers/${customer.id}/cases/${c.id}`)}
                      className="p-2.5 rounded border border-slate-800 bg-slate-950/60 flex items-start justify-between gap-2 hover:border-purple-600/50 cursor-pointer transition-colors"
                      title="Nhấn để xem chi tiết hồ sơ"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-200 truncate">
                            {c.product?.name || 'Chưa chọn sản phẩm'}
                          </span>
                          <StatusBadge status={c.caseStatus} />
                          {c.progress && <StatusBadge status={c.progress} className="text-[10px] py-0" />}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400">
                          Hồ sơ #{c.id.slice(0, 8)} {c.product?.code ? `• Mã: ${c.product.code}` : ''}
                        </div>
                        <DateDisplay date={c.applicationDate || c.createdAt} className="text-[10px]" />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCase(c);
                        }}
                        className="p-1 rounded text-slate-500 hover:text-red-400 flex-shrink-0"
                        title="Xóa hồ sơ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Current Needs Card */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  Nhu cầu hiện tại ({customer.needs?.length || 0})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddNeedOpen(true)}
                  className="h-6 px-1.5 text-[11px] text-amber-400"
                >
                  + Thêm
                </Button>
              </div>

              {(!customer.needs || customer.needs.length === 0) ? (
                <EmptyState
                  title="Chưa xác định nhu cầu"
                  description="Chưa có nhu cầu cụ thể hoặc tự động nhận diện nào được gắn cho khách hàng này."
                  actionLabel="+ Thêm nhu cầu"
                  onAction={() => setIsAddNeedOpen(true)}
                />
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-0.5">
                  {customer.needs.map((n) => (
                    <div
                      key={n.id}
                      className="p-2.5 rounded border border-slate-800 bg-slate-950/60 flex items-start justify-between gap-2"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-200 font-mono">
                            {n.needType.replace(/_/g, ' ')}
                          </span>
                          <StatusBadge status={n.status} />
                        </div>
                        {n.notes && (
                          <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">
                            {n.notes}
                          </p>
                        )}
                        <DateDisplay date={n.detectedAt} className="text-[10px] text-slate-500" />
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {n.status === 'OPEN' && (
                          <button
                            type="button"
                            onClick={() =>
                              updateNeed.mutate({
                                id: n.id,
                                data: {
                                  status: 'RESOLVED',
                                  resolvedAt: new Date().toISOString(),
                                },
                              })
                            }
                            className="p-1 rounded text-slate-500 hover:text-emerald-400"
                            title="Đánh dấu đã giải quyết"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteNeed(n)}
                          className="p-1 rounded text-slate-500 hover:text-red-400"
                          title="Xóa nhu cầu"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Recommendations & Push History */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 4. Recommendations Engine Card */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                  Gợi ý đề xuất ({customer.recommendations?.length || 0})
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveTab('recommendations')}
                  className="h-6 px-1.5 text-[11px] text-slate-400 hover:text-slate-200 font-mono"
                >
                  Xem tất cả
                </Button>
              </div>

              {(!customer.recommendations || customer.recommendations.length === 0) ? (
                <EmptyState
                  title="Chưa có gợi ý đề xuất"
                  description="Chưa có quy tắc đề xuất nào phù hợp với hồ sơ khách hàng này."
                />
              ) : (
                <div className="space-y-2.5">
                  {customer.recommendations.slice(0, 2).map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-xs text-slate-100 font-sans truncate">
                            {rec.targetProduct?.name || rec.recommendationType}
                          </span>
                          <StatusBadge status={rec.status} />
                          {rec.score && (
                            <span className="px-1.5 py-0.2 rounded font-mono text-[9px] bg-blue-950/80 text-blue-300 border border-blue-800/40 font-semibold">
                              {Number(rec.score)}% PHÙ HỢP
                            </span>
                          )}
                        </div>
                        <DateDisplay date={rec.generatedAt} relativeContext className="text-[10px] text-slate-500 shrink-0" />
                      </div>
                      <p className="text-[11px] text-slate-300 bg-slate-900/40 p-2 rounded border border-slate-850 line-clamp-2">
                        {rec.reason}
                      </p>
                      <div className="flex justify-end pt-0.5">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setIsCreatePushOpen(true)}
                          className="h-6 text-[10px] gap-1 bg-purple-600 hover:bg-purple-500 text-white"
                        >
                          <Send className="w-2.5 h-2.5" />
                          <span>Chuyển khách</span>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Push History Card */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  Lịch sử chuyển khách ({customer.pushRecords?.length || 0})
                </h3>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('pushes')}
                    className="h-6 px-1.5 text-[11px] text-slate-400 hover:text-slate-200 font-mono"
                  >
                    Xem tất cả
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCreatePushOpen(true)}
                    className="h-6 px-1.5 text-[11px] text-emerald-400"
                  >
                    + Chuyển
                  </Button>
                </div>
              </div>

              {(!customer.pushRecords || customer.pushRecords.length === 0) ? (
                <EmptyState
                  title="Chưa có lượt chuyển khách nào"
                  description="Chưa có đề xuất nào được chuyển giao cho chuyên viên hoặc đối tác."
                  actionLabel="+ Chuyển khách"
                  onAction={() => setIsCreatePushOpen(true)}
                />
              ) : (
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-0.5">
                  {customer.pushRecords.map((p) => (
                    <div
                      key={p.id}
                      className="p-2.5 rounded border border-slate-800 bg-slate-950/60 flex items-start justify-between gap-2"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-100 truncate">
                            {p.targetProduct?.name || 'Chuyển khách chung'}
                          </span>
                          <StatusBadge status={p.status} />
                        </div>
                        {p.note && (
                          <p className="text-[11px] text-slate-400 line-clamp-1">{p.note}</p>
                        )}
                        <DateDisplay date={p.pushedAt} showTime relativeContext className="text-[10px] text-slate-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Timeline & Recent Activity Snapshot */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Tóm tắt hoạt động gần đây
              </h3>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddActivityOpen(true)}
                  className="h-6 px-1.5 text-[11px] text-amber-400"
                >
                  + Hoạt động
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddNoteOpen(true)}
                  className="h-6 px-1.5 text-[11px] text-blue-400"
                >
                  + Ghi chú
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('timeline')}
                  className="h-6 px-2 text-[11px] font-mono text-slate-300"
                >
                  Toàn bộ dòng hoạt động
                </Button>
              </div>
            </div>

            {(!customer.activities || customer.activities.length === 0) && (!customer.notes || customer.notes.length === 0) ? (
              <EmptyState
                title="Chưa có sự kiện hoạt động nào"
                description="Ghi nhận cuộc gọi, cuộc họp, tin nhắn hoặc ghi chú để xây dựng dòng thời gian khách hàng."
                actionLabel="+ Ghi nhận hoạt động"
                onAction={() => setIsAddActivityOpen(true)}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Recent Activities */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">TƯƠNG TÁC GẦN ĐÂY</span>
                  {customer.activities && customer.activities.length > 0 ? (
                    customer.activities.slice(0, 3).map((act) => (
                      <div key={act.id} className="p-2 rounded border border-slate-800 bg-slate-950/60 flex justify-between items-center gap-2">
                        <div className="min-w-0">
                          <span className="text-xs font-medium text-slate-200 truncate block">{act.title}</span>
                          <span className="text-[10px] font-mono text-slate-500 uppercase">{act.type}</span>
                        </div>
                        <DateDisplay date={act.occurredAt} relativeContext className="text-[10px] text-slate-400 shrink-0" />
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 italic">Chưa có tương tác nào được ghi nhận</p>
                  )}
                </div>

                {/* Recent Notes */}
                <div className="space-y-2">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">GHI CHÚ NỘI BỘ</span>
                  {customer.notes && customer.notes.length > 0 ? (
                    customer.notes.slice(0, 2).map((note) => (
                      <div key={note.id} className="p-2 rounded border border-slate-800 bg-slate-950/60 space-y-1">
                        <p className="text-xs text-slate-300 line-clamp-2">{note.content}</p>
                        <DateDisplay date={note.createdAt} relativeContext className="text-[10px] text-slate-500" />
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 italic">Chưa có ghi chú nào được lưu</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Cases / Applications Tab (Section 7) */}
      {activeTab === 'cases' && (
        <div className="space-y-4">
          {/* Case Summary Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              label="Tổng số hồ sơ"
              value={totalCases}
              subtext="Tất cả hồ sơ đã tạo"
              icon={<Briefcase className="w-4 h-4 text-purple-400" />}
            />
            <StatCard
              label="Hồ sơ đang xử lý"
              value={activeCases}
              subtext="Đang trong quy trình"
              icon={<Clock className="w-4 h-4 text-blue-400" />}
            />
            <StatCard
              label="Hồ sơ thành công"
              value={successfulCases}
              subtext="Đã duyệt / Hoàn tất"
              icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            />
            <StatCard
              label="Hồ sơ bị từ chối"
              value={rejectedCases}
              subtext="Đã kết thúc quy trình"
              icon={<XCircle className="w-4 h-4 text-rose-400" />}
            />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                  Danh sách hồ sơ khách hàng
                </h2>
                <p className="text-[11px] text-slate-400">
                  Mỗi hồ sơ đại diện cho một lần nộp và thẩm định độc lập. Nhấn vào hồ sơ để xem tiến trình chi tiết.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsAddCaseOpen(true)}
                className="h-7 text-xs gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Tạo hồ sơ mới</span>
              </Button>
            </div>

            <DataTable
              columns={[
                {
                  key: 'id',
                  header: 'Mã hồ sơ',
                  width: '120px',
                  render: (c: CustomerCase) => (
                    <span className="font-mono text-xs font-semibold text-purple-300 hover:underline">
                      #{c.id.slice(0, 8)}
                    </span>
                  ),
                },
                {
                  key: 'product',
                  header: 'Sản phẩm',
                  width: '200px',
                  render: (c: CustomerCase) => (
                    <div className="flex flex-col">
                      {c.product ? (
                        <>
                          <span className="font-semibold text-slate-100 text-xs">
                            {c.product.name}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {c.product.code}
                          </span>
                        </>
                      ) : (
                        <span className="text-amber-400 italic text-xs font-medium">
                          Chưa chọn sản phẩm
                        </span>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'caseStatus',
                  header: 'Trạng thái',
                  width: '120px',
                  render: (c: CustomerCase) => <StatusBadge status={c.caseStatus} />,
                },
                {
                  key: 'progress',
                  header: 'Tiến trình',
                  width: '170px',
                  render: (c: CustomerCase) => (
                    <StatusBadge status={c.progress || 'NOT_SELECTED'} />
                  ),
                },
                {
                  key: 'applicationDate',
                  header: 'Ngày nộp',
                  width: '115px',
                  render: (c: CustomerCase) => (
                    <DateDisplay date={c.applicationDate || c.createdAt} className="text-xs font-mono" />
                  ),
                },
                {
                  key: 'updatedAt',
                  header: 'Cập nhật',
                  width: '115px',
                  render: (c: CustomerCase) => (
                    <DateDisplay date={c.updatedAt || c.createdAt} className="text-xs font-mono" />
                  ),
                },
                {
                  key: 'actions',
                  header: '',
                  align: 'right',
                  width: '110px',
                  render: (c: CustomerCase) => (
                    <div
                      className="flex items-center justify-end gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/customers/${customer.id}/cases/${c.id}`)}
                        className="h-6 px-2 text-[10px] border-slate-700 hover:border-purple-500 hover:text-purple-300"
                      >
                        Chi tiết
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCase(c)}
                        className="p-1 rounded text-slate-500 hover:text-red-400"
                        title="Xóa hồ sơ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ),
                },
              ]}
              data={customer.cases || []}
              keyExtractor={(c) => c.id}
              isEmpty={!customer.cases || customer.cases.length === 0}
              emptyTitle="Khách hàng này chưa có hồ sơ"
              emptyDescription="Mỗi khách hàng có thể có nhiều hồ sơ sản phẩm theo thời gian."
              emptyActionLabel="+ Tạo hồ sơ mới"
              onEmptyAction={() => setIsAddCaseOpen(true)}
              onRowClick={(c) => navigate(`/customers/${customer.id}/cases/${c.id}`)}
            />
          </div>
        </div>
      )}

      {/* 4. Activity Timeline Tab */}
      {activeTab === 'timeline' && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                Dòng hoạt động khách hàng
              </h2>
              <p className="text-[11px] text-slate-400">
                Nhật ký kiểm toán theo thời gian ghi lại mọi tương tác, cuộc gọi, tin nhắn và mốc xử lý hồ sơ
              </p>
            </div>
          </div>

          <ActivityTimeline
            activities={customer.activities || []}
            customerId={customer.id}
            onAddActivity={() => setIsAddActivityOpen(true)}
          />
        </div>
      )}

      {/* 5. Notes Tab */}
      {activeTab === 'notes' && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                Ghi chú nội bộ
              </h2>
              <p className="text-[11px] text-slate-400">
                Quan sát của chuyên viên, ghi chú thẩm định và nhắc nhở riêng
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddNoteOpen(true)}
              className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-500 text-white"
            >
              <Plus className="w-3 h-3" />
              <span>Thêm ghi chú</span>
            </Button>
          </div>

          {(!customer.notes || customer.notes.length === 0) ? (
            <EmptyState
              title="Chưa có ghi chú nào"
              description="Lưu giữ nhắc nhở hoặc kết quả thẩm tra nội bộ liên quan đến khách hàng này."
              actionLabel="+ Thêm ghi chú"
              onAction={() => setIsAddNoteOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {customer.notes.map((n) => (
                <div
                  key={n.id}
                  className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 flex flex-col justify-between gap-3 group"
                >
                  <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                    {n.content}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-850 text-[11px] text-slate-500 font-mono">
                    <DateDisplay date={n.createdAt} showTime />
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(n)}
                      className="text-slate-500 hover:text-red-400 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Xóa ghi chú"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 6. Follow-ups Tab */}
      {activeTab === 'followups' && (() => {
        const allFollowUps = customer.followUps || [];
        const nextPending = getNextPendingFollowUp(allFollowUps);
        const pendingList = allFollowUps
          .filter((f) => f.status === 'PENDING' || f.status === 'IN_PROGRESS')
          .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
        const completedList = allFollowUps
          .filter((f) => f.status === 'COMPLETED' || f.status === 'CANCELLED')
          .sort((a, b) => {
            const timeA = new Date(a.completedAt || a.updatedAt).getTime();
            const timeB = new Date(b.completedAt || b.updatedAt).getTime();
            return timeB - timeA;
          });

        return (
          <div className="space-y-4">
            {/* Header & Quick Action */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                    Trung tâm chăm sóc khách hàng
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Công việc đang xử lý, lịch hẹn tiếp theo và lịch sử tương tác được bảo lưu
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setIsScheduleFollowUpOpen(true)}
                  className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-500 text-white"
                >
                  <Plus className="w-3 h-3" />
                  <span>Lên lịch chăm sóc</span>
                </Button>
              </div>

              {/* Next Follow-up Highlight Banner */}
              {nextPending ? (
                <div className="p-3.5 rounded-lg border border-amber-800/60 bg-amber-950/20 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold flex items-center gap-1">
                        <CalendarCheck className="w-3 h-3" /> Lịch tiếp theo
                      </span>
                      <h3 className="text-sm font-semibold text-slate-100 font-sans">
                        {nextPending.title}
                      </h3>
                    </div>
                    <DateDisplay
                      date={nextPending.dueAt}
                      showTime
                      relativeContext
                      className="text-xs font-mono font-semibold text-amber-300"
                    />
                  </div>

                  {nextPending.description && (
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-2.5 rounded border border-slate-850">
                      {nextPending.description}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleMarkFollowUpComplete(nextPending)}
                      className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Đánh dấu hoàn thành</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingFollowUp(nextPending)}
                      className="h-7 text-xs px-2"
                    >
                      <Edit className="w-3 h-3 text-slate-400" />
                      <span>Sửa</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsScheduleFollowUpOpen(true)}
                      className="h-7 text-xs px-2 text-amber-300 hover:text-white"
                    >
                      <span>Lên lịch tiếp</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/40 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span>Hiện tại chưa có lịch chăm sóc sắp tới nào cho khách hàng này.</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsScheduleFollowUpOpen(true)}
                    className="h-6 text-xs text-amber-400 hover:text-amber-300 border-amber-900/60"
                  >
                    + Lên lịch chăm sóc
                  </Button>
                </div>
              )}
            </div>

            {/* Active / Pending Follow-ups */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
                Hàng đợi chăm sóc chờ xử lý ({pendingList.length})
              </h3>

              {pendingList.length === 0 ? (
                <EmptyState
                  title="Không có lịch chăm sóc chờ"
                  description="Tất cả các công việc liên hệ đang hoạt động đã được hoàn tất."
                  actionLabel="+ Lên lịch chăm sóc"
                  onAction={() => setIsScheduleFollowUpOpen(true)}
                />
              ) : (
                <div className="space-y-2">
                  {pendingList.map((fu) => {
                    const isOverdue = new Date(fu.dueAt).getTime() < Date.now();
                    return (
                      <div
                        key={fu.id}
                        className={`p-3 rounded-lg border transition-colors flex items-start justify-between gap-3 ${
                          isOverdue
                            ? 'border-red-900/50 bg-red-950/20'
                            : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                        }`}
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-100">
                              {fu.title}
                            </span>
                            <StatusBadge status={fu.status} />
                            {isOverdue && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-red-950 text-red-400 border border-red-800/60">
                                Quá hạn
                              </span>
                            )}
                          </div>
                          {fu.description && (
                            <p className="text-xs text-slate-400 leading-relaxed">
                              {fu.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 pt-0.5 text-[11px] font-mono">
                            <span className="text-slate-500">Lịch hẹn:</span>
                            <DateDisplay
                              date={fu.dueAt}
                              showTime
                              relativeContext
                              className={isOverdue ? 'text-red-400 font-semibold' : 'text-slate-300'}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleMarkFollowUpComplete(fu)}
                            className="h-7 text-xs px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                          >
                            <span>Xong</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingFollowUp(fu)}
                            className="h-7 w-7 p-0"
                            title="Sửa lịch chăm sóc"
                          >
                            <Edit className="w-3 h-3 text-slate-400" />
                          </Button>
                          <button
                            type="button"
                            onClick={() => handleDeleteFollowUp(fu)}
                            className="p-1.5 rounded text-slate-500 hover:text-red-400 transition-colors"
                            title="Xóa lịch chăm sóc"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Follow-up History (Preserved History) */}
            <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300 font-mono">
                    Lịch sử chăm sóc ({completedList.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Hồ sơ bảo lưu các điểm chạm đã hoàn tất (không bao giờ bị xóa khi hoàn thành)
                  </p>
                </div>
              </div>

              {completedList.length === 0 ? (
                <div className="p-4 rounded-lg border border-slate-850 bg-slate-950/30 text-center text-xs text-slate-500 font-mono">
                  Chưa có lịch chăm sóc nào được hoàn tất trong lịch sử.
                </div>
              ) : (
                <div className="space-y-2">
                  {completedList.map((fu) => (
                    <div
                      key={fu.id}
                      className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/40 opacity-80 hover:opacity-100 transition-opacity flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-300 line-through">
                            {fu.title}
                          </span>
                          <StatusBadge status={fu.status} />
                        </div>
                        {fu.description && (
                          <p className="text-xs text-slate-500 leading-relaxed">
                            {fu.description}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 pt-0.5 text-[10px] font-mono text-slate-500">
                          <span>
                            Hạn ban đầu: <DateDisplay date={fu.dueAt} showTime />
                          </span>
                          {fu.completedAt && (
                            <span className="text-emerald-400">
                              Hoàn thành: <DateDisplay date={fu.completedAt} showTime relativeContext />
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMarkFollowUpComplete(fu)}
                          className="h-6 text-[10px] px-2 text-slate-400 hover:text-slate-200"
                        >
                          Mở lại
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFollowUp(fu)}
                          className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors"
                          title="Xóa khỏi lịch sử"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 7. Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                Gợi ý đề xuất hệ thống
              </h2>
              <p className="text-[11px] text-slate-400">
                Các đề xuất sản phẩm dựa trên tập quy tắc phù hợp với hồ sơ khách hàng
              </p>
            </div>
          </div>

          {(!customer.recommendations || customer.recommendations.length === 0) ? (
            <EmptyState
              title="Chưa tạo đề xuất nào"
              description="Hệ thống chưa tạo đề xuất theo quy tắc cho khách hàng này. Đề xuất sẽ xuất hiện khi phát hiện nhu cầu và tiêu chí phù hợp."
            />
          ) : (
            <div className="space-y-3">
              {customer.recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/70 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-blue-400" />
                      <span className="font-semibold text-xs text-slate-100 font-sans">
                        {rec.targetProduct?.name || rec.recommendationType}
                      </span>
                      <StatusBadge status={rec.status} />
                      {rec.score && (
                        <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-blue-950/80 text-blue-300 border border-blue-800/40">
                          Điểm phù hợp: {Number(rec.score)}%
                        </span>
                      )}
                    </div>
                    <DateDisplay date={rec.generatedAt} className="text-[10px] text-slate-500" />
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-2.5 rounded border border-slate-850">
                    {rec.reason}
                  </p>

                  <div className="flex justify-end pt-1">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setIsCreatePushOpen(true)}
                      className="h-7 text-xs gap-1 bg-purple-600 hover:bg-purple-500 text-white"
                    >
                      <Send className="w-3 h-3" />
                      <span>Chuyển khách theo đề xuất này</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. Push History Tab */}
      {activeTab === 'pushes' && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-200 font-mono">
                Lịch sử chuyển khách
              </h2>
              <p className="text-[11px] text-slate-400">
                Danh sách chuyển khách đến chuyên viên thẩm định, tín dụng và đối tác liên kết
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreatePushOpen(true)}
              className="h-7 text-xs gap-1 bg-purple-600 hover:bg-purple-500 text-white"
            >
              <Plus className="w-3 h-3" />
              <span>Tạo lượt chuyển mới</span>
            </Button>
          </div>

          <DataTable
            columns={[
              {
                key: 'product',
                header: 'Sản phẩm đích',
                render: (p: PushRecord) => (
                  <span className="font-semibold text-slate-100">
                    {p.targetProduct?.name || 'Chuyển khách chung'}
                  </span>
                ),
              },
              {
                key: 'status',
                header: 'Trạng thái chuyển',
                render: (p: PushRecord) => <StatusBadge status={p.status} />,
              },
              {
                key: 'pushedAt',
                header: 'Ngày chuyển',
                render: (p: PushRecord) => <DateDisplay date={p.pushedAt} showTime />,
              },
              {
                key: 'resultAt',
                header: 'Ngày có kết quả',
                render: (p: PushRecord) => <DateDisplay date={p.resultAt} />,
              },
              {
                key: 'notes',
                header: 'Kết quả / Ghi chú',
                render: (p: PushRecord) => (
                  <span className="text-xs text-slate-400">
                    {p.failureReason || p.note || '--'}
                  </span>
                ),
              },
              {
                key: 'actions',
                header: 'Cập nhật trạng thái',
                align: 'right',
                render: (p: PushRecord) => (
                  <div className="flex items-center justify-end gap-1">
                    {p.status === 'PENDING' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updatePushRecord.mutate({
                              id: p.id,
                              data: {
                                status: 'SUCCESS',
                                resultAt: new Date().toISOString(),
                              },
                            })
                          }
                          className="h-6 px-1.5 text-[10px] text-emerald-400"
                        >
                          Tiếp nhận
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updatePushRecord.mutate({
                              id: p.id,
                              data: {
                                status: 'FAILED',
                                failureReason: 'Đối tác giới thiệu từ chối',
                                resultAt: new Date().toISOString(),
                              },
                            })
                          }
                          className="h-6 px-1.5 text-[10px] text-red-400"
                        >
                          Từ chối
                        </Button>
                      </>
                    )}
                  </div>
                ),
              },
            ]}
            data={customer.pushRecords || []}
            keyExtractor={(p) => p.id}
            isEmpty={(!customer.pushRecords || customer.pushRecords.length === 0)}
            emptyTitle="Chưa có dữ liệu chuyển khách"
            emptyDescription="Chưa có lượt chuyển khách nào được thực hiện cho khách hàng này."
            emptyActionLabel="+ Chuyển khách"
            onEmptyAction={() => setIsCreatePushOpen(true)}
          />
        </div>
      )}

      {/* Quick Action Modals */}
      <EditCustomerModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        customer={customer}
      />

      <AddActivityModal
        isOpen={isAddActivityOpen}
        onClose={() => setIsAddActivityOpen(false)}
        customerId={customer.id}
      />

      <AddNoteModal
        isOpen={isAddNoteOpen}
        onClose={() => setIsAddNoteOpen(false)}
        customerId={customer.id}
      />

      <AddNeedModal
        isOpen={isAddNeedOpen}
        onClose={() => setIsAddNeedOpen(false)}
        customerId={customer.id}
      />

      <AddCaseModal
        isOpen={isAddCaseOpen}
        onClose={() => setIsAddCaseOpen(false)}
        customerId={customer.id}
      />

      <ScheduleFollowUpModal
        isOpen={isScheduleFollowUpOpen}
        onClose={() => setIsScheduleFollowUpOpen(false)}
        customerId={customer.id}
        customerName={customer.fullName}
      />

      <EditFollowUpModal
        isOpen={!!editingFollowUp}
        onClose={() => setEditingFollowUp(null)}
        followUp={editingFollowUp}
      />

      <CreatePushModal
        isOpen={isCreatePushOpen}
        onClose={() => setIsCreatePushOpen(false)}
        customerId={customer.id}
      />

      {/* Confirmation Dialog for Destructive Operations */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        isDestructive
        confirmLabel="Xác nhận xóa"
        onConfirm={async () => {
          await confirmDialog.action();
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

export default CustomerDetailPage;
