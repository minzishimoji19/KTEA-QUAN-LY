import ExcelJS from 'exceljs';
import { Role, CustomerStatus, PriorityLevel, Gender } from '@prisma/client';
import { customerRepository, CustomerQueryFilters } from '../repositories/customer.repository.js';
import { customerAccessService } from './customerAccess.service.js';
import { enrichCustomerWithStatus } from './customerStatus.service.js';

export interface ExportCustomerOptions {
  filters: CustomerQueryFilters;
  selectedIds?: string[];
  user: {
    userId: string;
    role: Role;
  };
}

/**
 * Phòng chống Formula Injection đối với dữ liệu do người dùng nhập hoặc nguồn ngoài.
 * Nếu ô bắt đầu bằng =, +, -, @, ký tự tab hoặc xuống dòng, thêm dấu ' vào đầu để Excel hiểu là văn bản thuần.
 */
export function sanitizeExcelValue(value: unknown): string | number | Date | null {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';

  const rawStr = String(value);
  if (/^[=+\-@\t\r]/.test(rawStr)) {
    return `'${rawStr}`;
  }
  if (/^\s*[=+\-@]/.test(rawStr)) {
    return `'${rawStr.trim()}`;
  }
  return rawStr.trim();
}

const STATUS_LABELS: Record<string, string> = {
  [CustomerStatus.LEAD_MOI]: 'Lead mới',
  [CustomerStatus.DANG_TIEP_CAN]: 'Đang tiếp cận',
  [CustomerStatus.DANG_TU_VAN]: 'Đang tư vấn',
  [CustomerStatus.THANH_CONG]: 'Thành công',
  [CustomerStatus.KHONG_KHA_THI]: 'Không khả thi',
  // CaseProgress fallback mappings if applicable
  APPOINTED: 'Đã hẹn',
  APPLICATION_CREATED: 'Đã tạo hồ sơ',
  APPLICATION_UPDATED: 'Cập nhật hồ sơ',
  PUSH_SENT: 'Đã gửi duyệt',
  APPROVED: 'Đã phê duyệt',
  REJECTED: 'Từ chối',
  CARD_ISSUED: 'Đã phát hành',
  CARD_ACTIVATED: 'Đã kích hoạt',
  COMPLETED: 'Hoàn tất',
};

const PRIORITY_LABELS: Record<string, string> = {
  [PriorityLevel.CHUA_CO_NHU_CAU]: 'Chưa có nhu cầu',
  [PriorityLevel.THANH_KHOAN]: 'Thanh khoản',
  [PriorityLevel.TIN_DUNG]: 'Tín dụng',
  [PriorityLevel.THANH_KHOAN_TIN_DUNG]: 'Thanh khoản & Tín dụng',
};

