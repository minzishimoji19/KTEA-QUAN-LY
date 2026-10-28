/**
 * Vietnamese Date Utilities (dd/MM/yyyy <-> yyyy-MM-dd)
 * Ensures strict calendar validation (including leap years) and prevents timezone off-by-one shifts.
 */

export interface ParsedStrictDate {
  year: number;
  month: number;
  day: number;
  isoDate: string;      // Canonical yyyy-MM-dd
  displayDate: string;  // Vietnamese dd/MM/yyyy
  utcNoonDate: Date;    // Safe UTC 12:00:00Z Date to prevent timezone day shifts
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) return 0;
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1];
}

/**
 * Parses a date string in either canonical ISO `yyyy-MM-dd` or Vietnamese `dd/MM/yyyy` format.
 * Never swaps day and month: `03/04/2000` is strictly day=03, month=04, year=2000.
 * Returns null if the string is malformed or represents a non-existent calendar date (e.g. 29/02/2023 or 31/04/2026).
 */
export function parseStrictDateOnly(input: unknown): ParsedStrictDate | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let year = 0;
  let month = 0;
  let day = 0;

  // Case 1: Canonical ISO date `yyyy-MM-dd`
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else {
    // Case 2: Vietnamese `dd/MM/yyyy`
    const vnMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
    if (vnMatch) {
      day = Number(vnMatch[1]);
      month = Number(vnMatch[2]);
      year = Number(vnMatch[3]);
    } else {
      // Case 3: Full ISO timestamp `yyyy-MM-ddTHH:mm:ss...`
      const isoDateTimeMatch = /^(\d{4})-(\d{2})-(\d{2})T/.exec(trimmed);
      if (isoDateTimeMatch) {
        const parsed = new Date(trimmed);
        if (isNaN(parsed.getTime())) return null;
        year = Number(isoDateTimeMatch[1]);
        month = Number(isoDateTimeMatch[2]);
        day = Number(isoDateTimeMatch[3]);
      } else {
        return null;
      }
    }
  }

  if (!Number.isInteger(year) || year < 1900 || year > 2100) {
    return null;
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  const maxDay = getDaysInMonth(year, month);
  if (!Number.isInteger(day) || day < 1 || day > maxDay) {
    return null;
  }

  const yyyy = String(year).padStart(4, '0');
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');

  return {
    year,
    month,
    day,
    isoDate: `${yyyy}-${mm}-${dd}`,
    displayDate: `${dd}/${mm}/${yyyy}`,
    utcNoonDate: new Date(Date.UTC(year, month - 1, day, 12, 0, 0)),
  };
}

/**
 * Formats an ISO date string or Date into Vietnamese `dd/MM/yyyy` without timezone shift.
 */
export function formatDateDdMmYyyy(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const strict = parseStrictDateOnly(value);
    if (strict) return strict.displayDate;
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    const day = String(value.getUTCDate()).padStart(2, '0');
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const year = value.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }
  return '';
}
