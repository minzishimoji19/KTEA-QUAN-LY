/**
 * Standard utility formatters for financial & operational customer data (vi-VN locale)
 * Standard display date format across KTEA CRM: dd/MM/yyyy
 */

export const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
};

export const getDaysInMonth = (year: number, month: number): number => {
  if (month < 1 || month > 12) return 0;
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1];
};

export const isValidCalendarDate = (day: number, month: number, year: number): boolean => {
  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) return false;
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  const maxDays = getDaysInMonth(year, month);
  return day >= 1 && day <= maxDays;
};

export interface StrictDateParseResult {
  valid: boolean;
  isoDate?: string; // yyyy-MM-dd
  displayDate?: string; // dd/MM/yyyy
  day?: number;
  month?: number;
  year?: number;
  error?: string;
}

/**
 * Strictly parses either 'dd/MM/yyyy' or 'yyyy-MM-dd' (or ISO timestamp) without ever swapping day and month
 * or allowing timezone shifts on date-only strings.
 */
export const parseStrictDateInput = (input: string | null | undefined): StrictDateParseResult => {
  if (input === null || input === undefined) {
    return { valid: false, error: 'Ngày không được để trống' };
  }
  const raw = String(input).trim();
  if (!raw) {
    return { valid: false, error: 'Ngày không được để trống' };
  }

  let year: number;
  let month: number;
  let day: number;

  const vnMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const isoMatch = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const isoTimestampMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})T/);

  if (vnMatch) {
    day = Number(vnMatch[1]);
    month = Number(vnMatch[2]);
    year = Number(vnMatch[3]);
  } else if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else if (isoTimestampMatch) {
    // Extract calendar date safely: if stored at UTC midnight or UTC noon, preserve the intended calendar date
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      // Check if UTC time is 00:00:00 or 12:00:00 (date-only storage convention)
      const utcHours = d.getUTCHours();
      const utcMinutes = d.getUTCMinutes();
      if ((utcHours === 0 || utcHours === 12) && utcMinutes === 0) {
        year = d.getUTCFullYear();
        month = d.getUTCMonth() + 1;
        day = d.getUTCDate();
      } else {
        year = d.getFullYear();
        month = d.getMonth() + 1;
        day = d.getDate();
      }
    } else {
      return { valid: false, error: 'Định dạng ngày không hợp lệ (dd/MM/yyyy)' };
    }
  } else {
    return {
      valid: false,
      error: 'Định dạng ngày không hợp lệ. Vui lòng nhập theo định dạng dd/MM/yyyy (VD: 28/10/2026)',
    };
  }

  if (year < 1900 || year > 2100) {
    return { valid: false, error: 'Năm phải nằm trong khoảng từ 1900 đến 2100' };
  }
  if (month < 1 || month > 12) {
    return { valid: false, error: 'Tháng không hợp lệ (từ 01 đến 12)' };
  }
  const maxDays = getDaysInMonth(year, month);
  if (day < 1 || day > maxDays) {
    return {
      valid: false,
      error: `Ngày ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year} không tồn tại trong lịch`,
    };
  }

  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const yyyy = String(year).padStart(4, '0');

  return {
    valid: true,
    isoDate: `${yyyy}-${mm}-${dd}`,
    displayDate: `${dd}/${mm}/${yyyy}`,
    day,
    month,
    year,
  };
};

/**
 * Converts a date string or Date object into canonical 'yyyy-MM-dd' without timezone day-shift.
 */
export const toIsoDateString = (value: string | Date | null | undefined): string => {
  if (!value) return '';
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return '';
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const parsed = parseStrictDateInput(value);
  return parsed.valid && parsed.isoDate ? parsed.isoDate : '';
};

export const formatCurrency = (amount: number | string | null | undefined): string => {
  if (amount === null || amount === undefined || amount === '') return '--';
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(numeric)) return '--';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(numeric);
};

export const formatNumber = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0';
  const numeric = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numeric)) return '0';
  return new Intl.NumberFormat('vi-VN').format(numeric);
};

export const formatDate = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return '--';
  if (typeof dateString === 'string') {
    const trimmed = dateString.trim();
    // Direct date-only check first to prevent timezone shift
    const isoOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoOnly) {
      return `${isoOnly[3]}/${isoOnly[2]}/${isoOnly[1]}`;
    }
    const vnOnly = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (vnOnly) {
      return trimmed;
    }
    // Check if UTC midnight/noon date-only timestamp (e.g. dateOfBirth)
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return '--';
    const utcH = d.getUTCHours();
    const utcM = d.getUTCMinutes();
    const utcS = d.getUTCSeconds();
    if ((utcH === 0 || utcH === 12) && utcM === 0 && utcS === 0 && trimmed.endsWith('00:00.000Z')) {
      const day = String(d.getUTCDate()).padStart(2, '0');
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const year = d.getUTCFullYear();
      return `${day}/${month}/${year}`;
    }
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  if (dateString instanceof Date) {
    if (isNaN(dateString.getTime())) return '--';
    const day = String(dateString.getDate()).padStart(2, '0');
    const month = String(dateString.getMonth() + 1).padStart(2, '0');
    const year = dateString.getFullYear();
    return `${day}/${month}/${year}`;
  }
  return '--';
};

export const formatDateTime = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return '--';
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(date.getTime())) return '--';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};
