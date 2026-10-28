import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X, AlertCircle } from 'lucide-react';
import {
  getDaysInMonth,
  parseStrictDateInput,
  formatDate,
} from '../../utils/formatters';

export interface VietnameseDatePickerProps {
  value: string | null | undefined;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  minDate?: string | null;
  maxDate?: string | null;
  disabled?: boolean;
  required?: boolean;
  hasError?: boolean;
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  id?: string;
  name?: string;
  ariaLabel?: string;
  showClear?: boolean;
}

const VIETNAMESE_MONTHS = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

// Monday-first weekday labels
const VIETNAMESE_WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export const VietnameseDatePicker: React.FC<VietnameseDatePickerProps> = ({
  value,
  onChange,
  placeholder = 'dd/mm/yyyy',
  minDate,
  maxDate,
  disabled = false,
  required = false,
  hasError = false,
  variant = 'dark',
  size = 'md',
  className = '',
  id,
  name,
  ariaLabel,
  showClear = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedMin = useMemo(() => {
    if (!minDate) return undefined;
    const p = parseStrictDateInput(minDate);
    return p.valid ? p.isoDate : undefined;
  }, [minDate]);

  const normalizedMax = useMemo(() => {
    if (!maxDate) return undefined;
    const p = parseStrictDateInput(maxDate);
    return p.valid ? p.isoDate : undefined;
  }, [maxDate]);

  // Convert external value ('yyyy-MM-dd' or 'dd/MM/yyyy' or ISO) to 'dd/MM/yyyy' for display
  const externalParsed = useMemo(() => {
    if (!value) return null;
    const p = parseStrictDateInput(value);
    return p.valid ? p : null;
  }, [value]);

  const [inputText, setInputText] = useState<string>(() =>
    externalParsed?.displayDate ? externalParsed.displayDate : value ? String(value) : ''
  );
  const [localError, setLocalError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState<number>(
    externalParsed?.year || today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState<number>(
    externalParsed?.month || today.getMonth() + 1
  );

  // Sync when external value changes (e.g. step change, reset, or modal open)
  useEffect(() => {
    if (!value) {
      setInputText('');
      setLocalError(null);
      return;
    }
    const parsed = parseStrictDateInput(value);
    if (parsed.valid && parsed.displayDate) {
      setInputText(parsed.displayDate);
      setLocalError(null);
      if (parsed.year && parsed.month) {
        setViewYear(parsed.year);
        setViewMonth(parsed.month);
      }
    } else {
      setInputText(String(value));
    }
  }, [value]);

  // Close popover on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const validateAndCommit = (rawText: string, commitEmpty = true) => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      setLocalError(null);
      if (commitEmpty && value) {
        onChange('');
      }
      return true;
    }

    const parsed = parseStrictDateInput(trimmed);
    if (!parsed.valid || !parsed.isoDate || !parsed.displayDate) {
      setLocalError(parsed.error || 'Ngày không hợp lệ (dd/MM/yyyy)');
      return false;
    }

    if (normalizedMin && parsed.isoDate < normalizedMin) {
      setLocalError(`Ngày không được trước ${formatDate(normalizedMin)}`);
      return false;
    }
    if (normalizedMax && parsed.isoDate > normalizedMax) {
      setLocalError(`Ngày không được sau ${formatDate(normalizedMax)}`);
      return false;
    }

    setLocalError(null);
    setInputText(parsed.displayDate);
    if (parsed.year && parsed.month) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
    if (parsed.isoDate !== value) {
      onChange(parsed.isoDate);
    }
    return true;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const prev = inputText;

    // Allow natural deletion
    if (raw.length < prev.length) {
      setInputText(raw);
      if (!raw.trim()) {
        setLocalError(null);
        onChange('');
      }
      return;
    }

    // If user typed only digits without slashes, auto-insert slashes for dd/MM/yyyy convenience
    const digitsOnly = raw.replace(/\D/g, '');
    let formatted = raw;
    if (/^[\d/]*$/.test(raw)) {
      if (!raw.includes('/') && digitsOnly.length > 2) {
        if (digitsOnly.length <= 4) {
          formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2)}`;
        } else {
          formatted = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4, 8)}`;
        }
      } else if (raw.length === 2 && prev.length === 1 && /^\d{2}$/.test(raw)) {
        formatted = `${raw}/`;
      } else if (raw.length === 5 && prev.length === 4 && /^\d{2}\/\d{2}$/.test(raw)) {
        formatted = `${raw}/`;
      }
    }

    if (formatted.length > 10) {
      formatted = formatted.slice(0, 10);
    }

    setInputText(formatted);

    // If full 10-character dd/MM/yyyy is entered, validate immediately
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(formatted)) {
      validateAndCommit(formatted, false);
    } else {
      setLocalError(null);
    }
  };

  const handleBlur = () => {
    validateAndCommit(inputText, true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const ok = validateAndCommit(inputText, true);
      if (ok) setIsOpen(false);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown' && !isOpen) {
      setIsOpen(true);
    }
  };

  const handleSelectDay = (day: number) => {
    const dd = String(day).padStart(2, '0');
    const mm = String(viewMonth).padStart(2, '0');
    const yyyy = String(viewYear).padStart(4, '0');
    const iso = `${yyyy}-${mm}-${dd}`;
    const display = `${dd}/${mm}/${yyyy}`;

    if (normalizedMin && iso < normalizedMin) return;
    if (normalizedMax && iso > normalizedMax) return;

    setInputText(display);
    setLocalError(null);
    onChange(iso);
    setIsOpen(false);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => Math.max(1900, y - 1));
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => Math.min(2100, y + 1));
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const d = now.getDate();
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (normalizedMin && iso < normalizedMin) {
      setViewYear(Number(normalizedMin.slice(0, 4)));
      setViewMonth(Number(normalizedMin.slice(5, 7)));
      return;
    }
    if (normalizedMax && iso > normalizedMax) {
      setViewYear(Number(normalizedMax.slice(0, 4)));
      setViewMonth(Number(normalizedMax.slice(5, 7)));
      return;
    }
    setViewYear(y);
    setViewMonth(m);
    setInputText(`${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`);
    setLocalError(null);
    onChange(iso);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setInputText('');
    setLocalError(null);
    onChange('');
    inputRef.current?.focus();
  };

  // Build calendar grid for (viewYear, viewMonth)
  const calendarDays = useMemo(() => {
    const totalDays = getDaysInMonth(viewYear, viewMonth);
    const firstDate = new Date(viewYear, viewMonth - 1, 1);
    // Convert JS Sunday=0..Saturday=6 into Monday=0..Sunday=6
    const startOffset = (firstDate.getDay() + 6) % 7;

    const cells: Array<{ day: number | null; iso?: string; disabled?: boolean }> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ day: null });
    }
    for (let d = 1; d <= totalDays; d++) {
      const iso = `${String(viewYear).padStart(4, '0')}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isOut =
        Boolean(normalizedMin && iso < normalizedMin) ||
        Boolean(normalizedMax && iso > normalizedMax);
      cells.push({ day: d, iso, disabled: isOut });
    }
    return cells;
  }, [viewYear, viewMonth, normalizedMin, normalizedMax]);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const minY = normalizedMin ? Number(normalizedMin.slice(0, 4)) : 1930;
    const maxY = normalizedMax ? Number(normalizedMax.slice(0, 4)) : currentYear + 10;
    const start = Math.min(minY, viewYear, 1930);
    const end = Math.max(maxY, viewYear, currentYear + 10);
    const list: number[] = [];
    for (let y = end; y >= start; y--) {
      list.push(y);
    }
    return list;
  }, [normalizedMin, normalizedMax, viewYear]);

  const isLight = variant === 'light';
  const showErrorState = hasError || Boolean(localError);

  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-1.5 text-xs rounded-lg'
      : size === 'lg'
      ? 'px-4 py-3.5 text-base rounded-xl'
      : 'px-3.5 py-2.5 text-sm rounded-xl';

  const inputThemeClasses = isLight
    ? showErrorState
      ? 'bg-red-50/40 border-red-300 text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-red-100 focus:border-red-500'
      : 'bg-slate-50/70 focus:bg-white border-slate-200 text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-teal-100 focus:border-teal-600'
    : showErrorState
    ? 'bg-rose-950/20 border-rose-500/60 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
    : 'bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500';

  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const selectedIso = externalParsed?.isoDate;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          required={required}
          aria-label={ariaLabel || placeholder}
          aria-invalid={showErrorState}
          value={inputText}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`w-full border font-mono tracking-wide transition-all focus:outline-none pr-16 disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${inputThemeClasses}`}
        />
        <div className="absolute right-2 flex items-center gap-1">
          {showClear && inputText && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              title="Xóa ngày"
              className={`p-1 rounded-md transition-colors ${
                isLight
                  ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/60'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => !disabled && setIsOpen((o) => !o)}
            title="Chọn ngày (dd/MM/yyyy)"
            className={`p-1.5 rounded-lg transition-colors ${
              isLight
                ? isOpen
                  ? 'bg-teal-100 text-teal-700'
                  : 'text-slate-500 hover:text-teal-700 hover:bg-slate-200/60'
                : isOpen
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Calendar className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          </button>
        </div>
      </div>

      {localError && (
        <p
          className={`mt-1.5 text-xs flex items-center gap-1.5 font-medium ${
            isLight ? 'text-red-600' : 'text-rose-400'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{localError}</span>
        </p>
      )}

      {isOpen && !disabled && (
        <div
          className={`absolute z-50 mt-1.5 w-72 rounded-xl border shadow-2xl p-3 select-none ${
            isLight
              ? 'bg-white border-slate-200 text-slate-800 shadow-slate-300/50'
              : 'bg-slate-900 border-slate-700 text-slate-100 shadow-black/60'
          }`}
        >
          {/* Header: Month & Year selectors */}
          <div className="flex items-center justify-between gap-1 mb-2.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className={`p-1.5 rounded-lg transition-colors ${
                isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-slate-800 text-slate-300'
              }`}
              title="Tháng trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className={`text-xs font-semibold rounded-lg px-2 py-1 border focus:outline-none cursor-pointer ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-teal-600'
                    : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-indigo-500'
                }`}
              >
                {VIETNAMESE_MONTHS.map((label, idx) => (
                  <option key={label} value={idx + 1}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                className={`text-xs font-semibold rounded-lg px-2 py-1 border focus:outline-none cursor-pointer ${
                  isLight
                    ? 'bg-slate-50 border-slate-200 text-slate-800 focus:border-teal-600'
                    : 'bg-slate-950 border-slate-700 text-slate-100 focus:border-indigo-500'
                }`}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className={`p-1.5 rounded-lg transition-colors ${
                isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-slate-800 text-slate-300'
              }`}
              title="Tháng sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-1 text-center">
            {VIETNAMESE_WEEKDAYS.map((wd) => (
              <div
                key={wd}
                className={`text-[11px] font-semibold py-1 ${
                  isLight ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {wd}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell, index) => {
              if (!cell.day) {
                return <div key={`empty-${index}`} className="h-8" />;
              }
              const isSelected = cell.iso === selectedIso;
              const isToday = cell.iso === todayIso;

              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={cell.disabled}
                  onClick={() => cell.day && handleSelectDay(cell.day)}
                  className={`h-8 w-full rounded-lg text-xs font-medium transition-all flex items-center justify-center ${
                    cell.disabled
                      ? isLight
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-slate-700 cursor-not-allowed'
                      : isSelected
                      ? isLight
                        ? 'bg-teal-600 text-white font-bold shadow-sm'
                        : 'bg-indigo-600 text-white font-bold shadow-sm'
                      : isToday
                      ? isLight
                        ? 'border border-teal-500 text-teal-700 font-semibold hover:bg-teal-50'
                        : 'border border-indigo-500/60 text-indigo-300 font-semibold hover:bg-indigo-500/10'
                      : isLight
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Footer quick actions */}
          <div
            className={`mt-2.5 pt-2 border-t flex items-center justify-between text-xs ${
              isLight ? 'border-slate-100' : 'border-slate-800'
            }`}
          >
            <button
              type="button"
              onClick={handleSelectToday}
              className={`font-medium px-2 py-1 rounded-md transition-colors ${
                isLight
                  ? 'text-teal-700 hover:bg-teal-50'
                  : 'text-indigo-400 hover:bg-indigo-500/10'
              }`}
            >
              Hôm nay ({formatDate(todayIso)})
            </button>
            {inputText && (
              <button
                type="button"
                onClick={handleClear}
                className={`px-2 py-1 rounded-md transition-colors ${
                  isLight
                    ? 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                Xóa
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VietnameseDatePicker;
