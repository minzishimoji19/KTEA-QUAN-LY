import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, UserPlus, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useCreateCustomer } from '../../hooks/useCustomers';
import { useCustomerSources } from '../../hooks/useCustomerSources';
import { CustomerDetail } from '../../types/models';
import { useToast } from '../../context/ToastContext';

const createCustomerSchema = z.object({
  fullName: z.string().min(1, 'Vui lòng nhập họ và tên').max(255),
  phone: z.string().min(8, 'Số điện thoại phải có ít nhất 8 chữ số').max(20),
  email: z.string().email('Địa chỉ email không hợp lệ').optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  sourceId: z.string().optional().or(z.literal('')),
  source: z.string().max(100).optional().or(z.literal('')),
  overallStatus: z.enum(['LEAD_MOI', 'DANG_TIEP_CAN', 'DANG_TU_VAN', 'THANH_CONG', 'KHONG_KHA_THI']).default('LEAD_MOI'),
  priority: z.enum(['CHUA_CO_NHU_CAU', 'THANH_KHOAN', 'TIN_DUNG', 'THANH_KHOAN_TIN_DUNG']).default('CHUA_CO_NHU_CAU'),
});

type CreateCustomerFormData = z.infer<typeof createCustomerSchema>;

export interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (customerId: string) => void;
}

export const CreateCustomerModal: React.FC<CreateCustomerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const createCustomer = useCreateCustomer();
  const { data: sources, isLoading: isSourcesLoading } = useCustomerSources(true);
  const { toast } = useToast();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateCustomerFormData>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      gender: '',
      dateOfBirth: '',
      address: '',
      sourceId: '',
      source: '',
      overallStatus: 'LEAD_MOI',
      priority: 'CHUA_CO_NHU_CAU',
    },
  });

  if (!isOpen) return null;

  const onSubmit = async (data: CreateCustomerFormData) => {
    try {
      const payload: Partial<CustomerDetail> = {
        fullName: data.fullName.trim(),
        phone: data.phone.trim(),
        overallStatus: data.overallStatus,
      };

      if (data.email?.trim()) payload.email = data.email.trim();
      if (data.gender) payload.gender = data.gender;
      if (data.dateOfBirth) payload.dateOfBirth = new Date(data.dateOfBirth).toISOString();
      if (data.address?.trim()) payload.address = data.address.trim();
      if (data.sourceId) {
        payload.sourceId = data.sourceId;
        const matched = sources?.find((s) => s.id === data.sourceId);
        if (matched) payload.source = matched.name;
      } else if (data.source?.trim()) {
        payload.source = data.source.trim();
      }
      if (data.priority) payload.priority = data.priority;

      const created = await createCustomer.mutateAsync(payload);
      toast.success('Đã thêm khách hàng', `Đã tạo thành công khách hàng "${data.fullName.trim()}".`);
      reset();
      onClose();
      if (onSuccess && created?.id) {
        onSuccess(created.id);
      }
    } catch (err: unknown) {
      console.error('Failed to create customer:', err);
      const message = err instanceof Error ? err.message : 'Vui lòng kiểm tra lại các trường dữ liệu.';
      toast.error('Đăng ký thất bại', message);
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-100"
    >
      <div
        className="w-full max-w-lg rounded-lg border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">Thêm nhanh khách hàng</h3>
              <p className="text-[10px] text-slate-400">Ghi nhận hồ sơ khách hàng mới trực tiếp vào danh bạ vận hành</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto text-xs">
            {createCustomer.isError && (
              <div className="p-2.5 rounded bg-red-950/50 border border-red-800/60 text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>
                  {(createCustomer.error as Error)?.message || 'Không thể tạo khách hàng. Vui lòng kiểm tra lại thông tin.'}
                </span>
              </div>
            )}

            {/* Required Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Họ và tên <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: Nguyễn Văn A"
                  {...register('fullName')}
                  className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-sans"
                />
                {errors.fullName && (
                  <p className="text-[10px] text-red-400 mt-1">{errors.fullName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Số điện thoại <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: 0901234567"
                  {...register('phone')}
                  className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-mono"
                />
                {errors.phone && (
                  <p className="text-[10px] text-red-400 mt-1">{errors.phone.message}</p>
                )}
              </div>
            </div>

            {/* Email & Gender */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Địa chỉ email
                </label>
                <input
                  type="email"
                  placeholder="VD: client@example.com"
                  {...register('email')}
                  className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-sans"
                />
                {errors.email && (
                  <p className="text-[10px] text-red-400 mt-1">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Giới tính
                </label>
                <select
                  {...register('gender')}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-sans"
                >
                  <option value="">Chưa xác định</option>
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </select>
              </div>
            </div>

            {/* Date of Birth & Source */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Ngày sinh
                </label>
                <input
                  type="date"
                  {...register('dateOfBirth')}
                  className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Nguồn khách hàng
                </label>
                <select
                  {...register('sourceId')}
                  disabled={isSourcesLoading}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-sans text-xs"
                >
                  <option value="">-- Chưa chọn nguồn --</option>
                  {(sources || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Initial Status & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Trạng thái ban đầu
                </label>
                <select
                  {...register('overallStatus')}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="LEAD_MOI">Lead mới (LEAD_MOI)</option>
                  <option value="DANG_TIEP_CAN">Đang tiếp cận (DANG_TIEP_CAN)</option>
                  <option value="DANG_TU_VAN">Đang tư vấn (DANG_TU_VAN)</option>
                  <option value="THANH_CONG">Thành công (THANH_CONG)</option>
                  <option value="KHONG_KHA_THI">Không khả thi (KHONG_KHA_THI)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Mức độ ưu tiên ban đầu
                </label>
                <select
                  {...register('priority')}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
                >
                  <option value="CHUA_CO_NHU_CAU">Chưa có nhu cầu</option>
                  <option value="THANH_KHOAN">Thanh khoản</option>
                  <option value="TIN_DUNG">Tín dụng</option>
                  <option value="THANH_KHOAN_TIN_DUNG">Thanh khoản & Tín dụng</option>
                </select>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">
                Địa chỉ nơi ở / Khu vực
              </label>
              <input
                type="text"
                placeholder="VD: Quận 1, TP. Hồ Chí Minh"
                {...register('address')}
                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-sans"
              />
            </div>
          </div>

          {/* Footer Controls */}
          <div className="flex items-center justify-end gap-2 p-3 bg-slate-950/80 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting || createCustomer.isPending}
              className="text-xs h-8"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting || createCustomer.isPending}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              {createCustomer.isPending ? 'Đang thêm...' : 'Tạo khách hàng'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCustomerModal;
