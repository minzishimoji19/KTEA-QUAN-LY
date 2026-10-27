import React, { useState, useEffect } from 'react';
import {
  X,
  Package,
  AlertCircle,
  Building2,
  DollarSign,
  Percent,
  Calendar,
  ShieldCheck,
  Link as LinkIcon,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useCreateProduct, useUpdateProduct } from '../../hooks/useProducts';
import {
  Product,
  ProductCategory,
  InterestRateUnit,
  ProductFinancialDetail,
} from '../../types/models';

export interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
}

const CATEGORY_OPTIONS: { value: ProductCategory; label: string; description: string }[] = [
  { value: 'LOAN_UNSECURED', label: 'Vay tín chấp', description: 'Vay tiêu dùng, thấu chi không tài sản đảm bảo' },
  { value: 'LOAN_SECURED', label: 'Vay thế chấp', description: 'Vay mua nhà, mua xe có thế chấp tài sản' },
  { value: 'CREDIT_CARD', label: 'Thẻ tín dụng', description: 'Hạn mức tín dụng, hoàn tiền, tích dặm bay' },
  { value: 'INSURANCE', label: 'Bảo hiểm', description: 'Bảo hiểm nhân thọ, sức khỏe, khoản vay' },
  { value: 'SAVINGS', label: 'Tiết kiệm / Tiền gửi', description: 'Tiền gửi có kỳ hạn, sinh lời định kỳ' },
  { value: 'OTHER', label: 'Sản phẩm khác', description: 'POS, QR thanh toán, dịch vụ tài chính khác' },
];

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const isEditing = Boolean(product);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  // Active form section
  const [activeTab, setActiveTab] = useState<'general' | 'financial' | 'criteria'>('general');

  // Basic Info
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);

  // Financial Detail
  const [category, setCategory] = useState<ProductCategory>('OTHER');
  const [providerName, setProviderName] = useState('');
  const [minAmount, setMinAmount] = useState<string>('');
  const [maxAmount, setMaxAmount] = useState<string>('');
  const [minInterestRate, setMinInterestRate] = useState<string>('');
  const [maxInterestRate, setMaxInterestRate] = useState<string>('');
  const [interestRateUnit, setInterestRateUnit] = useState<InterestRateUnit>('PERCENT_PER_YEAR');
  const [minTenureMonths, setMinTenureMonths] = useState<string>('');
  const [maxTenureMonths, setMaxTenureMonths] = useState<string>('');
  const [feesDescription, setFeesDescription] = useState('');

  // Eligibility & Advisory
  const [minAge, setMinAge] = useState<string>('');
  const [maxAge, setMaxAge] = useState<string>('');
  const [minIncome, setMinIncome] = useState<string>('');
  const [acceptBadDebt, setAcceptBadDebt] = useState(false);
  const [benefitsText, setBenefitsText] = useState('');
  const [risksText, setRisksText] = useState('');
  const [officialUrl, setOfficialUrl] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');

  const [error, setError] = useState('');

  useEffect(() => {
    if (product) {
      setCode(product.code);
      setName(product.name);
      setDescription(product.description || '');
      setActive(product.active);

      const d = product.financialDetail;
      if (d) {
        setCategory(d.category || 'OTHER');
        setProviderName(d.providerName || '');
        setMinAmount(d.minAmount !== null && d.minAmount !== undefined ? String(d.minAmount) : '');
        setMaxAmount(d.maxAmount !== null && d.maxAmount !== undefined ? String(d.maxAmount) : '');
        setMinInterestRate(d.minInterestRate !== null && d.minInterestRate !== undefined ? String(d.minInterestRate) : '');
        setMaxInterestRate(d.maxInterestRate !== null && d.maxInterestRate !== undefined ? String(d.maxInterestRate) : '');
        setInterestRateUnit(d.interestRateUnit || 'PERCENT_PER_YEAR');
        setMinTenureMonths(d.minTenureMonths !== null && d.minTenureMonths !== undefined ? String(d.minTenureMonths) : '');
        setMaxTenureMonths(d.maxTenureMonths !== null && d.maxTenureMonths !== undefined ? String(d.maxTenureMonths) : '');
        setFeesDescription(d.feesDescription || '');
        setMinAge(d.minAge !== null && d.minAge !== undefined ? String(d.minAge) : '');
        setMaxAge(d.maxAge !== null && d.maxAge !== undefined ? String(d.maxAge) : '');
        setMinIncome(d.minIncome !== null && d.minIncome !== undefined ? String(d.minIncome) : '');
        setAcceptBadDebt(Boolean(d.acceptBadDebt));
        setBenefitsText(Array.isArray(d.benefits) ? d.benefits.join('\n') : '');
        setRisksText(Array.isArray(d.risks) ? d.risks.join('\n') : '');
        setOfficialUrl(d.officialUrl || '');
        setEffectiveFrom(d.effectiveFrom ? d.effectiveFrom.slice(0, 10) : '');
        setEffectiveTo(d.effectiveTo ? d.effectiveTo.slice(0, 10) : '');
      } else {
        // Reset financial details
        setCategory('OTHER');
        setProviderName('');
        setMinAmount('');
        setMaxAmount('');
        setMinInterestRate('');
        setMaxInterestRate('');
        setInterestRateUnit('PERCENT_PER_YEAR');
        setMinTenureMonths('');
        setMaxTenureMonths('');
        setFeesDescription('');
        setMinAge('');
        setMaxAge('');
        setMinIncome('');
        setAcceptBadDebt(false);
        setBenefitsText('');
        setRisksText('');
        setOfficialUrl('');
        setEffectiveFrom('');
        setEffectiveTo('');
      }
    } else {
      setCode('');
      setName('');
      setDescription('');
      setActive(true);
      setCategory('OTHER');
      setProviderName('');
      setMinAmount('');
      setMaxAmount('');
      setMinInterestRate('');
      setMaxInterestRate('');
      setInterestRateUnit('PERCENT_PER_YEAR');
      setMinTenureMonths('');
      setMaxTenureMonths('');
      setFeesDescription('');
      setMinAge('');
      setMaxAge('');
      setMinIncome('');
      setAcceptBadDebt(false);
      setBenefitsText('');
      setRisksText('');
      setOfficialUrl('');
      setEffectiveFrom('');
      setEffectiveTo('');
    }
    setActiveTab('general');
    setError('');
  }, [product, isOpen]);

  if (!isOpen) return null;

  // Helper formatting for VND
  const formatVNDDisplay = (valStr: string) => {
    const num = Number(valStr);
    if (!valStr || isNaN(num) || num <= 0) return null;
    if (num >= 1_000_000_000) {
      return `${(num / 1_000_000_000).toLocaleString('vi-VN')} tỷ VNĐ`;
    }
    if (num >= 1_000_000) {
      return `${(num / 1_000_000).toLocaleString('vi-VN')} triệu VNĐ`;
    }
    return `${num.toLocaleString('vi-VN')} VNĐ`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Basic Validation
    if (!code.trim()) {
      setError('Vui lòng nhập mã sản phẩm');
      setActiveTab('general');
      return;
    }
    if (!name.trim()) {
      setError('Vui lòng nhập tên sản phẩm');
      setActiveTab('general');
      return;
    }

    // Min/Max validations
    const numMinAmount = minAmount ? Number(minAmount) : null;
    const numMaxAmount = maxAmount ? Number(maxAmount) : null;
    if (numMinAmount !== null && numMaxAmount !== null && numMaxAmount < numMinAmount) {
      setError('Hạn mức tối đa phải lớn hơn hoặc bằng hạn mức tối thiểu');
      setActiveTab('financial');
      return;
    }

    const numMinRate = minInterestRate ? Number(minInterestRate) : null;
    const numMaxRate = maxInterestRate ? Number(maxInterestRate) : null;
    if (numMinRate !== null && numMaxRate !== null && numMaxRate < numMinRate) {
      setError('Lãi suất tối đa phải lớn hơn hoặc bằng lãi suất tối thiểu');
      setActiveTab('financial');
      return;
    }

    const numMinTenure = minTenureMonths ? Number(minTenureMonths) : null;
    const numMaxTenure = maxTenureMonths ? Number(maxTenureMonths) : null;
    if (numMinTenure !== null && numMaxTenure !== null && numMaxTenure < numMinTenure) {
      setError('Kỳ hạn tối đa phải lớn hơn hoặc bằng kỳ hạn tối thiểu');
      setActiveTab('financial');
      return;
    }

    const numMinAge = minAge ? Number(minAge) : null;
    const numMaxAge = maxAge ? Number(maxAge) : null;
    if (numMinAge !== null && numMaxAge !== null && numMaxAge < numMinAge) {
      setError('Độ tuổi tối đa phải lớn hơn hoặc bằng độ tuổi tối thiểu');
      setActiveTab('criteria');
      return;
    }

    if (effectiveFrom && effectiveTo && new Date(effectiveTo) < new Date(effectiveFrom)) {
      setError('Ngày kết thúc hiệu lực phải sau ngày bắt đầu hiệu lực');
      setActiveTab('criteria');
      return;
    }

    // Parse array items from multi-line text
    const benefitsList = benefitsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    const risksList = risksText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    // Build payload
    const financialDetailPayload: Partial<ProductFinancialDetail> = {
      category,
      providerName: providerName.trim() || null,
      minAmount: numMinAmount,
      maxAmount: numMaxAmount,
      minInterestRate: numMinRate,
      maxInterestRate: numMaxRate,
      interestRateUnit,
      minTenureMonths: numMinTenure,
      maxTenureMonths: numMaxTenure,
      feesDescription: feesDescription.trim() || null,
      minAge: numMinAge,
      maxAge: numMaxAge,
      minIncome: minIncome ? Number(minIncome) : null,
      acceptBadDebt,
      benefits: benefitsList.length > 0 ? benefitsList : null,
      risks: risksList.length > 0 ? risksList : null,
      officialUrl: officialUrl.trim() || null,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom).toISOString() : null,
      effectiveTo: effectiveTo ? new Date(effectiveTo).toISOString() : null,
    };

    try {
      if (isEditing && product) {
        await updateProduct.mutateAsync({
          id: product.id,
          data: {
            code: code.trim().toUpperCase(),
            name: name.trim(),
            description: description.trim() || null,
            active,
            financialDetail: financialDetailPayload,
          },
        });
      } else {
        await createProduct.mutateAsync({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim() || null,
          active,
          financialDetail: financialDetailPayload,
        });
      }
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Không thể lưu sản phẩm');
    }
  };

  const isSubmitting = createProduct.isPending || updateProduct.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-3xl my-8 rounded-xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-6 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5 text-slate-100">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm font-mono">
                {isEditing ? 'Cấu hình chi tiết sản phẩm tài chính' : 'Thêm sản phẩm tài chính mới'}
              </h3>
              <p className="text-[11px] text-slate-400">
                Chuẩn hóa thông số kỹ thuật phục vụ khảo sát nhu cầu và bộ lọc gợi ý
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-950/40 border border-red-900/60 rounded-lg flex items-center gap-2.5 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/40 gap-4 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`py-3 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>1. Thông tin chung & Đối tác</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('financial')}
            className={`py-3 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'financial'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>2. Thông số tài chính</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('criteria')}
            className={`py-3 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'criteria'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>3. Điều kiện & Tư vấn</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* TAB 1: GENERAL INFO */}
          {activeTab === 'general' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                    <span>Mã sản phẩm *</span>
                    <span className="text-[10px] text-slate-500 font-mono">(DUY NHẤT)</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="VD: VPB_VAY_TIN_CHAP_SALARY"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 uppercase"
                  />
                  <p className="text-[10px] text-slate-500">Mã cố định dùng để ánh xạ trong thuật toán</p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Tên sản phẩm *</label>
                  <input
                    type="text"
                    required
                    placeholder="VD: Vay tín chấp theo lương VPBank"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Phân loại sản phẩm</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ProductCategory)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500">
                    {CATEGORY_OPTIONS.find((c) => c.value === category)?.description}
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Nhà cung cấp / Ngân hàng phát hành</label>
                  <input
                    type="text"
                    placeholder="VD: VPBank, Techcombank, MB, Shinhan..."
                    value={providerName}
                    onChange={(e) => setProviderName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Mô tả sản phẩm</label>
                <textarea
                  rows={3}
                  placeholder="Mô tả tóm tắt tính năng chính của gói sản phẩm..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/60 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-slate-200">Kích hoạt sản phẩm</h4>
                  <p className="text-[11px] text-slate-400">
                    Khi tắt, sản phẩm sẽ không hiển thị trong đề xuất hoặc tạo hồ sơ mới
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(e) => setActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          )}

          {/* TAB 2: FINANCIAL SPECIFICATIONS */}
          {activeTab === 'financial' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-3 bg-blue-950/30 border border-blue-900/50 rounded-lg text-xs text-blue-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span>
                  Các trường tài chính là tùy chọn theo đặc thù từng sản phẩm (Khoản vay cần hạn mức & kỳ hạn; Thẻ tín dụng cần hạn mức; Bảo hiểm/Tiết kiệm cần kỳ hạn & phí).
                </span>
              </div>

              {/* Hạn mức */}
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
                <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 font-mono">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  <span>HẠN MỨC (VNĐ)</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Hạn mức tối thiểu</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="VD: 10000000"
                      value={minAmount}
                      onChange={(e) => setMinAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                    />
                    {formatVNDDisplay(minAmount) && (
                      <span className="text-[10px] text-emerald-400 font-mono">
                        ≈ {formatVNDDisplay(minAmount)}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Hạn mức tối đa</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="VD: 300000000"
                      value={maxAmount}
                      onChange={(e) => setMaxAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                    />
                    {formatVNDDisplay(maxAmount) && (
                      <span className="text-[10px] text-emerald-400 font-mono">
                        ≈ {formatVNDDisplay(maxAmount)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Lãi suất */}
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 font-mono">
                    <Percent className="w-3.5 h-3.5 text-amber-400" />
                    <span>LÃI SUẤT & ĐƠN VỊ TÍNH</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-slate-400">Đơn vị:</label>
                    <select
                      value={interestRateUnit}
                      onChange={(e) => setInterestRateUnit(e.target.value as InterestRateUnit)}
                      className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 focus:outline-none"
                    >
                      <option value="PERCENT_PER_YEAR">%/năm</option>
                      <option value="PERCENT_PER_MONTH">%/tháng</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Lãi suất tối thiểu (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      placeholder="VD: 12.5"
                      value={minInterestRate}
                      onChange={(e) => setMinInterestRate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-300">Lãi suất tối đa (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      max={100}
                      placeholder="VD: 24.0"
                      value={maxInterestRate}
                      onChange={(e) => setMaxInterestRate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Kỳ hạn & Phí */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
                  <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-blue-400" />
                    <span>KỲ HẠN (THÁNG)</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-400">Min (tháng)</label>
                      <input
                        type="number"
                        min={1}
                        placeholder="6"
                        value={minTenureMonths}
                        onChange={(e) => setMinTenureMonths(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-400">Max (tháng)</label>
                      <input
                        type="number"
                        min={1}
                        placeholder="48"
                        value={maxTenureMonths}
                        onChange={(e) => setMaxTenureMonths(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-200 font-mono">PHÍ & BIỂU PHÍ</h4>
                  <textarea
                    rows={2}
                    placeholder="Phí thường niên, phí thẩm định, phí tất toán trước hạn..."
                    value={feesDescription}
                    onChange={(e) => setFeesDescription(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ELIGIBILITY & ADVISORY */}
          {activeTab === 'criteria' && (
            <div className="space-y-4 animate-fade-in">
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
                <h4 className="text-xs font-semibold text-slate-200 flex items-center gap-1.5 font-mono">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                  <span>ĐIỀU KIỆN ÁP DỤNG CƠ BẢN</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400">Độ tuổi tối thiểu (tuổi)</label>
                    <input
                      type="number"
                      min={18}
                      max={100}
                      placeholder="18"
                      value={minAge}
                      onChange={(e) => setMinAge(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400">Độ tuổi tối đa (tuổi)</label>
                    <input
                      type="number"
                      min={18}
                      max={100}
                      placeholder="60"
                      value={maxAge}
                      onChange={(e) => setMaxAge(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400">Thu nhập tối thiểu (VNĐ)</label>
                    <input
                      type="number"
                      min={0}
                      placeholder="5000000"
                      value={minIncome}
                      onChange={(e) => setMinIncome(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs font-mono text-slate-100"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptBadDebt}
                      onChange={(e) => setAcceptBadDebt(e.target.checked)}
                      className="rounded border-slate-700 bg-slate-900 text-blue-600"
                    />
                    <span>Chấp nhận khách hàng có lịch sử nợ xấu (CIC nhóm 2 trở lên)</span>
                  </label>
                </div>
              </div>

              {/* Benefits & Risks (Multi-line) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                    <span>Quyền lợi nổi bật</span>
                    <span className="text-[10px] text-slate-500 font-mono">(1 dòng = 1 mục)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Miễn phí thường niên năm đầu&#10;Giải ngân nhanh 24h&#10;Tặng bảo hiểm khoản vay"
                    value={benefitsText}
                    onChange={(e) => setBenefitsText(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                    <span>Rủi ro & Lưu ý tư vấn</span>
                    <span className="text-[10px] text-slate-500 font-mono">(1 dòng = 1 mục)</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Phí tất toán trước hạn 3%&#10;Cần xác nhận công tác từ cơ quan"
                    value={risksText}
                    onChange={(e) => setRisksText(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Official URL & Validity dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1 space-y-1">
                  <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                    <LinkIcon className="w-3 h-3 text-slate-400" />
                    <span>Nguồn chính thức (URL)</span>
                  </label>
                  <input
                    type="url"
                    placeholder="https://nganhang.vn/san-pham"
                    value={officialUrl}
                    onChange={(e) => setOfficialUrl(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Hiệu lực từ ngày</label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Đến ngày</label>
                  <input
                    type="date"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <div className="flex items-center gap-2">
              {activeTab === 'general' ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('financial')}
                  className="text-xs h-8 text-blue-400 border-blue-900/60 hover:bg-blue-950/40"
                >
                  Tiếp theo: Thông số tài chính →
                </Button>
              ) : activeTab === 'financial' ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTab('criteria')}
                  className="text-xs h-8 text-blue-400 border-blue-900/60 hover:bg-blue-950/40"
                >
                  Tiếp theo: Điều kiện & Tư vấn →
                </Button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" type="button" onClick={onClose} className="h-8 text-xs">
                Hủy
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-500 text-white h-8 text-xs min-w-[100px]"
              >
                {isSubmitting ? 'Đang lưu...' : isEditing ? 'Lưu thay đổi' : 'Tạo sản phẩm'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;
