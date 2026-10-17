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
      if (!selectedPartnerId && data.some((u) => u.role === 'PARTNER')) {
        const firstPartner = data.find((u) => u.role === 'PARTNER');
        if (firstPartner) setSelectedPartnerId(firstPartner.id);
      }
    } catch (err: unknown) {
      toast.error('Lỗi tải danh sách tài khoản', err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setIsLoadingUsers(false);
    }
  }, [toast, selectedPartnerId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Load Assignments for Selected Partner
  const loadPartnerAssignments = useCallback(async (partnerId: string) => {
    if (!partnerId) return;
    setIsLoadingAssignments(true);
    try {
      const assignments = await authService.getUserAssignments(partnerId);
      setPartnerAssignments(assignments);
    } catch (err: unknown) {
      toast.error('Lỗi tải danh sách phân công', err instanceof Error ? err.message : 'Lỗi không xác định');
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

  // Unassign Customer Handler
  const handleUnassign = async (customerId: string, customerName?: string) => {
    if (!selectedPartnerId) return;
    if (!window.confirm(`Hủy phân công khách hàng "${customerName || customerId}" khỏi nhân viên này?`)) {
      return;
    }

    try {
      await authService.unassignCustomer({
        partnerUserId: selectedPartnerId,
        customerId,
      });
      toast.success('Đã hủy phân công khách hàng');
      await loadPartnerAssignments(selectedPartnerId);
      await loadUsers();
    } catch (err: unknown) {
      toast.error('Không thể hủy phân công', err instanceof Error ? err.message : 'Lỗi máy chủ');
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
                    <th className="px-4 py-3">Khách được giao</th>
                    <th className="px-4 py-3">Ngày tạo</th>
                    <th className="px-4 py-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {isLoadingUsers ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                        Đang tải danh sách người dùng...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
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
                  <div>
                    <h3 className="text-xs font-bold text-slate-100 font-mono uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-emerald-400" />
                      Khách hàng đã phân công ({partnerAssignments.length})
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Đang được giao cho {selectedPartner.fullName}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadPartnerAssignments(selectedPartnerId)}
                    disabled={isLoadingAssignments}
                    className="text-xs h-7 gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingAssignments ? 'animate-spin' : ''}`} />
                    <span>Tải lại</span>
                  </Button>
                </div>

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
                    partnerAssignments.map((a) => (
                      <div
                        key={a.id}
                        className="p-3 rounded-lg bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                      >
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
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500">
                            <span>Phân công: <DateDisplay date={a.assignedAt} /></span>
                            {a.notes && (
                              <span className="italic text-slate-400 max-w-[150px] truncate">
                                "{a.notes}"
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleUnassign(a.customerId, a.customer?.fullName)}
                          title="Hủy phân công khách hàng này"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors flex-shrink-0"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
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
    </div>
  );
};

export default UsersManagementPage;
