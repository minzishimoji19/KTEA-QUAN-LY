import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, UserPlus, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useCreateCustomer } from '../../hooks/useCustomers';
import { useCustomerSources } from '../../hooks/useCustomerSources';

const createCustomerFormSchema = z.object({
  fullName: z.string().min(1, 'Họ và tên là bắt buộc').max(255),
  phone: z.string().min(8, 'Số điện thoại phải có ít nhất 8 số').max(20),
  email: z.string().email('Địa chỉ email không hợp lệ').optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  note: z.string().max(2000, 'Ghi chú tối đa 2000 ký tự').optional().nullable(),
  sourceId: z.string().optional().nullable(),
  overallStatus: z.enum(['LEAD_MOI', 'DANG_TIEP_CAN', 'DANG_TU_VAN', 'THANH_CONG', 'KHONG_KHA_THI']).optional().default('LEAD_MOI'),
  priority: z.enum(['CHUA_CO_NHU_CAU', 'THANH_KHOAN', 'TIN_DUNG', 'THANH_KHOAN_TIN_DUNG']).optional().nullable().default('CHUA_CO_NHU_CAU'),
});

type CustomerFormData = z.infer<typeof createCustomerFormSchema>;

export interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newId: string) => void;
}

export const CreateCustomerModal: React.FC<CreateCustomerModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const createCustomer = useCreateCustomer();
  const { data: sources, isLoading: isSourcesLoading } = useCustomerSources();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({
    resolver: zodResolver(createCustomerFormSchema),
    defaultValues: {
      fullName: '',
      phone: '',
      email: '',
      gender: null,
      dateOfBirth: '',
      note: '',
      sourceId: '',
      overallStatus: 'LEAD_MOI',
      priority: 'CHUA_CO_NHU_CAU',
    },
  });

  if (!isOpen) return null;

  const onSubmit = async (data: CustomerFormData) => {
    try {
      const noteValue = data.note?.trim() || null;
      const created = await createCustomer.mutateAsync({
        fullName: data.fullName.trim(),
        phone: data.phone.trim(),
        email: data.email?.trim() || null,
        gender: data.gender || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString() : null,
        note: noteValue,
        address: noteValue, // Retain address in backend payload for full backward compatibility
        sourceId: data.sourceId || null,
        overallStatus: data.overallStatus || 'LEAD_MOI',
        priority: data.priority || 'CHUA_CO_NHU_CAU',
      });
      reset();
      onClose();
      if (onSuccess && created?.id) {
        onSuccess(created.id);
      }
    } catch {
      // Handled by mutation state
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-100">
      <div
        className="w-full max-w-lg rounded-lg border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-100"
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between p-3.5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">Thêm khách hàng mới</h3>
              <p className="text-[10px] text-slate-400">Nhập thông tin định danh và khởi tạo hồ sơ</p>
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

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto text-xs">
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
                      {s.name} {!s.active ? '(Inactive)' : ''}
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

            {/* Ghi chú (Thay thế nhãn Địa chỉ theo Yêu cầu 3) */}
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                Ghi chú
              </label>
              <textarea
                rows={3}
                placeholder="Nhập ghi chú về khách hàng (nhu cầu, lưu ý thẩm định, lịch sử trao đổi...)"
                {...register('note')}
                className="w-full p-2 bg-slate-950 border border-slate-800 rounded text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-sans text-xs resize-y"
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