const GENDER_LABELS: Record<string, string> = {
  [Gender.MALE]: 'Nam',
  [Gender.FEMALE]: 'Nữ',
  [Gender.OTHER]: 'Khác',
};

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export class CustomerExportService {
  async exportCustomersToExcel(options: ExportCustomerOptions): Promise<Buffer> {
    const { filters, selectedIds, user } = options;

    const queryFilters: CustomerQueryFilters = {
      ...filters,
      page: 1,
      pageSize: 100000, // Export all matching results
    };

    // RBAC: Partner chỉ xuất được khách hàng trong phạm vi được phân công
    if (user.role === Role.PARTNER) {
      const assignedIds = await customerAccessService.getAssignedCustomerIds(user.userId);
      queryFilters.scopedCustomerIds = assignedIds;

      if (selectedIds && selectedIds.length > 0) {
        // Chỉ giữ các id thuộc phạm vi được phân công
        const assignedSet = new Set(assignedIds);
        queryFilters.selectedIds = selectedIds.filter((id) => assignedSet.has(id));
      }
    } else if (selectedIds && selectedIds.length > 0) {
      queryFilters.selectedIds = selectedIds;
    }

    const { customers } = await customerRepository.findMany(queryFilters);
    const enrichedCustomers = customers.map((c) => enrichCustomerWithStatus(c));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'KTEA CRM System';
    workbook.lastModifiedBy = 'KTEA CRM System';
    workbook.created = new Date();
    workbook.modified = new Date();

    // ==========================================
    // SHEET 1: DANH SÁCH KHÁCH HÀNG
    // ==========================================
    const sheet1 = workbook.addWorksheet('Danh sách khách hàng', {
      views: [{ state: 'frozen', ySplit: 2 }],
    });

    // Tiêu đề lớn
    sheet1.mergeCells('A1:N1');
    const titleCell = sheet1.getCell('A1');
    titleCell.value = 'DANH SÁCH KHÁCH HÀNG — KTEA CRM';
    titleCell.font = { name: 'Calibri', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Deep Blue
    };
    sheet1.getRow(1).height = 34;

    // Header bảng
    const headers = [
      { header: 'STT', key: 'stt', width: 8 },
      { header: 'Mã KH', key: 'id', width: 14 },
      { header: 'Họ và tên', key: 'fullName', width: 26 },
      { header: 'Số điện thoại', key: 'phone', width: 16 },
      { header: 'Email', key: 'email', width: 24 },
      { header: 'Giới tính', key: 'gender', width: 12 },
      { header: 'Nguồn khách', key: 'source', width: 20 },
      { header: 'Trạng thái', key: 'status', width: 18 },
      { header: 'Mức độ ưu tiên', key: 'priority', width: 18 },
      { header: 'Người chăm sóc', key: 'caregiver', width: 22 },
      { header: 'Số lần CS', key: 'careCount', width: 12 },
      { header: 'Lần CS gần nhất', key: 'lastCare', width: 20 },
      { header: 'Ghi chú / Địa chỉ', key: 'note', width: 32 },
      { header: 'Ngày tạo', key: 'createdAt', width: 18 },
    ];

    headers.forEach((col, idx) => {
      sheet1.getColumn(idx + 1).width = col.width;
    });

    // Dòng 2: Header columns styling
    const headerRow = sheet1.getRow(2);
    headers.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = col.header;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }, // Royal Blue
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });
    headerRow.height = 28;

    // Thêm dữ liệu
    enrichedCustomers.forEach((cust, index) => {
      const rowIdx = index + 3;
      const row = sheet1.getRow(rowIdx);

      // Xác định người chăm sóc
      let caregiverName = 'Chưa phân công';
      if (cust.assignments && cust.assignments.length > 0) {
        caregiverName = cust.assignments.map((a: any) => a.user?.fullName || a.user?.email).filter(Boolean).join(', ') || caregiverName;
      } else if (cust.followUps && cust.followUps.length > 0) {
        caregiverName = cust.followUps[0].assignedTo || caregiverName;
      }

      // Xác định số lần chăm sóc
      const careCount = cust._count?.followUps ?? cust.followUps?.length ?? 0;

      // Xác định lần chăm sóc gần nhất
      const lastCareDate = cust.followUps?.[0]?.dueAt || cust.activities?.[0]?.occurredAt;
      const lastCareFormatted = lastCareDate ? formatDate(lastCareDate) : 'Chưa có';

      // Nguồn khách
      const sourceName = cust.customerSource?.name || cust.source || 'Chưa xác định';

      // Trạng thái hiển thị
      const statusLabel = STATUS_LABELS[cust.overallStatus] || cust.overallStatus || 'Lead mới';

      // Ưu tiên hiển thị
      const priorityLabel = cust.priority ? (PRIORITY_LABELS[cust.priority] || cust.priority) : 'Chưa có nhu cầu';

      // Ghi chú
      const noteContent = cust.note || cust.address || '';

      const values = [
        index + 1,
        sanitizeExcelValue(cust.id.slice(0, 8)),
        sanitizeExcelValue(cust.fullName),
        sanitizeExcelValue(cust.phone),
        sanitizeExcelValue(cust.email || ''),
        sanitizeExcelValue(cust.gender ? GENDER_LABELS[cust.gender] || cust.gender : ''),
        sanitizeExcelValue(sourceName),
        sanitizeExcelValue(statusLabel),
        sanitizeExcelValue(priorityLabel),
        sanitizeExcelValue(caregiverName),
        careCount,
        sanitizeExcelValue(lastCareFormatted),
        sanitizeExcelValue(noteContent),
        sanitizeExcelValue(formatDate(cust.createdAt)),
      ];

      values.forEach((val, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = val as any;
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };

        // Căn lề
        if (colIdx === 0 || colIdx === 1 || colIdx === 3 || colIdx === 5 || colIdx === 10 || colIdx === 11 || colIdx === 13) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else if (colIdx === 7 || colIdx === 8) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });

      // Zebra striping
      if (index % 2 === 1) {
        for (let c = 1; c <= headers.length; c++) {
          row.getCell(c).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        }
      }
      row.height = 22;
    });

    // ==========================================
    // SHEET 2: THỐNG KÊ TỔNG HỢP
    // ==========================================
    const sheet2 = workbook.addWorksheet('Thống kê tổng hợp');
    sheet2.columns = [
      { header: 'Nhóm phân loại', key: 'group', width: 28 },
      { header: 'Chỉ tiêu', key: 'metric', width: 28 },
      { header: 'Số lượng khách', key: 'count', width: 16 },
      { header: 'Tỷ lệ (%)', key: 'ratio', width: 14 },
    ];

    // Sheet 2 Title
    sheet2.mergeCells('A1:D1');
    const s2Title = sheet2.getCell('A1');
    s2Title.value = 'BÁO CÁO THỐNG KÊ TỔNG HỢP KHÁCH HÀNG';
    s2Title.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    s2Title.alignment = { vertical: 'middle', horizontal: 'center' };
    s2Title.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' },
    };
    sheet2.getRow(1).height = 32;

    const s2Headers = ['Nhóm phân loại', 'Chỉ tiêu / Danh mục', 'Số lượng khách', 'Tỷ lệ (%)'];
    const s2HeaderRow = sheet2.getRow(2);
    s2Headers.forEach((h, idx) => {
      const cell = s2HeaderRow.getCell(idx + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' },
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });
    s2HeaderRow.height = 26;

    const totalCustomers = enrichedCustomers.length;
    let s2RowIdx = 3;

    const addStatRow = (group: string, metric: string, count: number) => {
      const row = sheet2.getRow(s2RowIdx++);
      const ratio = totalCustomers > 0 ? ((count / totalCustomers) * 100).toFixed(1) + '%' : '0%';
      const cells = [group, metric, count, ratio];
      cells.forEach((cVal, idx) => {
        const cell = row.getCell(idx + 1);
        cell.value = cVal;
        cell.font = { name: 'Calibri', size: 10 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
        if (idx === 2 || idx === 3) {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
      row.height = 20;
    };

    // 1. Tổng quan
    addStatRow('Tổng quan', 'Tổng số khách hàng xuất ra', totalCustomers);

    // 2. Theo trạng thái
    const statusCounts: Record<string, number> = {};
    enrichedCustomers.forEach((c) => {
      const label = STATUS_LABELS[c.overallStatus] || c.overallStatus || 'Khác';
      statusCounts[label] = (statusCounts[label] || 0) + 1;
    });
    Object.entries(statusCounts).forEach(([st, cnt]) => {
      addStatRow('Theo trạng thái', st, cnt);
    });

    // 3. Theo mức độ ưu tiên
    const priorityCounts: Record<string, number> = {};
    enrichedCustomers.forEach((c) => {
      const label = c.priority ? (PRIORITY_LABELS[c.priority] || c.priority) : 'Chưa có nhu cầu';
      priorityCounts[label] = (priorityCounts[label] || 0) + 1;
    });
    Object.entries(priorityCounts).forEach(([pr, cnt]) => {
      addStatRow('Theo mức độ ưu tiên', pr, cnt);
    });

    // 4. Theo nguồn khách
    const sourceCounts: Record<string, number> = {};
    enrichedCustomers.forEach((c) => {
      const label = c.customerSource?.name || c.source || 'Chưa xác định';
      sourceCounts[label] = (sourceCounts[label] || 0) + 1;
    });
    Object.entries(sourceCounts).forEach(([src, cnt]) => {
      addStatRow('Theo nguồn khách', src, cnt);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

export const customerExportService = new CustomerExportService();
