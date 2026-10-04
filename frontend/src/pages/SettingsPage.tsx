import React, { useState } from 'react';
import {
  Settings,
  Package,
  Tag as TagIcon,
  Target,
  Sliders,
  Database,
  Download,
  Terminal,
  CheckCircle2,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Power,
  Shield,
  HelpCircle,
  Copy,
  Layers,
  Sparkles,
  Globe,
} from 'lucide-react';
import {
  PageHeader,
  ConfirmDialog,
  ErrorState,
  DateDisplay,
} from '../components/common';
import { Skeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { useToast } from '../context/ToastContext';
import {
  useSettings,
  useUpdateGeneralSettings,
  useUpdateNeedCategories,
  useUpdateRecommendationSettings,
  useDataGovernanceStatus,
} from '../hooks/useSettings';
import { useProducts, useUpdateProduct } from '../hooks/useProducts';
import { useTags, useDeleteTag } from '../hooks/useTags';
import { useCustomerSources, useUpdateCustomerSource } from '../hooks/useCustomerSources';
import { Product, Tag } from '../types/models';
import { NeedCategorySetting } from '../types/settings';
import settingsService from '../services/settingsService';
import { ProductModal } from '../features/settings/ProductModal';
import { TagModal } from '../features/settings/TagModal';
import { NeedCategoryModal } from '../features/settings/NeedCategoryModal';
import { CustomerSourceModal } from '../features/settings/CustomerSourceModal';

type SettingsTab =
  | 'general'
  | 'sources'
  | 'products'
  | 'tags'
  | 'needs'
  | 'statuses'
  | 'rules'
  | 'data';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const { toast } = useToast();

  // Queries
  const { data: settings, isLoading: isSettingsLoading, isError: isSettingsError, refetch: refetchSettings } = useSettings();
  const { data: sources, isLoading: isSourcesLoading } = useCustomerSources();
  const { data: products, isLoading: isProductsLoading } = useProducts(false);
  const { data: tags, isLoading: isTagsLoading } = useTags();
  const { data: dataGov, isLoading: isDataGovLoading, refetch: refetchDataGov } = useDataGovernanceStatus();

  // Mutations
  const updateGeneral = useUpdateGeneralSettings();
  const updateSource = useUpdateCustomerSource();
  const updateNeedCategories = useUpdateNeedCategories();
  const updateRecommendations = useUpdateRecommendationSettings();
  const updateProduct = useUpdateProduct();
  const deleteTag = useDeleteTag();

  // Customer Source Modal State
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);

  // General Form State
  const [appName, setAppName] = useState('');
  const [defaultPageSize, setDefaultPageSize] = useState(10);
  const [dateFormat, setDateFormat] = useState('YYYY-MM-DD');
  const [timezone, setTimezone] = useState('Asia/Ho_Chi_Minh');
  const [isGeneralSaved, setIsGeneralSaved] = useState(false);

  // Sync general state when settings load
  React.useEffect(() => {
    if (settings?.general) {
      setAppName(settings.general.appName);
      setDefaultPageSize(settings.general.defaultPageSize);
      setDateFormat(settings.general.dateFormat);
      setTimezone(settings.general.timezone);
    }
  }, [settings]);

  // Product Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Tag Modal State
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);

  // Need Category Modal State
  const [editingCategory, setEditingCategory] = useState<NeedCategorySetting | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Recommendation Tuning Local State
  const [recConfig, setRecConfig] = useState(settings?.recommendationSettings);
  const [isRecsSaved, setIsRecsSaved] = useState(false);

  React.useEffect(() => {
    if (settings?.recommendationSettings) {
      setRecConfig(settings.recommendationSettings);
    }
  }, [settings]);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);

  if (isSettingsLoading) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto py-6">
        <div className="space-y-2 pb-2 border-b border-slate-800">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="flex gap-2 pb-2 border-b border-slate-800">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg" />
          ))}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-6 space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
    );
  }

  if (isSettingsError || !settings) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto py-10">
        <PageHeader
          title="Cài đặt hệ thống & Quản trị dữ liệu"
          category="Quản trị"
          description="Tham số vận hành đơn người dùng, danh mục sản phẩm, quy tắc đề xuất và giám sát cơ sở dữ liệu."
        />
        <ErrorState
          title="Không thể tải cài đặt hệ thống"
          description="Không thể đọc dữ liệu cấu hình. Vui lòng kiểm tra kết nối dịch vụ máy chủ backend."
          onRetry={() => refetchSettings()}
        />
      </div>
    );
  }

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateGeneral.mutateAsync({
        appName: appName.trim(),
        defaultPageSize: Number(defaultPageSize),
        dateFormat,
        timezone,
      });
      setIsGeneralSaved(true);
      toast.success('Đã lưu cài đặt', 'Cấu hình không gian làm việc chung đã được cập nhật thành công.');
      setTimeout(() => setIsGeneralSaved(false), 3000);
    } catch (err: any) {
      toast.error('Lưu thất bại', err?.message || 'Không thể cập nhật cài đặt chung.');
    }
  };

  const handleToggleProductActive = async (p: Product) => {
    try {
      await updateProduct.mutateAsync({
        id: p.id,
        data: { active: !p.active },
      });
      toast.info(p.active ? 'Đã tắt kích hoạt sản phẩm' : 'Đã kích hoạt sản phẩm', `Trạng thái "${p.name}" đã được cập nhật.`);
    } catch (err: any) {
      toast.error('Cập nhật thất bại', err?.message || 'Không thể thay đổi trạng thái sản phẩm.');
    }
  };

  const handleDeleteTagConfirm = async () => {
    if (!deletingTag) return;
    try {
      await deleteTag.mutateAsync(deletingTag.id);
      toast.success('Đã xóa thẻ', `Thẻ "${deletingTag.name}" đã được gỡ bỏ.`);
      setDeletingTag(null);
    } catch (err: any) {
      toast.error('Xóa thất bại', err?.message || 'Không thể gỡ bỏ thẻ.');
    }
  };

  const handleToggleNeedCategory = async (code: string) => {
    const updated = settings.needCategories.map((c) =>
      c.code === code ? { ...c, active: !c.active } : c
    );
    await updateNeedCategories.mutateAsync(updated);
    toast.info('Đã cập nhật nhóm nhu cầu', 'Trạng thái nhóm nhu cầu đã thay đổi.');
  };

  const handleSaveNeedCategory = async (cat: NeedCategorySetting) => {
    const exists = settings.needCategories.some((c) => c.code === cat.code);
    let updated: NeedCategorySetting[];
    if (exists) {
      updated = settings.needCategories.map((c) => (c.code === cat.code ? cat : c));
    } else {
      updated = [...settings.needCategories, cat];
    }
    await updateNeedCategories.mutateAsync(updated);
    toast.success('Đã lưu nhóm nhu cầu', `Cập nhật nhóm "${cat.label}" thành công.`);
  };

  const handleSaveRecommendationSettings = async () => {
    if (!recConfig) return;
    try {
      await updateRecommendations.mutateAsync(recConfig);
      setIsRecsSaved(true);
      toast.success('Đã cập nhật quy tắc', 'Trọng số và ngưỡng của thuật toán đề xuất đã được cập nhật.');
      setTimeout(() => setIsRecsSaved(false), 3000);
    } catch (err: any) {
      toast.error('Lưu thất bại', err?.message || 'Không thể lưu cài đặt đề xuất.');
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      await settingsService.exportData();
      toast.success('Đã tải bản sao lưu', 'Xuất bản sao lưu JSON toàn diện thành công.');
    } catch (err) {
      toast.error('Xuất dữ liệu thất bại', (err as Error).message || 'Quá trình xuất cơ sở dữ liệu gặp lỗi.');
    } finally {
      setIsExporting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Header */}
      <PageHeader
        title="Cài đặt & Quản trị dữ liệu"
        category="Quản trị hệ thống"
        description="Cấu hình tham số vận hành, quản lý danh mục sản phẩm/thẻ, điều chỉnh trọng số thuật toán đề xuất và theo dõi tình trạng cơ sở dữ liệu."
      />

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 overflow-x-auto text-xs font-mono">
        {[
          { key: 'general', label: 'Cài đặt chung', icon: <Settings className="w-3.5 h-3.5" /> },
          { key: 'sources', label: `Nguồn khách (${sources?.length || 0})`, icon: <Globe className="w-3.5 h-3.5" /> },
          { key: 'products', label: `Sản phẩm (${products?.length || 0})`, icon: <Package className="w-3.5 h-3.5" /> },
          { key: 'tags', label: `Thẻ khách hàng (${tags?.length || 0})`, icon: <TagIcon className="w-3.5 h-3.5" /> },
          { key: 'needs', label: `Nhóm nhu cầu (${settings.needCategories.length})`, icon: <Target className="w-3.5 h-3.5" /> },
          { key: 'statuses', label: 'Phân loại trạng thái', icon: <Layers className="w-3.5 h-3.5" /> },
          { key: 'rules', label: 'Quy tắc đề xuất', icon: <Sliders className="w-3.5 h-3.5" /> },
          { key: 'data', label: 'Quản trị dữ liệu & Sao lưu', icon: <Database className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as SettingsTab)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: GENERAL SETTINGS                                               */}
      {/* ========================================================================= */}
      {activeTab === 'general' && (
        <div className="max-w-2xl space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">
                Tham số ứng dụng chung
              </h3>
              <p className="text-xs text-slate-400">
                Tùy chọn giao diện, số lượng bản ghi hiển thị mỗi trang và định dạng ngày tháng cục bộ cho người vận hành
              </p>
            </div>

            <form onSubmit={handleSaveGeneral} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Tên ứng dụng</label>
                <input
                  type="text"
                  required
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Số bản ghi mặc định mỗi trang</label>
                  <select
                    value={defaultPageSize}
                    onChange={(e) => setDefaultPageSize(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  >
                    <option value={5}>5 bản ghi / trang</option>
                    <option value={10}>10 bản ghi / trang</option>
                    <option value={20}>20 bản ghi / trang</option>
                    <option value={50}>50 bản ghi / trang</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Định dạng hiển thị ngày tháng</label>
                  <select
                    value={dateFormat}
                    onChange={(e) => setDateFormat(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                  >
                    <option value="YYYY-MM-DD">YYYY-MM-DD (Chuẩn quốc tế ISO: 2026-10-03)</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY (Chuẩn Việt Nam: 03/10/2026)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (Chuẩn Mỹ: 10/03/2026)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Múi giờ hệ thống</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (Giờ Đông Dương, UTC+7)</option>
                  <option value="UTC">UTC (Giờ phối hợp quốc tế)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (Giờ chuẩn Nhật Bản, UTC+9)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT, UTC+8)</option>
                  <option value="America/New_York">America/New_York (Giờ miền Đông Bắc Mỹ)</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <div className="text-xs text-emerald-400 font-mono">
                  {isGeneralSaved && '✓ Cấu hình đã được lưu và cập nhật'}
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  type="submit"
                  disabled={updateGeneral.isPending}
                  className="bg-blue-600 hover:bg-blue-500 text-white"
                >
                  {updateGeneral.isPending ? 'Đang lưu...' : 'Lưu cài đặt chung'}
                </Button>
              </div>
            </form>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2 text-xs text-slate-400 leading-relaxed">
            <div className="flex items-center gap-2 text-slate-200 font-medium">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Xác nhận kiến trúc đơn người dùng</span>
            </div>
            <p>
              Tuân thủ các nguyên tắc thiết kế của dự án, hệ thống này hoạt động theo mô hình vận hành chuyên dụng không có rào cản phân quyền đa người dùng, hạn sử dụng mật khẩu hay các bảng phân quyền phức tạp.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION: CUSTOMER SOURCES (Section 14)                                    */}
      {/* ========================================================================= */}
      {activeTab === 'sources' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">
                Nguồn khách hàng (Customer Sources)
              </h3>
              <p className="text-xs text-slate-400">
                Quản lý danh sách các nguồn tiếp cận khách hàng. Nguồn đã tạm dừng sẽ không xuất hiện khi tạo khách mới nhưng vẫn lưu trữ trong lịch sử.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsSourceModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5 text-xs h-8 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Thêm nguồn khách</span>
            </Button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Tên nguồn khách</th>
                  <th className="py-2.5 px-4">Trạng thái</th>
                  <th className="py-2.5 px-4">Ngày tạo</th>
                  <th className="py-2.5 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {isSourcesLoading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 text-xs">
                      Đang tải danh sách nguồn khách...
                    </td>
                  </tr>
                ) : !sources || sources.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-500 text-xs">
                      Chưa có nguồn khách hàng nào được cấu hình.
                    </td>
                  </tr>
                ) : (
                  sources.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-100">
                        {s.name}
                      </td>
                      <td className="py-3 px-4">
                        {s.active ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Đang hoạt động (Active)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 text-slate-400 border border-slate-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                            Tạm dừng (Inactive)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        <DateDisplay date={s.createdAt} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              await updateSource.mutateAsync({
                                id: s.id,
                                data: { active: !s.active },
                              });
                              toast.success(
                                'Cập nhật thành công',
                                `Nguồn "${s.name}" đã được ${!s.active ? 'kích hoạt' : 'vô hiệu hóa'}.`
                              );
                            } catch (err: unknown) {
                              const message = err instanceof Error ? err.message : 'Không thể thay đổi trạng thái nguồn.';
                              toast.error('Lỗi cập nhật', message);
                            }
                          }}
                          disabled={updateSource.isPending}
                          className={`h-6 px-2.5 text-[11px] font-mono ${
                            s.active
                              ? 'border-amber-800/80 text-amber-300 hover:bg-amber-950/40'
                              : 'border-emerald-800/80 text-emerald-300 hover:bg-emerald-950/40'
                          }`}
                        >
                          {s.active ? 'Vô hiệu hóa' : 'Kích hoạt'}
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: PRODUCTS (Create / Edit / Deactivate)                           */}
      {/* ========================================================================= */}
      {activeTab === 'products' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">Danh mục sản phẩm</h3>
              <p className="text-xs text-slate-400">
                Danh mục sản phẩm sử dụng trong hồ sơ khách hàng, phân bổ chuyển giao và khớp quy tắc đề xuất
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingProduct(null);
                setIsProductModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5 text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm sản phẩm</span>
            </Button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Mã định danh</th>
                  <th className="p-3">Tên sản phẩm</th>
                  <th className="p-3">Mô tả</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {isProductsLoading ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      Đang tải danh mục sản phẩm...
                    </td>
                  </tr>
                ) : (products || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      Chưa có sản phẩm nào. Hãy thêm sản phẩm đầu tiên vào danh mục.
                    </td>
                  </tr>
                ) : (
                  (products || []).map((prod) => (
                    <tr key={prod.id} className="hover:bg-slate-800/30 text-slate-300">
                      <td className="p-3 font-semibold text-blue-400">{prod.code}</td>
                      <td className="p-3 font-sans font-medium text-slate-100">{prod.name}</td>
                      <td className="p-3 font-sans text-slate-400 max-w-xs truncate" title={prod.description || ''}>
                        {prod.description || '—'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            prod.active
                              ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/60'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          }`}
                        >
                          {prod.active ? 'ĐANG DÙNG' : 'ĐÃ TẮT'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleProductActive(prod)}
                            className={`h-7 px-2 text-[10px] font-mono ${
                              prod.active ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'
                            }`}
                            title={prod.active ? 'Tắt kích hoạt sản phẩm' : 'Kích hoạt sản phẩm'}
                          >
                            <Power className="w-3 h-3 mr-1" />
                            {prod.active ? 'Tắt' : 'Bật'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingProduct(prod);
                              setIsProductModalOpen(true);
                            }}
                            className="h-7 px-2 text-[10px] text-slate-300 hover:text-white"
                            title="Chỉnh sửa sản phẩm"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: TAGS (Create / Edit / Delete)                                   */}
      {/* ========================================================================= */}
      {activeTab === 'tags' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">Thẻ khách hàng</h3>
              <p className="text-xs text-slate-400">
                Phân đoạn khách hàng, định danh chân dung chiến lược và tổ chức nhóm chăm sóc
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingTag(null);
                setIsTagModalOpen(true);
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5 text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo thẻ mới</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {isTagsLoading ? (
              <div className="col-span-full p-8 text-center text-slate-500 text-xs font-mono">
                Đang tải thẻ khách hàng...
              </div>
            ) : (tags || []).length === 0 ? (
              <div className="col-span-full p-8 text-center text-slate-500 text-xs font-mono">
                Chưa có thẻ nào được tạo.
              </div>
            ) : (
              (tags || []).map((tag) => (
                <div
                  key={tag.id}
                  className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 flex items-center justify-between hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color || '#3b82f6' }}
                    />
                    <div className="min-w-0">
                      <span className="font-semibold text-xs text-slate-200 block truncate font-sans">
                        {tag.name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {tag._count?.customerTags ?? 0} khách hàng được gắn
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingTag(tag);
                        setIsTagModalOpen(true);
                      }}
                      className="h-6 w-6 p-0 text-slate-400 hover:text-slate-200"
                      title="Chỉnh sửa thẻ"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingTag(tag)}
                      className="h-6 w-6 p-0 text-slate-400 hover:text-rose-400"
                      title="Xóa thẻ"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: NEEDS (Available need categories)                               */}
      {/* ========================================================================= */}
      {activeTab === 'needs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">Danh mục nhóm nhu cầu</h3>
              <p className="text-xs text-slate-400">
                Các nhóm nhu cầu tài chính chuẩn hóa phục vụ thẩm định và ghi nhận trên hồ sơ khách hàng
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setEditingCategory(null);
                setIsCategoryModalOpen(true);
              }}
              className="bg-amber-600 hover:bg-amber-500 text-white gap-1.5 text-xs h-8"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm nhóm nhu cầu</span>
            </Button>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 font-mono text-[10px] border-b border-slate-800">
                <tr>
                  <th className="p-3">Mã chuẩn hóa</th>
                  <th className="p-3">Tên hiển thị</th>
                  <th className="p-3">Mô tả & Phạm vi</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {settings.needCategories.map((cat) => (
                  <tr key={cat.code} className="hover:bg-slate-800/30 text-slate-300">
                    <td className="p-3 font-semibold text-amber-400">{cat.code}</td>
                    <td className="p-3 font-sans font-medium text-slate-100">{cat.label}</td>
                    <td className="p-3 font-sans text-slate-400 max-w-sm truncate" title={cat.description}>
                      {cat.description}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          cat.active
                            ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/60'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {cat.active ? 'HOẠT ĐỘNG' : 'TẠM TẮT'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleNeedCategory(cat.code)}
                          className={`h-7 px-2 text-[10px] font-mono ${
                            cat.active ? 'text-amber-400 hover:text-amber-300' : 'text-emerald-400 hover:text-emerald-300'
                          }`}
                        >
                          <Power className="w-3 h-3 mr-1" />
                          {cat.active ? 'Tắt' : 'Bật'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingCategory(cat);
                            setIsCategoryModalOpen(true);
                          }}
                          className="h-7 px-2 text-[10px] text-slate-300 hover:text-white"
                          title="Chỉnh sửa nhóm nhu cầu"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: STATUSES (Allowed business values catalog)                      */}
      {/* ========================================================================= */}
      {activeTab === 'statuses' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 font-mono">
              Hệ thống phân loại trạng thái nghiệp vụ
            </h3>
            <p className="text-xs text-slate-400">
              Các giá trị enum chuẩn trong cơ sở dữ liệu và ý nghĩa nghiệp vụ tương ứng theo từng phân hệ
            </p>
          </div>

          <div className="p-3 rounded-lg bg-blue-950/30 border border-blue-900/50 flex items-start gap-2.5 text-xs text-blue-300">
            <HelpCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Cam kết tính toàn vẹn kiến trúc:</strong> Trạng thái được kiểm soát chặt chẽ bởi MySQL Enum (`CustomerStatus`, `CaseStatus`, `PushStatus`, `FollowUpStatus`, `RecommendationStatus`) nhằm ngăn chặn trạng thái không hợp lệ. Mục này hiển thị định nghĩa nghiệp vụ chính thức và quy tắc luồng công việc.
            </div>
          </div>

          <div className="space-y-4">
            {[
              { domain: 'Customer', label: 'Vòng đời khách hàng (Khách hàng)' },
              { domain: 'Case', label: 'Hồ sơ dịch vụ (Hồ sơ)' },
              { domain: 'Push', label: 'Quy trình chuyển khách (Chuyển khách)' },
              { domain: 'FollowUp', label: 'Lịch chăm sóc (Lịch hẹn)' },
              { domain: 'Recommendation', label: 'Công cụ đề xuất (Đề xuất)' },
            ].map(({ domain, label }) => {
              const domainStatuses = settings.statuses.filter((s) => s.domain === domain);
              return (
                <div key={domain} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                      {label}
                    </h4>
                    <span className="text-[10px] font-mono text-slate-500">
                      {domainStatuses.length} trạng thái
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                    {domainStatuses.map((st) => (
                      <div
                        key={st.code}
                        className="p-2.5 rounded-lg border border-slate-800 bg-slate-950/70 space-y-1 font-mono text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-200">{st.code}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                              st.isTerminal
                                ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                : 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/60'
                            }`}
                          >
                            {st.isTerminal ? 'Kết thúc' : 'Đang xử lý'}
                          </span>
                        </div>
                        <p className="font-sans text-[11px] text-slate-400 leading-relaxed">
                          {st.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 6: RECOMMENDATION RULES (Weights, toggles, zero magic numbers)     */}
      {/* ========================================================================= */}
      {activeTab === 'rules' && recConfig && (
        <div className="space-y-6 max-w-4xl">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">
                Cấu hình quy tắc công cụ đề xuất
              </h3>
              <p className="text-xs text-slate-400">
                Điều chỉnh trọng số quy tắc, ngưỡng điểm và bật/tắt từng quy tắc gợi ý mà không cần sửa code
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isRecsSaved && (
                <span className="text-xs text-emerald-400 font-mono animate-fade-in">
                  ✓ Đã cập nhật quy tắc
                </span>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveRecommendationSettings}
                disabled={updateRecommendations.isPending}
                className="bg-purple-600 hover:bg-purple-500 text-white text-xs h-8"
              >
                {updateRecommendations.isPending ? 'Đang lưu...' : 'Lưu trọng số quy tắc'}
              </Button>
            </div>
          </div>

          {/* Global Thresholds */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              Ngưỡng lọc & Phân tầng ưu tiên
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Ngưỡng điểm tối thiểu</label>
                <input
                  type="number"
                  min={30}
                  max={90}
                  value={recConfig.minScoreThreshold}
                  onChange={(e) =>
                    setRecConfig({
                      ...recConfig,
                      minScoreThreshold: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
                />
                <p className="text-[10px] text-slate-500">
                  Đề xuất có điểm thấp hơn mức này sẽ bị loại bỏ
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Ngưỡng tiềm năng cao</label>
                <input
                  type="number"
                  min={50}
                  max={95}
                  value={recConfig.highPotentialThreshold}
                  onChange={(e) =>
                    setRecConfig({
                      ...recConfig,
                      highPotentialThreshold: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
                />
                <p className="text-[10px] text-slate-500">
                  Điểm đạt từ mức này trở lên sẽ xếp vào Tầng 2 Cần chú ý
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Trần điểm tối đa</label>
                <input
                  type="number"
                  min={80}
                  max={100}
                  value={recConfig.maxNormalizedScore}
                  onChange={(e) =>
                    setRecConfig({
                      ...recConfig,
                      maxNormalizedScore: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100"
                />
                <p className="text-[10px] text-slate-500">
                  Giới hạn điểm chuẩn hóa tối đa (VD: 95%)
                </p>
              </div>
            </div>
          </div>

          {/* Individual Rules */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              Trọng số & Kích hoạt từng quy tắc
            </h4>

            {/* Rule A */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-lg">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-400">QUY TẮC A</span>
                  <span className="text-xs font-semibold text-slate-100">
                    {recConfig.rules.ruleA.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {recConfig.rules.ruleA.description}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-slate-400">Điểm cơ bản</span>
                  <input
                    type="number"
                    min={40}
                    max={95}
                    value={recConfig.rules.ruleA.baseScore}
                    onChange={(e) =>
                      setRecConfig({
                        ...recConfig,
                        rules: {
                          ...recConfig.rules,
                          ruleA: { ...recConfig.rules.ruleA, baseScore: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-center text-slate-100"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer pt-3">
                  <input
                    type="checkbox"
                    checked={recConfig.rules.ruleA.enabled}
                    onChange={(e) =>
                      setRecConfig({
                        ...recConfig,
                        rules: {
                          ...recConfig.rules,
                          ruleA: { ...recConfig.rules.ruleA, enabled: e.target.checked },
                        },
                      })
                    }
                    className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Kích hoạt</span>
                </label>
              </div>
            </div>

            {/* Rule B */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-lg">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-400">QUY TẮC B</span>
                  <span className="text-xs font-semibold text-slate-100">
                    {recConfig.rules.ruleB.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {recConfig.rules.ruleB.description}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-slate-400">Điểm cơ bản</span>
                  <input
                    type="number"
                    min={40}
                    max={95}
                    value={recConfig.rules.ruleB.baseScore}
                    onChange={(e) =>
                      setRecConfig({
                        ...recConfig,
                        rules: {
                          ...recConfig.rules,
                          ruleB: { ...recConfig.rules.ruleB, baseScore: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-center text-slate-100"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer pt-3">
                  <input
                    type="checkbox"
                    checked={recConfig.rules.ruleB.enabled}
                    onChange={(e) =>
                      setRecConfig({
                        ...recConfig,
                        rules: {
                          ...recConfig.rules,
                          ruleB: { ...recConfig.rules.ruleB, enabled: e.target.checked },
                        },
                      })
                    }
                    className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Kích hoạt</span>
                </label>
              </div>
            </div>

            {/* Rule C */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-lg">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-blue-400">QUY TẮC C</span>
                  <span className="text-xs font-semibold text-slate-100">
                    {recConfig.rules.ruleC.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {recConfig.rules.ruleC.description}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-slate-400">Điểm cơ bản</span>
                  <input
                    type="number"
                    min={40}
                    max={95}
                    value={recConfig.rules.ruleC.baseScore}
                    onChange={(e) =>
                      setRecConfig({
                        ...recConfig,
                        rules: {
                          ...recConfig.rules,
                          ruleC: { ...recConfig.rules.ruleC, baseScore: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-center text-slate-100"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer pt-3">
                  <input
                    type="checkbox"
                    checked={recConfig.rules.ruleC.enabled}
                    onChange={(e) =>
                      setRecConfig({
                        ...recConfig,
                        rules: {
                          ...recConfig.rules,
                          ruleC: { ...recConfig.rules.ruleC, enabled: e.target.checked },
                        },
                      })
                    }
                    className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Kích hoạt</span>
                </label>
              </div>
            </div>

            {/* Rule D */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 max-w-lg">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-rose-400">QUY TẮC D</span>
                  <span className="text-xs font-semibold text-slate-100">
                    {recConfig.rules.ruleD.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {recConfig.rules.ruleD.description}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-slate-400">Điểm cơ bản</span>
                  <input
                    type="number"
                    min={40}
                    max={95}
                    value={recConfig.rules.ruleD.baseScore}
                    onChange={(e) =>
                      setRecConfig({
                        ...recConfig,
                        rules: {
                          ...recConfig.rules,
                          ruleD: { ...recConfig.rules.ruleD, baseScore: Number(e.target.value) },
                        },
                      })
                    }
                    className="w-20 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs font-mono text-center text-slate-100"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer pt-3">
                  <input
                    type="checkbox"
                    checked={recConfig.rules.ruleD.enabled}
                    onChange={(e) =>
                      setRecConfig({
                        ...recConfig,
                        rules: {
                          ...recConfig.rules,
                          ruleD: { ...recConfig.rules.ruleD, enabled: e.target.checked },
                        },
                      })
                    }
                    className="rounded border-slate-700 bg-slate-950 text-rose-600 focus:ring-rose-500"
                  />
                  <span>Kích hoạt</span>
                </label>
              </div>
            </div>

            {/* Rule E: Recency Boost */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-amber-400">HỆ SỐ ĐIỀU CHỈNH QUY TẮC E</span>
                    <span className="text-xs font-semibold text-slate-100">
                      Hệ số thời gian tương tác gần
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Tăng điểm động khi khách hàng có tương tác thực tế gần đây
                  </p>
                </div>
                <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recConfig.rules.ruleE.enabled}
                    onChange={(e) =>
                      setRecConfig({
                        ...recConfig,
                        rules: {
                          ...recConfig.rules,
                          ruleE: { ...recConfig.rules.ruleE, enabled: e.target.checked },
                        },
                      })
                    }
                    className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500"
                  />
                  <span>Kích hoạt</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-mono">
                    Tầng 1: Hoạt động trong vòng {recConfig.rules.ruleE.recencyDays1} ngày
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-mono text-slate-500">Cộng điểm:</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={recConfig.rules.ruleE.boost1}
                      onChange={(e) =>
                        setRecConfig({
                          ...recConfig,
                          rules: {
                            ...recConfig.rules,
                            ruleE: { ...recConfig.rules.ruleE, boost1: Number(e.target.value) },
                          },
                        })
                      }
                      className="w-14 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono text-emerald-400"
                    />
                    <span className="text-[11px] font-mono text-slate-400">điểm</span>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-mono">
                    Tầng 2: Hoạt động trong vòng {recConfig.rules.ruleE.recencyDays2} ngày
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-mono text-slate-500">Cộng điểm:</span>
                    <input
                      type="number"
                      min={0}
                      max={20}
                      value={recConfig.rules.ruleE.boost2}
                      onChange={(e) =>
                        setRecConfig({
                          ...recConfig,
                          rules: {
                            ...recConfig.rules,
                            ruleE: { ...recConfig.rules.ruleE, boost2: Number(e.target.value) },
                          },
                        })
                      }
                      className="w-14 px-1.5 py-0.5 bg-slate-900 border border-slate-700 rounded text-center text-xs font-mono text-emerald-400"
                    />
                    <span className="text-[11px] font-mono text-slate-400">điểm</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Rule F: No Signal Guard */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 flex items-center justify-between">
              <div className="space-y-1 max-w-lg">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-400">BẢO VỆ QUY TẮC F</span>
                  <span className="text-xs font-semibold text-slate-100">
                    {recConfig.rules.ruleF.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {recConfig.rules.ruleF.description}
                </p>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recConfig.rules.ruleF.enabled}
                  onChange={(e) =>
                    setRecConfig({
                      ...recConfig,
                      rules: {
                        ...recConfig.rules,
                        ruleF: { ...recConfig.rules.ruleF, enabled: e.target.checked },
                      },
                    })
                  }
                  className="rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
                />
                <span>Kích hoạt bảo vệ</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 7: DATA MANAGEMENT & GOVERNANCE                                   */}
      {/* ========================================================================= */}
      {activeTab === 'data' && (
        <div className="space-y-6 max-w-4xl">
          {/* Action Row: Export Data & Demo Indicator */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Export Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-slate-100">
                  <Download className="w-5 h-5 text-blue-400" />
                  <h3 className="font-semibold text-sm font-mono">Xuất dữ liệu hệ thống</h3>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Tải về bản sao lưu dạng tệp JSON đầy đủ cấu trúc gồm khách hàng, hồ sơ, thẻ và cấu hình để di chuyển hoặc lưu trữ ngoại tuyến.
                </p>
              </div>

              <div className="pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="bg-blue-600 hover:bg-blue-500 text-white gap-2 text-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isExporting ? 'Đang tạo tệp JSON...' : 'Xuất toàn bộ cơ sở dữ liệu (.json)'}</span>
                </Button>
              </div>
            </div>

            {/* Seed / Demo Mode Indicator */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-3 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-slate-100">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  <h3 className="font-semibold text-sm font-mono">Chế độ cơ sở dữ liệu</h3>
                </div>
                {isDataGovLoading ? (
                  <p className="text-xs text-slate-500">Đang kiểm tra chế độ dữ liệu...</p>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                          dataGov?.demoMode.isDemoMode
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                            : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/60'
                        }`}
                      >
                        {dataGov?.demoMode.isDemoMode ? 'DỮ LIỆU MẪU ĐANG HOẠT ĐỘNG' : 'DỮ LIỆU VẬN HÀNH THỰC TẾ'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {dataGov?.demoMode.guidanceNote}
                    </p>
                  </div>
                )}
              </div>

              <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800">
                Tổng số khách hàng đã đăng ký: <strong>{dataGov?.demoMode.totalCustomers ?? '...'}</strong>
              </div>
            </div>
          </div>

          {/* Database Health & Latency Telemetry */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                  Giám sát trực tiếp cơ sở dữ liệu
                </h4>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchDataGov()}
                className="text-xs text-slate-400 hover:text-slate-200 h-6 px-1.5"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Làm mới
              </Button>
            </div>

            {isDataGovLoading ? (
              <div className="text-xs text-slate-500 font-mono py-4 text-center">
                Đang đo độ trễ và số lượng bản ghi các bảng...
              </div>
            ) : dataGov?.database ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-500">Trạng thái kết nối</span>
                    <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>{dataGov.database.status}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-500">Hệ quản trị CSDL</span>
                    <div className="font-semibold text-slate-200">
                      {dataGov.database.dialect}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-500">Độ trễ phản hồi</span>
                    <div className="font-bold text-blue-400">
                      {dataGov.database.pingLatencyMs} ms
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                    <span className="text-[10px] text-slate-500">Nhật ký hoạt động</span>
                    <div className="font-bold text-purple-400">
                      {dataGov.database.tables.activities} sự kiện
                    </div>
                  </div>
                </div>

                {/* Table Footprint */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-mono text-slate-400">
                    Phân bổ bản ghi theo bảng quan hệ:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 flex justify-between">
                      <span className="text-slate-400">Khách hàng:</span>
                      <strong className="text-slate-100">{dataGov.database.tables.customers}</strong>
                    </div>
                    <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 flex justify-between">
                      <span className="text-slate-400">Hồ sơ:</span>
                      <strong className="text-slate-100">{dataGov.database.tables.cases}</strong>
                    </div>
                    <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 flex justify-between">
                      <span className="text-slate-400">Nhu cầu:</span>
                      <strong className="text-slate-100">{dataGov.database.tables.needs}</strong>
                    </div>
                    <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 flex justify-between">
                      <span className="text-slate-400">Lịch hẹn:</span>
                      <strong className="text-slate-100">{dataGov.database.tables.followUps}</strong>
                    </div>
                    <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 flex justify-between">
                      <span className="text-slate-400">Chuyển khách:</span>
                      <strong className="text-slate-100">{dataGov.database.tables.pushRecords}</strong>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Backup Guidance & Operational Procedures */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
                Hướng dẫn sao lưu & Phục hồi vận hành
              </h4>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-300">
                  1. Lệnh sao lưu logic tiêu chuẩn:
                </span>
                <p className="text-[11px] text-slate-400">
                  {dataGov?.backupGuidance.logicalBackup.description}
                </p>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono flex items-center justify-between text-slate-200">
                  <code className="text-amber-300 overflow-x-auto text-[11px]">
                    {dataGov?.backupGuidance.logicalBackup.command || 'mysqldump -u root -p crm_db > crm_backup.sql'}
                  </code>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        dataGov?.backupGuidance.logicalBackup.command || 'mysqldump -u root -p crm_db > crm_backup.sql'
                      )
                    }
                    className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors ml-2"
                    title="Sao chép lệnh"
                  >
                    {copiedCommand ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="font-semibold text-slate-300">
                  2. Lịch trình sao lưu khuyến nghị:
                </span>
                <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                  {dataGov?.backupGuidance.recommendedCadence.map((cad, idx) => (
                    <li key={idx}>{cad}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-slate-400 text-[11px] leading-relaxed">
                <strong>Chính sách quản trị dữ liệu:</strong> Không lưu trữ mật khẩu, khóa bảo mật hay mã truy cập API dạng văn bản thô trong cơ sở dữ liệu. Các nút thao tác xóa hủy hàng loạt cấp hệ thống được loại trừ khỏi giao diện người dùng nhằm đảm bảo tính toàn vẹn dữ liệu.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS                                                                    */}
      {/* ========================================================================= */}
      {isProductModalOpen && (
        <ProductModal
          isOpen={isProductModalOpen}
          onClose={() => setIsProductModalOpen(false)}
          product={editingProduct}
        />
      )}

      {isTagModalOpen && (
        <TagModal
          isOpen={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
          tag={editingTag}
        />
      )}

      {isCategoryModalOpen && (
        <NeedCategoryModal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          category={editingCategory}
          onSave={handleSaveNeedCategory}
        />
      )}

      {isSourceModalOpen && (
        <CustomerSourceModal
          isOpen={isSourceModalOpen}
          onClose={() => setIsSourceModalOpen(false)}
        />
      )}

      {deletingTag && (
        <ConfirmDialog
          isOpen={Boolean(deletingTag)}
          title="Xóa thẻ khách hàng"
          message={`Bạn có chắc chắn muốn xóa thẻ "${deletingTag.name}"? Hành động này sẽ gỡ thẻ khỏi tất cả khách hàng đang được gắn thẻ này.`}
          confirmLabel="Xóa thẻ"
          isDestructive={true}
          onConfirm={handleDeleteTagConfirm}
          onCancel={() => setDeletingTag(null)}
        />
      )}
    </div>
  );
};

export default SettingsPage;
