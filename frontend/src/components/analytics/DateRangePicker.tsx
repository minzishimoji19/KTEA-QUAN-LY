import React from 'react';
import { Calendar, X } from 'lucide-react';
import { Button } from '../ui/Button';

export interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onChange,
}) => {
  const formatDate = (d: Date) => d.toISOString().slice(0, 10);

  const handlePreset = (preset: '7d' | '30d' | '90d' | 'year' | 'all') => {
    const now = new Date();
    if (preset === 'all') {
      onChange('', '');
      return;
    }

    const endStr = formatDate(now);
    const start = new Date(now);

    if (preset === '7d') {
      start.setDate(now.getDate() - 7);
    } else if (preset === '30d') {
      start.setDate(now.getDate() - 30);
    } else if (preset === '90d') {
      start.setDate(now.getDate() - 90);
    } else if (preset === 'year') {
      start.setFullYear(now.getFullYear(), 0, 1);
    }

    onChange(formatDate(start), endStr);
  };

  const isPresetActive = (preset: '7d' | '30d' | '90d' | 'year' | 'all') => {
    if (preset === 'all') return !startDate && !endDate;
    const now = new Date();
    const endStr = formatDate(now);
    if (endDate !== endStr) return false;

    const start = new Date(now);
    if (preset === '7d') start.setDate(now.getDate() - 7);
    else if (preset === '30d') start.setDate(now.getDate() - 30);
    else if (preset === '90d') start.setDate(now.getDate() - 90);
    else if (preset === 'year') start.setFullYear(now.getFullYear(), 0, 1);

    return startDate === formatDate(start);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl border border-slate-800 bg-slate-900/60 text-xs">
      <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px] px-1">
        <Calendar className="w-3.5 h-3.5 text-blue-400" />
        <span className="hidden sm:inline">Thời gian:</span>
      </div>

      {/* Preset Pills */}
      <div className="flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => handlePreset('all')}
          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
            isPresetActive('all')
              ? 'bg-blue-600 text-white font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          Tất cả
        </button>
        <button
          onClick={() => handlePreset('7d')}
          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
            isPresetActive('7d')
              ? 'bg-blue-600 text-white font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          7 ngày
        </button>
        <button
          onClick={() => handlePreset('30d')}
          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
            isPresetActive('30d')
              ? 'bg-blue-600 text-white font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          30 ngày
        </button>
        <button
          onClick={() => handlePreset('90d')}
          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
            isPresetActive('90d')
              ? 'bg-blue-600 text-white font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          90 ngày
        </button>
        <button
          onClick={() => handlePreset('year')}
          className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
            isPresetActive('year')
              ? 'bg-blue-600 text-white font-medium'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          Năm nay
        </button>
      </div>

      <div className="h-4 w-[1px] bg-slate-800 hidden sm:block" />

      {/* Custom Date Inputs */}
      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onChange(e.target.value, endDate)}
          className="h-7 px-2 bg-slate-950 border border-slate-800 rounded text-[11px] font-mono text-slate-200 focus:outline-none focus:border-blue-500"
          title="Từ ngày"
        />
        <span className="text-slate-500 font-mono text-[10px]">đến</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onChange(startDate, e.target.value)}
          className="h-7 px-2 bg-slate-950 border border-slate-800 rounded text-[11px] font-mono text-slate-200 focus:outline-none focus:border-blue-500"
          title="Đến ngày"
        />

        {(startDate || endDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange('', '')}
            className="h-7 w-7 p-0 text-slate-500 hover:text-slate-300"
            title="Xóa lọc thời gian"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default DateRangePicker;
