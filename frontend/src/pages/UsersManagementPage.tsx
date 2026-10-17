import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Lock,
  Unlock,
  KeyRound,
  UserCheck,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  FileText,
  UserMinus,
  Check,
  Loader2,
  Eye,
  EyeOff,
  CheckSquare,
  Square,
} from 'lucide-react';
import { authService } from '../services/authService';
import { customerService } from '../services/customerService';
import { AuthUser, UserRole, UserStatus, CustomerAssignmentItem, AuditLogItem } from '../types/auth';
import { CustomerSummary } from '../types/models';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { DateDisplay } from '../components/common';

export const UsersManagementPage: React.FC = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'users' | 'assignments' | 'audit'>('users');

  // Users State
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');



  // Create User Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createFullName, setCreateFullName] = useState('');
  const [createRole, setCreateRole] = useState<UserRole>('PARTNER');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Reset Password Modal State
  const [resetUser, setResetUser] = useState<AuthUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  // Assignment State
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  const [partnerAssignments, setPartnerAssignments] = useState<CustomerAssignmentItem[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(false);
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [availableCustomers, setAvailableCustomers] = useState<CustomerSummary[]>([]);
  const [isLoadingAvailableCustomers, setIsLoadingAvailableCustomers] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);
  const [unassigningAssignment, setUnassigningAssignment] = useState<CustomerAssignmentItem | null>(null);
  const [isSubmittingUnassign, setIsSubmittingUnassign] = useState(false);

  // Batch Assignment State
  const [selectedAssignedIds, setSelectedAssignedIds] = useState<string[]>([]);
  const [isBulkUnassignConfirmOpen, setIsBulkUnassignConfirmOpen] = useState(false);
  const [bulkUnassignSourceType, setBulkUnassignSourceType] = useState<'ALL' | 'DIRECT' | 'CARE_SCHEDULE'>('ALL');
  const [isBulkReassignModalOpen, setIsBulkReassignModalOpen] = useState(false);
  const [targetReassignUserId, setTargetReassignUserId] = useState('');
  const [bulkReassignNotes, setBulkReassignNotes] = useState('');
  const [isSubmittingBulkAction, setIsSubmittingBulkAction] = useState(false);

  // Audit Log State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('');

  // Load Users
  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      const data = await authService.getUsers();
      setUsers(data);
      setSelectedPartnerId((prev) => {
        if (!prev && data.some((u) => u.role === 'PARTNER')) {
          const firstPartner = data.find((u) => u.role === 'PARTNER');
          return firstPartner ? firstPartner.id : '';
        }
        return prev;
      });
    } catch (err: unknown) {
      toast.error('Lỗi tải danh sách tài khoản', err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setIsLoadingUsers(false);
    }
  }, [toast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Load Assignments for Selected Partner
  const loadPartnerAssignments = useCallback(async (partnerId: string) => {
    if (!partnerId) return;
    setIsLoadingAssignments(true);
    try {
      const assignments = await authService.getUserAssignments(partnerId);
      setPartnerAssignments(assignments || []);
    } catch (err: unknown) {
      setPartnerAssignments([]);
      toast.error('Lỗi tải danh sách phân công', err instanceof Error ? err.message : 'Không tìm thấy dữ liệu phân công');
    } finally {
      setIsLoadingAssignments(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'assignments' && selectedPartnerId) {
      loadPartnerAssignments(selectedPartnerId);
    }
  }, [activeTab, selectedPartnerId, loadPartnerAssignments]);

  // Search available customers for assignment
  const searchCustomersToAssign = useCallback(async (searchQuery: string) => {
    setIsLoadingAvailableCustomers(true);
    try {
      const res = await customerService.getCustomers({
        search: searchQuery.trim() || undefined,
        pageSize: 20,
      });
      setAvailableCustomers(res.data || []);
    } catch (err: unknown) {
      toast.error('Lỗi tìm kiếm khách hàng', err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setIsLoadingAvailableCustomers(false);
    }
  }, [toast]);

  useEffect(() => {
    if (activeTab === 'assignments') {
      const timer = setTimeout(() => {
        searchCustomersToAssign(assignSearchQuery);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [activeTab, assignSearchQuery, searchCustomersToAssign]);

  // Load Audit Logs
  const loadAuditLogs = useCallback(async () => {
    setIsLoadingAudit(true);
    try {
      const logs = await authService.getAuditLogs({
        action: auditActionFilter || undefined,
        limit: 100,
      });
      setAuditLogs(logs);
    } catch (err: unknown) {
      toast.error('Lỗi tải nhật ký kiểm toán', err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setIsLoadingAudit(false);
    }
  }, [auditActionFilter, toast]);

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab, loadAuditLogs]);

  // Toggle User Status (Lock/Unlock)
  const handleToggleStatus = async (user: AuthUser) => {
    const isCurrentlyActive = user.status === 'ACTIVE';
    const nextStatus: UserStatus = isCurrentlyActive ? 'SUSPENDED' : 'ACTIVE';
    const actionLabel = isCurrentlyActive ? 'khóa' : 'mở khóa';
    if (!window.confirm(`Bạn có chắc chắn muốn ${actionLabel} tài khoản ${user.email}?`)) {
      return;
    }

    try {
      await authService.updateUser(user.id, { status: nextStatus });
      toast.success(`Đã ${actionLabel} tài khoản ${user.email} thành công`);
      await loadUsers();
    } catch (err: unknown) {
      toast.error(`Không thể ${actionLabel} tài khoản`, err instanceof Error ? err.message : 'Lỗi máy chủ');
    }
  };

  // Create User Handler
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createEmail.trim() || !createPassword || !createFullName.trim()) {
      toast.warning('Vui lòng điền đầy đủ các thông tin bắt buộc');
      return;
    }

    if (createPassword.length < 8) {
      toast.warning('Mật khẩu phải có tối thiểu 8 ký tự');
      return;
    }

    setIsSubmittingCreate(true);
    try {
      await authService.createUser({
        email: createEmail.trim(),
        password: createPassword,
        fullName: createFullName.trim(),
        role: createRole,
      });
      toast.success(`Tạo tài khoản ${createEmail.trim()} thành công!`);
      setIsCreateModalOpen(false);
      setCreateEmail('');
      setCreatePassword('');
      setCreateFullName('');
      setCreateRole('PARTNER');
      await loadUsers();
    } catch (err: unknown) {
      toast.error('Không thể tạo tài khoản', err instanceof Error ? err.message : 'Lỗi máy chủ');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Reset Password Handler
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser) return;

    if (!newPassword || newPassword.length < 8) {
      toast.warning('Mật khẩu mới phải có tối thiểu 8 ký tự');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.warning('Mật khẩu xác nhận không khớp');
      return;
    }

    setIsSubmittingReset(true);
    try {
      await authService.updateUser(resetUser.id, { password: newPassword });
      toast.success(`Đã đặt lại mật khẩu an toàn cho tài khoản ${resetUser.email}`);
      setResetUser(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      toast.error('Không thể đặt lại mật khẩu', err instanceof Error ? err.message : 'Lỗi máy chủ');
    } finally {
      setIsSubmittingReset(false);
    }
  };

  // Assign Customers Handler
  const handleAssignCustomers = async () => {
    if (!selectedPartnerId) {
      toast.warning('Vui lòng chọn nhân viên được phân công');
      return;
    }
    if (selectedCustomerIds.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một khách hàng để phân công');
      return;
    }

    setIsSubmittingAssignment(true);
    try {
      const res = await authService.assignCustomers({
        partnerUserId: selectedPartnerId,
        customerIds: selectedCustomerIds,
        notes: assignmentNotes.trim() || undefined,
      });
      toast.success(`Phân công thành công ${res.affected} khách hàng!`);
      setSelectedCustomerIds([]);
      setAssignmentNotes('');
      await loadPartnerAssignments(selectedPartnerId);
      await loadUsers();
    } catch (err: unknown) {
      toast.error('Không thể phân công khách hàng', err instanceof Error ? err.message : 'Lỗi máy chủ');
    } finally {
      setIsSubmittingAssignment(false);
    }
  };

  // Unassign Customer Handlers
  const executeUnassign = async (
    customerId: string,
    sourceType?: 'DIRECT' | 'CARE_SCHEDULE' | 'ALL'
  ) => {
    if (!selectedPartnerId) return;
    setIsSubmittingUnassign(true);
    try {
      const res = await authService.unassignCustomer({
        partnerUserId: selectedPartnerId,
        customerId,
        sourceType,
      });

      if (res.completelyRevoked) {
        toast.success(res.message || 'Đã hủy phân công khách hàng.');
      } else {
        toast.info(res.message || 'Đã cập nhật nguồn phân công.');
      }

      setUnassigningAssignment(null);
      await loadPartnerAssignments(selectedPartnerId);
      await loadUsers();
    } catch (err: unknown) {
      toast.error('Không thể hủy phân công', err instanceof Error ? err.message : 'Lỗi máy chủ');
    } finally {
      setIsSubmittingUnassign(false);
    }
  };

  const handleUnassignClick = (a: CustomerAssignmentItem) => {
    const hasDirect = a.sources?.hasDirect ?? true;
    const hasCare = a.sources?.hasCareSchedule ?? false;

    if (hasDirect && hasCare) {
      // Both sources exist: open options modal
      setUnassigningAssignment(a);
    } else if (hasCare && !hasDirect) {
      // Only care schedule
      if (window.confirm(`Khách hàng "${a.customer?.fullName || a.customerId}" đang được phụ trách qua lịch chăm sóc. Bạn có chắc chắn muốn gỡ lịch chăm sóc và hủy phân công khỏi nhân viên này?`)) {
        executeUnassign(a.customerId, 'CARE_SCHEDULE');
      }
    } else {
      // Direct only (or legacy)
      if (window.confirm(`Hủy phân công trực tiếp khách hàng "${a.customer?.fullName || a.customerId}" khỏi nhân viên này?`)) {
        executeUnassign(a.customerId, 'DIRECT');
      }
    }
  };



  const handleToggleSelectAllAssigned = () => {
    if (selectedAssignedIds.length === partnerAssignments.length) {
      setSelectedAssignedIds([]);
    } else {
      setSelectedAssignedIds(partnerAssignments.map((a) => a.customerId));
    }
  };

  const handleToggleSelectAssignedItem = (customerId: string) => {
    setSelectedAssignedIds((prev) =>
      prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId]
    );
  };

  const handleExecuteBulkUnassign = async () => {
    if (selectedAssignedIds.length === 0 || !selectedPartnerId) return;
    setIsSubmittingBulkAction(true);
    try {
      const res = await authService.bulkUnassignCustomers({
        partnerUserId: selectedPartnerId,
        customerIds: selectedAssignedIds,
        sourceType: bulkUnassignSourceType,
      });

      if (res.failed.length === 0) {
        toast.success(res.message);
      } else if (res.succeeded.length > 0) {
        toast.warning(res.message);
      } else {
        toast.error('Lỗi khi hủy phân công', res.message);
      }

      setSelectedAssignedIds([]);
      setIsBulkUnassignConfirmOpen(false);
      await loadPartnerAssignments(selectedPartnerId);
      await loadUsers();
    } catch (err: unknown) {
      toast.error('Lỗi hủy phân công hàng loạt', err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setIsSubmittingBulkAction(false);
    }
  };

  const handleExecuteBulkReassign = async () => {
    if (selectedAssignedIds.length === 0 || !targetReassignUserId) return;
    setIsSubmittingBulkAction(true);
    try {
      const res = await authService.bulkReassignCustomers({
        fromUserId: selectedPartnerId,
        toUserId: targetReassignUserId,
        customerIds: selectedAssignedIds,
        notes: bulkReassignNotes || undefined,
      });

      if (res.failed.length === 0) {
        toast.success(res.message);
      } else if (res.succeeded.length > 0) {
        toast.warning(res.message);
      } else {
        toast.error('Lỗi khi chuyển giao khách hàng', res.message);
      }

      setSelectedAssignedIds([]);
      setIsBulkReassignModalOpen(false);
      setTargetReassignUserId('');
      setBulkReassignNotes('');
      await loadPartnerAssignments(selectedPartnerId);
      await loadUsers();
    } catch (err: unknown) {
      toast.error('Lỗi chuyển giao hàng loạt', err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setIsSubmittingBulkAction(false);
    }
  };

  // Filtered Users
  const filteredUsers = users.filter(
    (u) =>
      u.email.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      u.fullName.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  const partners = users.filter((u) => u.role === 'PARTNER');
  const selectedPartner = users.find((u) => u.id === selectedPartnerId);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 font-mono">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            Quản trị Phân quyền & Phân công Nhân viên
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Tạo tài khoản nhân viên, kiểm soát trạng thái, phân quyền và điều phối tệp khách hàng
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors font-sans flex items-center gap-1.5 ${
              activeTab === 'users'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Tài khoản ({users.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors font-sans flex items-center gap-1.5 ${
              activeTab === 'assignments'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Phân công khách</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors font-sans flex items-center gap-1.5 ${
              activeTab === 'audit'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Nhật ký bảo mật</span>
          </button>
        </div>
      </div>

      {/* TAB 1: USERS LIST */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                placeholder="Tìm kiếm theo email, họ tên, vai trò..."
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadUsers}
                disabled={isLoadingUsers}
                className="text-xs h-9 gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsCreateModalOpen(true)}
                className="text-xs h-9 gap-1.5 bg-blue-600 hover:bg-blue-500 text-white"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Tạo tài khoản</span>
              </Button>
            </div>
          </div>

          {/* Users Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Họ và tên / Email</th>
                    <th className="px-4 py-3">Vai trò</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Vai trò chăm sóc</th>
                    <th className="px-4 py-3">Khách được giao</th>
                    <th className="px-4 py-3">Ngày tạo</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {isLoadingUsers ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                        Đang tải danh sách người dùng...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500">
                        Không tìm thấy người dùng nào phù hợp
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-100">{u.fullName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                              u.role === 'ADMIN'
                                ? 'bg-indigo-950/70 text-indigo-300 border border-indigo-800/60'
                                : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                            }`}
                          >
                            {u.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                              u.status === 'ACTIVE'
                                ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'
                                : 'bg-rose-950/50 text-rose-400 border border-rose-800/50'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.status === 'ACTIVE' ? 'bg-emerald-400' : 'bg-rose-400'
                              }`}
                            />
                            {u.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã khóa'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {u.role === 'PARTNER' ? (
                            u.status === 'ACTIVE' ? (
                              <span className="font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40 text-[11px] inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Nhân viên chăm sóc
                              </span>
                            ) : (
                              <span className="font-mono text-rose-400 bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40 text-[11px] inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                Tạm dừng nhận lịch
                              </span>
                            )
                          ) : (
                            <span className="text-slate-500 font-mono text-[11px]">Quản trị viên</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {u.role === 'PARTNER' ? (
                            <span className="font-mono text-slate-200">
                              {u.assignedCustomersCount ?? 0} khách
                            </span>
                          ) : (
                            <span className="text-slate-500 font-mono text-[11px]">Toàn hệ thống</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-400 text-[11px]">
                          {u.createdAt ? <DateDisplay date={u.createdAt} /> : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">


                            {/* Reset Password Button */}
                            <button
                              onClick={() => setResetUser(u)}
                              title="Đặt lại mật khẩu"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>

                            {/* Lock/Unlock Button */}
                            <button
                              onClick={() => handleToggleStatus(u)}
                              title={u.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                              className={`p-1.5 rounded-lg transition-colors ${
                                u.status === 'ACTIVE'
                                    ? 'text-slate-400 hover:text-rose-400 hover:bg-rose-950/30'
                                    : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-950/30'
                              }`}
                            >
                              {u.status === 'ACTIVE' ? (
                                <Lock className="w-3.5 h-3.5" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOMER ASSIGNMENT */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          {/* Partner Selector */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300 font-mono uppercase tracking-wider">
                Chọn nhân viên (PARTNER) để điều phối
              </label>
              <p className="text-[11px] text-slate-400">
                Nhân viên này sẽ chỉ xem và thao tác trên tệp khách hàng được gán tại đây
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedPartnerId}
                onChange={(e) => setSelectedPartnerId(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-sans min-w-[240px]"
              >
                <option value="">-- Chọn nhân viên --</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({p.email}) - {p.assignedCustomersCount ?? 0} khách
                  </option>
                ))}
              </select>
              {selectedPartner && (
                <Badge
                  variant={selectedPartner.status === 'ACTIVE' ? 'success' : 'destructive'}
                  className="font-mono text-[10px]"
                >
                  {selectedPartner.status}
                </Badge>
              )}
            </div>
          </div>

          {selectedPartner ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column: Assigned Customers */}
              <div className="space-y-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    {partnerAssignments.length > 0 && (
                      <button
                        type="button"
                        onClick={handleToggleSelectAllAssigned}
                        title={selectedAssignedIds.length === partnerAssignments.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                        className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                      >
                        {selectedAssignedIds.length === partnerAssignments.length && partnerAssignments.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500" />
                        )}
                      </button>
                    )}
                    <div>
                      <h3 className="text-xs font-bold text-slate-100 font-mono uppercase tracking-wider flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-emerald-400" />
                        Khách hàng đã phân công ({partnerAssignments.length})
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Đang được giao cho {selectedPartner.fullName}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedAssignedIds([]);
                      loadPartnerAssignments(selectedPartnerId);
                    }}
                    disabled={isLoadingAssignments}
                    className="text-xs h-7 gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingAssignments ? 'animate-spin' : ''}`} />
                    <span>Tải lại</span>
                  </Button>
                </div>

                {/* Bulk Actions Toolbar for Assigned Customers */}
                {selectedAssignedIds.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-blue-950/40 border border-blue-500/40 flex flex-wrap items-center justify-between gap-2 animate-fade-in">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                        {selectedAssignedIds.length}
                      </span>
                      <span className="text-xs font-semibold text-slate-200">khách hàng được chọn</span>
                      <button
                        type="button"
                        onClick={() => setSelectedAssignedIds([])}
                        className="text-[11px] text-slate-400 hover:text-slate-200 underline ml-1 cursor-pointer"
                      >
                        Bỏ chọn tất cả
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTargetReassignUserId('');
                          setBulkReassignNotes('');
                          setIsBulkReassignModalOpen(true);
                        }}
                        className="h-7 text-xs px-2.5 gap-1.5 border-blue-700/80 text-blue-300 hover:bg-blue-900/40 font-medium"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                        <span>Đổi người chăm sóc</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setBulkUnassignSourceType('ALL');
                          setIsBulkUnassignConfirmOpen(true);
                        }}
                        className="h-7 text-xs px-2.5 gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-medium"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        <span>Hủy phân công đã chọn</span>
                      </Button>
                    </div>
                  </div>
                )}

                <div className="max-h-[500px] overflow-y-auto space-y-2 pr-1">
                  {isLoadingAssignments ? (
                    <div className="text-center py-10 text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                      Đang tải danh sách phân công...
                    </div>
                  ) : partnerAssignments.length === 0 ? (
                    <div className="text-center py-10 text-slate-500 bg-slate-950/40 rounded-lg border border-slate-850">
                      Chưa có khách hàng nào được phân công cho nhân viên này.
                    </div>
                  ) : (
                    partnerAssignments.map((a) => {
                      const isSelected = selectedAssignedIds.includes(a.customerId);
                      return (
                        <div
                          key={a.id}
                          onClick={() => handleToggleSelectAssignedItem(a.customerId)}
                          className={`p-3 rounded-lg border flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-950/30 border-blue-500/60'
                              : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // handled by parent onClick
                              onClick={(e) => e.stopPropagation()}
                              className="rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-0 cursor-pointer w-3.5 h-3.5 mt-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-xs text-slate-200">
                                  {a.customer?.fullName || 'Khách hàng'}
                                </span>
                                {a.customer?.phone && (
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {a.customer.phone}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                {a.sources?.hasDirect && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-950/80 text-blue-300 border border-blue-800/50">
                                    Trực tiếp
                                  </span>
                                )}
                                {a.sources?.hasCareSchedule && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800/50">
                                    Lịch chăm sóc ({a.sources.careSchedulesCount})
                                  </span>
                                )}
                                {!a.sources?.hasDirect && !a.sources?.hasCareSchedule && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-800 text-slate-300">
                                    Trực tiếp (Lịch sử)
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-500 font-mono ml-1">
                                  <DateDisplay date={a.assignedAt} />
                                </span>
                              </div>
                              {a.notes && (
                                <div className="mt-1 text-[10px] text-slate-400 italic truncate max-w-[280px]">
                                  "{a.notes}"
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUnassignClick(a);
                            }}
                            disabled={isSubmittingUnassign}
                            title="Hủy phân công khách hàng này"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors flex-shrink-0 disabled:opacity-50"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Search & Assign New Customers */}
              <div className="space-y-3 bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="pb-3 border-b border-slate-800">
                  <h3 className="text-xs font-bold text-slate-100 font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-blue-400" />
                    Gán thêm khách hàng mới
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Chọn từ danh sách khách hàng toàn hệ thống để chuyển giao
                  </p>
                </div>

                {/* Customer Search Box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={assignSearchQuery}
                    onChange={(e) => setAssignSearchQuery(e.target.value)}
                    placeholder="Tìm theo tên, SĐT khách hàng..."
                    className="w-full pl-8 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Customer Selectable List */}
                <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
                  {isLoadingAvailableCustomers ? (
                    <div className="text-center py-6 text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-blue-500" />
                      Đang tìm kiếm khách hàng...
                    </div>
                  ) : availableCustomers.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 bg-slate-950/40 rounded-lg">
                      Không tìm thấy khách hàng phù hợp
                    </div>
                  ) : (
                    availableCustomers.map((c) => {
                      const isAssignedToThis = partnerAssignments.some((pa) => pa.customerId === c.id);
                      const isSelected = selectedCustomerIds.includes(c.id);

                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            if (isAssignedToThis) return;
                            setSelectedCustomerIds((prev) =>
                              prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                            );
                          }}
                          className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                            isAssignedToThis
                              ? 'bg-slate-950/40 border-slate-850 opacity-50 cursor-not-allowed'
                              : isSelected
                              ? 'bg-blue-950/30 border-blue-500/50'
                              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-500 text-white'
                                  : 'border-slate-700 bg-slate-900'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                            <div className="min-w-0">
                              <span className="font-medium text-slate-200 block truncate">
                                {c.fullName}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {c.phone} {c.address ? `• ${c.address}` : ''}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isAssignedToThis ? (
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-800/40">
                                Đã giao
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-slate-500">
                                {c.overallStatus}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Assignment Notes & Action */}
                <div className="pt-3 border-t border-slate-800 space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-300 block mb-1">
                      Ghi chú phân công (tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={assignmentNotes}
                      onChange={(e) => setAssignmentNotes(e.target.value)}
                      placeholder="VD: Giao chăm sóc lại đợt 2"
                      className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-mono">
                      Đã chọn: <strong className="text-blue-400">{selectedCustomerIds.length}</strong> khách
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleAssignCustomers}
                      disabled={selectedCustomerIds.length === 0 || isSubmittingAssignment}
                      className="text-xs h-8 gap-1.5 bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                    >
                      {isSubmittingAssignment ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Xác nhận phân công</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-xl text-slate-500">
              Vui lòng chọn một nhân viên PARTNER ở trên để bắt đầu phân công khách hàng.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-mono">Lọc theo hành động:</label>
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
              >
                <option value="">-- Tất cả hành động --</option>
                <option value="LOGIN">LOGIN</option>
                <option value="USER_CREATE">USER_CREATE</option>
                <option value="USER_STATUS_CHANGE">USER_STATUS_CHANGE</option>
                <option value="PASSWORD_RESET">PASSWORD_RESET</option>
                <option value="CUSTOMER_ASSIGN">CUSTOMER_ASSIGN</option>
                <option value="CUSTOMER_UNASSIGN">CUSTOMER_UNASSIGN</option>
              </select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadAuditLogs}
              disabled={isLoadingAudit}
              className="text-xs h-8 gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAudit ? 'animate-spin' : ''}`} />
              <span>Làm mới nhật ký</span>
            </Button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Thời gian</th>
                    <th className="px-4 py-3">Hành động</th>
                    <th className="px-4 py-3">Người thực hiện</th>
                    <th className="px-4 py-3">Mục tiêu</th>
                    <th className="px-4 py-3">Địa chỉ IP</th>
                    <th className="px-4 py-3">Chi tiết bổ sung</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {isLoadingAudit ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                        Đang tải nhật ký bảo mật...
                      </td>
                    </tr>
                  ) : auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        Chưa có nhật ký kiểm toán nào được ghi nhận
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          <DateDisplay date={log.createdAt} />
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-950 text-indigo-300 border border-indigo-900/40">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-300">
                          {log.actorEmail || log.actorId || 'Hệ thống'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 font-mono text-[11px]">
                          {log.entityType}: {log.entityId ? log.entityId.substring(0, 8) + '...' : 'N/A'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[11px] text-slate-400">
                          {log.ipAddress || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-[11px]">
                          {log.details ? (
                            <pre className="max-w-xs truncate font-mono text-[10px]">
                              {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                            </pre>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE USER */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/40">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 font-mono">Tạo tài khoản mới</h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Cấp tài khoản đăng nhập riêng cho nhân viên
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono uppercase">
                  Họ và tên
                </label>
                <input
                  type="text"
                  value={createFullName}
                  onChange={(e) => setCreateFullName(e.target.value)}
                  placeholder="VD: Nguyễn Văn A"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono uppercase">
                  Email đăng nhập
                </label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="partner1@ktea.vn"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono uppercase">
                  Mật khẩu khởi tạo (tối thiểu 8 ký tự)
                </label>
                <div className="relative">
                  <input
                    type={showCreatePassword ? 'text' : 'password'}
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    minLength={8}
                    className="w-full px-3 py-2 pr-10 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreatePassword(!showCreatePassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                  >
                    {showCreatePassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono uppercase">
                  Vai trò (Role)
                </label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                >
                  <option value="PARTNER">PARTNER - Nhân viên (Chỉ xem khách được phân công)</option>
                  <option value="ADMIN">ADMIN - Quản trị viên (Toàn quyền hệ thống)</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingCreate}
                  className="text-xs bg-blue-600 hover:bg-blue-500 text-white"
                >
                  {isSubmittingCreate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Lưu tài khoản</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/40">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 font-mono">
                  Đặt lại mật khẩu an toàn
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Tài khoản: <strong className="text-slate-200">{resetUser.email}</strong>
                </p>
              </div>
              <button
                onClick={() => setResetUser(null)}
                className="text-slate-500 hover:text-slate-300 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono uppercase">
                  Mật khẩu mới (tối thiểu 8 ký tự)
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    minLength={8}
                    className="w-full px-3 py-2 pr-10 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                  >
                    {showNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1 font-mono uppercase">
                  Xác nhận lại mật khẩu mới
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div className="p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  Quy trình an toàn: Sau khi cập nhật, mật khẩu được băm (hash) bằng bcrypt và không bao giờ hiển thị lại trên giao diện.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setResetUser(null)}
                  className="text-xs"
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmittingReset}
                  className="text-xs bg-amber-600 hover:bg-amber-500 text-white"
                >
                  {isSubmittingReset ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Cập nhật mật khẩu</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Multi-Source Unassign Options Modal */}
      {unassigningAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400">
                <UserMinus className="w-5 h-5" />
                <h3 className="font-bold text-sm text-slate-100">
                  Tùy chọn hủy phân công khách hàng
                </h3>
              </div>
              <button
                onClick={() => setUnassigningAssignment(null)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p>
                Khách hàng <strong className="text-slate-100">{unassigningAssignment.customer?.fullName}</strong> đang được phân công cho nhân viên này qua nhiều nguồn:
              </p>
              <div className="flex gap-2 pt-0.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-950 text-blue-300 border border-blue-800">
                  Phân công trực tiếp
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">
                  Lịch chăm sóc ({unassigningAssignment.sources?.careSchedulesCount || 0})
                </span>
              </div>
              <p className="text-slate-400 text-[11px] pt-1">
                Vui lòng chọn nguồn phân công bạn muốn hủy:
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => executeUnassign(unassigningAssignment.customerId, 'DIRECT')}
                disabled={isSubmittingUnassign}
                className="w-full text-left p-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-blue-500/50 hover:bg-blue-950/20 transition-colors group disabled:opacity-50"
              >
                <div className="font-medium text-xs text-blue-300 flex items-center justify-between">
                  <span>1. Chỉ hủy phân công trực tiếp</span>
                  <span className="text-[10px] font-mono text-slate-500 group-hover:text-blue-400">DIRECT</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Gỡ quyền gán trực tiếp bởi Admin. Nhân viên vẫn được xem khách hàng qua các lịch chăm sóc hiện có.
                </p>
              </button>

              <button
                type="button"
                onClick={() => executeUnassign(unassigningAssignment.customerId, 'CARE_SCHEDULE')}
                disabled={isSubmittingUnassign}
                className="w-full text-left p-3 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-emerald-500/50 hover:bg-emerald-950/20 transition-colors group disabled:opacity-50"
              >
                <div className="font-medium text-xs text-emerald-300 flex items-center justify-between">
                  <span>2. Chỉ gỡ khỏi lịch chăm sóc</span>
                  <span className="text-[10px] font-mono text-slate-500 group-hover:text-emerald-400">CARE_SCHEDULE</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Gỡ nhân viên khỏi lịch chăm sóc (không xóa lịch). Nhân viên vẫn giữ quyền do còn phân công trực tiếp.
                </p>
              </button>

              <button
                type="button"
                onClick={() => executeUnassign(unassigningAssignment.customerId, 'ALL')}
                disabled={isSubmittingUnassign}
                className="w-full text-left p-3 rounded-xl border border-rose-900/60 bg-rose-950/20 hover:border-rose-600 hover:bg-rose-950/40 transition-colors group disabled:opacity-50"
              >
                <div className="font-medium text-xs text-rose-300 flex items-center justify-between">
                  <span>3. Hủy toàn bộ phân công</span>
                  <span className="text-[10px] font-mono text-rose-400 font-bold">ALL</span>
                </div>
                <p className="text-[11px] text-rose-300/80 mt-0.5">
                  Thu hồi hoàn toàn quyền trực tiếp và gỡ lịch chăm sóc. Khách hàng sẽ bị gỡ hoàn toàn khỏi nhân viên này.
                </p>
              </button>
            </div>

            <div className="pt-2 flex justify-end border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUnassigningAssignment(null)}
                disabled={isSubmittingUnassign}
                className="text-xs"
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: BULK UNASSIGN CONFIRMATION */}
      {isBulkUnassignConfirmOpen && selectedPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-rose-900/60 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-rose-400 font-mono font-bold text-sm">
                <UserMinus className="w-4 h-4" />
                <span>Xác nhận Hủy phân công hàng loạt</span>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkUnassignConfirmOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-300">
              <p>
                Bạn đang chuẩn bị hủy phân công{' '}
                <strong className="text-rose-400 font-mono font-bold">{selectedAssignedIds.length}</strong> khách hàng
                khỏi nhân viên <strong className="text-slate-100">{selectedPartner.fullName}</strong>.
              </p>
              <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">🛡️ Bảo toàn dữ liệu:</p>
                <p>• Không xóa thông tin khách hàng hay hồ sơ vay.</p>
                <p>• Không xóa lịch sử chăm sóc và nội dung ghi chú.</p>
                <p>• Chỉ thu hồi quyền phân công thuộc phạm vi đã chọn.</p>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-[11px] font-semibold text-slate-300 font-mono">
                  Phạm vi nguồn phân công cần hủy:
                </label>
                <select
                  value={bulkUnassignSourceType}
                  onChange={(e) => setBulkUnassignSourceType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-rose-500 font-sans"
                >
                  <option value="ALL">Hủy toàn bộ phân công (Trực tiếp & Lịch chăm sóc)</option>
                  <option value="DIRECT">Chỉ hủy nguồn phân công trực tiếp (Giữ lại lịch chăm sóc)</option>
                  <option value="CARE_SCHEDULE">Chỉ gỡ khỏi lịch chăm sóc (Giữ lại phân công trực tiếp)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBulkUnassignConfirmOpen(false)}
                disabled={isSubmittingBulkAction}
                className="text-xs"
              >
                Hủy bỏ
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleExecuteBulkUnassign}
                disabled={isSubmittingBulkAction}
                className="text-xs gap-1.5 bg-rose-600 hover:bg-rose-500 font-medium"
              >
                {isSubmittingBulkAction ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xử lý...</span>
                  </>
                ) : (
                  <>
                    <UserMinus className="w-3.5 h-3.5" />
                    <span>Xác nhận hủy ({selectedAssignedIds.length})</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BULK REASSIGN (ĐỔI NGƯỜI CHĂM SÓC HÀNG LOẠT) */}
      {isBulkReassignModalOpen && selectedPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md p-6 rounded-2xl bg-slate-900 border border-blue-900/60 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-blue-400 font-mono font-bold text-sm">
                <UserCheck className="w-4 h-4" />
                <span>Đổi người chăm sóc hàng loạt</span>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkReassignModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                Chuyển giao <strong className="text-blue-400 font-mono font-bold">{selectedAssignedIds.length}</strong> khách hàng
                từ nhân viên <strong className="text-slate-100">{selectedPartner.fullName}</strong> sang nhân viên mới:
              </p>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 font-mono">
                  Chọn nhân viên chăm sóc mới: *
                </label>
                <select
                  value={targetReassignUserId}
                  onChange={(e) => setTargetReassignUserId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
                >
                  <option value="">-- Chọn nhân viên mới --</option>
                  {users
                    .filter((u) => u.status === 'ACTIVE' && u.id !== selectedPartnerId)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'}) - {u.assignedCustomersCount ?? 0} khách
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-300 font-mono">
                  Ghi chú bàn giao (tùy chọn):
                </label>
                <textarea
                  value={bulkReassignNotes}
                  onChange={(e) => setBulkReassignNotes(e.target.value)}
                  placeholder="VD: Điều phối lại khu vực chăm sóc khách hàng đợt 2"
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-sans resize-none"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-blue-950/30 border border-blue-800/40 text-[11px] text-blue-300">
                💡 Hệ thống sẽ tự động chuyển phân công trực tiếp và đồng bộ các lịch chăm sóc đang mở cho người mới.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsBulkReassignModalOpen(false)}
                disabled={isSubmittingBulkAction}
                className="text-xs"
              >
                Hủy bỏ
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleExecuteBulkReassign}
                disabled={!targetReassignUserId || isSubmittingBulkAction}
                className="text-xs gap-1.5 bg-blue-600 hover:bg-blue-500 font-medium text-white"
              >
                {isSubmittingBulkAction ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang chuyển giao...</span>
                  </>
                ) : (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Chuyển giao ({selectedAssignedIds.length})</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersManagementPage;
