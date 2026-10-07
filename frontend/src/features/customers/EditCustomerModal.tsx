import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, UserCheck, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useUpdateCustomer } from '../../hooks/useCustomers';
import { useCreateActivity } from '../../hooks/useActivities';
import { useCustomerSources } from '../../hooks/useCustomerSources';
import { CustomerDetail } from '../../types/models';

const editCustomerSchema = z.object({
  fullName: z.string().min(1, 'Họ và tên là bắt buộc').max(255),
  phone: z.string().min(8, 'Số điện thoại phải có ít nhất 8 chữ số').max(20),
  email: z.string().email('Địa chỉ email không hợp lệ').optional().or(z.literal('')),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional().or(z.literal('')),
  dateOfBirth: z.string().optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
  sourceId: z.string().optional().or(z.literal('')),
  source: z.string().max(100).optional().or(z.literal('')),
  overallStatus: z.enum(['LEAD_MOI', 'DANG_TIEP_CAN', 'DANG_TU_VAN', 'THANH_CONG', 'KHONG_KHA_THI']),
  priority: z.enum(['CHUA_CO_NHU_CAU', 'THANH_KHOAN', 'TIN_DUNG', 'THANH_KHOAN_TIN_DUNG']).optional().or(z.literal('')),
});

type EditCustomerFormData = z.infer<typeof editCustomerSchema>;

export interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerDetail;
}

export const EditCustomerModal: React.FC<EditCustomerModalProps> = ({
  isOpen,
  onClose,
  customer,
}) => {
  const updateCustomer = useUpdateCustomer(customer.id);
  const createActivity = useCreateActivity(customer.id);
  const { data: allSources, isLoading: isSourcesLoading } = useCustomerSources(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditCustomerFormData>({
    resolver: zodResolver(editCustomerSchema),
    defaultValues: {
      fullName: customer.fullName || '',
      phone: customer.phone || '',
      email: customer.email || '',
      gender: customer.gender || '',
      dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.split('T')[0] : '',
      address: customer.address || '',
      sourceId: customer.sourceId || customer.customerSource?.id || '',
      source: customer.source || '',
      overallStatus: customer.overallStatus,
      priority: customer.priority || 'CHUA_CO_NHU_CAU',
    },
  });

  useEffect(() => {
    if (customer && isOpen) {
      reset({
        fullName: customer.fullName || '',
        phone: customer.phone || '',
        email: customer.email || '',
        gender: customer.gender || '',
        dateOfBirth: customer.dateOfBirth ? customer.dateOfBirth.split('T')[0] : '',
        address: customer.address || '',
        sourceId: customer.sourceId || customer.customerSource?.id || '',
        source: customer.source || '',
        overallStatus: customer.overallStatus,
        priority: customer.priority || 'CHUA_CO_NHU_CAU',
      });
    }
  }, [customer, isOpen, reset]);

  if (!isOpen) return null;

  // Filter sources: include all active sources + current customer's source even if inactive
  const availableSources = (allSources || []).filter(
    (s) =>
      s.active ||
      s.id === customer.sourceId ||
      s.id === customer.customerSource?.id
  );

  const onSubmit = async (data: EditCustomerFormData) => {
    try {
      const payload: Partial<CustomerDetail> = {
        fullName: data.fullName.trim(),
        phone: data.phone.trim(),
        overallStatus: data.overallStatus,
        email: data.email?.trim() || null,
        gender: data.gender || null,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth).toISOString() : null,
        address: data.address?.trim() || null,
        sourceId: data.sourceId || null,
        source: data.sourceId
          ? allSources?.find((s) => s.id === data.sourceId)?.name || data.source?.trim() || null
          : data.source?.trim() || null,
        priority: data.priority || null,
      };

      await updateCustomer.mutateAsync({ customerId: customer.id, data: payload });

      // If status changed meaningfully, log audit activity without deleting previous activities
      if (data.overallStatus !== customer.overallStatus) {
        await createActivity.mutateAsync({
          type: 'SYSTEM_EVENT',
          title: `Chuyển trạng thái sang ${data.overallStatus}`,
          description: `Chuyên viên đã cập nhật trạng thái khách hàng từ ${customer.overallStatus} sang ${data.overallStatus}.`,
        });
      }

      onClose();
    } catch (err) {
      console.error('Failed to update customer:', err);
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
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-100 font-mono">Chỉnh sửa hồ sơ khách hàng</h3>
              <p className="text-[10px] text-slate-400">Cập nhật dữ liệu khách hàng và trạng thái chăm sóc</p>
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
            {updateCustomer.isError && (
              <div className="p-2.5 rounded bg-red-950/50 border border-red-800/60 text-red-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>
                  {(updateCustomer.error as Error)?.message || 'Không thể cập nhật thông tin khách hàng.'}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-300 mb-1">
                  Họ và tên <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  {...register('fullName')}
                  className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-blue-500"
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
                  {...register('phone')}
                  className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                />
                {errors.phone && (
                  <p className="text-[10px] text-red-400 mt-1">{errors.phone.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  {...register('email')}
                  className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Giới tính</label>
                <select
                  {...register('gender')}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Chưa xác định</option>
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Ngày sinh</label>
                <input
                  type="date"
                  {...register('dateOfBirth')}
                  className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Nguồn khách hàng</label>
                <select
                  {...register('sourceId')}
                  disabled={isSourcesLoading}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500 font-sans text-xs"
                >
                  <option value="">-- Chưa chọn nguồn --</option>
                  {availableSources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {!s.active ? '(Inactive)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Trạng thái chăm sóc</label>
                <select
                  {...register('overallStatus')}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                >
                  <option value="LEAD_MOI">Lead mới (LEAD_MOI)</option>
                  <option value="DANG_TIEP_CAN">Đang tiếp cận (DANG_TIEP_CAN)</option>
                  <option value="DANG_TU_VAN">Đang tư vấn (DANG_TU_VAN)</option>
                  <option value="THANH_CONG">Thành công (THANH_CONG)</option>
                  <option value="KHONG_KHA_THI">Không khả thi (KHONG_KHA_THI)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Độ ưu tiên</label>
                <select
                  {...register('priority')}
                  className="w-full h-8 px-2 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                >
                  <option value="CHUA_CO_NHU_CAU">Chưa có nhu cầu</option>
                  <option value="THANH_KHOAN">Thanh khoản</option>
                  <option value="TIN_DUNG">Tín dụng</option>
                  <option value="THANH_KHOAN_TIN_DUNG">Thanh khoản & Tín dụng</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-400 mb-1">Địa chỉ</label>
              <input
                type="text"
                {...register('address')}
                className="w-full h-8 px-2.5 bg-slate-950 border border-slate-800 rounded text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 p-3 bg-slate-950/80 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting || updateCustomer.isPending}
              className="text-xs h-8"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting || updateCustomer.isPending}
              className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              {updateCustomer.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditCustomerModal;
