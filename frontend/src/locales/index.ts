import { vi } from './vi';

export { vi };

/**
 * Helper to get Vietnamese label for any system status code
 */
export const translateStatus = (status: string | null | undefined): string => {
  if (!status) return '--';
  const upper = status.trim().toUpperCase();
  if (upper in vi.status) {
    return (vi.status as Record<string, string>)[upper];
  }
  // Fallback: replace underscores with spaces
  return upper.replace(/_/g, ' ');
};

/**
 * Helper to get Vietnamese label for priority levels
 */
export const translatePriority = (priority: string | null | undefined): string => {
  if (!priority) return '--';
  const upper = priority.trim().toUpperCase();
  if (upper in vi.status) {
    return (vi.status as Record<string, string>)[upper];
  }
  return upper;
};

/**
 * Helper to get Vietnamese label for gender
 */
export const translateGender = (gender: string | null | undefined): string => {
  if (!gender) return '--';
  const upper = gender.trim().toUpperCase();
  if (upper in vi.status) {
    return (vi.status as Record<string, string>)[upper];
  }
  return upper;
};

/**
 * Helper to format Vietnamese numbers (e.g. 1.248 instead of 1,248)
 */
export const formatNumberVi = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') return '0';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0';
  return new Intl.NumberFormat('vi-VN').format(num);
};

export default vi;
