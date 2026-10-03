import React, { useState } from 'react';

export interface TimeSeriesPoint {
  date: string;
  count: number;
  label?: string;
}

export interface TimeSeriesChartProps {
  title: string;
  question?: string;
  data: TimeSeriesPoint[];
  color?: string;
  height?: number;
  emptyMessage?: string;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  title,
  question,
  data,
  color = '#3b82f6',
  height = 140,
  emptyMessage = 'Chưa có dữ liệu theo chuỗi thời gian',
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div>
          <h4 className="text-xs font-semibold text-slate-200 font-sans uppercase tracking-wider mb-1">
            {title}
          </h4>
          {question && (
            <p className="text-[11px] text-blue-400/90 font-sans mb-2">{question}</p>
          )}
        </div>
        <p className="text-xs text-slate-500 font-mono py-8 text-center">
          {emptyMessage}
        </p>
      </div>
    );
  }

  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const paddingX = 25;
  const paddingY = 20;
  const chartWidth = 500;
  const chartHeight = height;

  const points = data.map((d, i) => {
    const x =
      data.length > 1
        ? paddingX + (i / (data.length - 1)) * (chartWidth - paddingX * 2)
        : chartWidth / 2;
    const y =
      chartHeight -
      paddingY -
      (d.count / maxVal) * (chartHeight - paddingY * 2);
    return { x, y, ...d };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD =
    points.length > 1
      ? `${pathD} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${
          points[0].x
        } ${chartHeight - paddingY} Z`
      : '';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800/80">
        <div>
          <h4 className="text-xs font-semibold text-slate-200 font-sans uppercase tracking-wider">
            {title}
          </h4>
          {question && (
            <p className="text-[11px] text-blue-400/90 font-sans mt-0.5">{question}</p>
          )}
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          Cao nhất: {maxVal} / ngày
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full overflow-visible"
          style={{ height }}
        >
          <defs>
            <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={paddingX}
            y1={chartHeight - paddingY}
            x2={chartWidth - paddingX}
            y2={chartHeight - paddingY}
            stroke="#334155"
            strokeWidth="0.8"
            strokeDasharray="2 2"
          />
          <line
            x1={paddingX}
            y1={paddingY}
            x2={chartWidth - paddingX}
            y2={paddingY}
            stroke="#334155"
            strokeWidth="0.8"
            strokeDasharray="2 2"
          />

          {/* Area fill */}
          {areaD && <path d={areaD} fill={`url(#grad-${title})`} />}

          {/* Line stroke */}
          <path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data point circles */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hoveredIndex === i ? 4.5 : 2.5}
              fill={hoveredIndex === i ? '#ffffff' : color}
              stroke="#0f172a"
              strokeWidth="1.5"
              className="transition-all cursor-pointer"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          ))}
        </svg>

        {/* Hover info tooltip */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <div className="absolute top-1 right-2 p-1.5 px-2.5 rounded bg-slate-950 border border-slate-700 text-[11px] font-mono shadow-lg pointer-events-none">
            <span className="text-slate-400 mr-2">{points[hoveredIndex].date}:</span>
            <span className="text-blue-400 font-bold">{points[hoveredIndex].count} bản ghi</span>
          </div>
        )}
      </div>

      {/* Axis dates */}
      <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mt-1 px-1">
        <span>{data[0]?.date}</span>
        {data.length > 2 && (
          <span>{data[Math.floor(data.length / 2)]?.date}</span>
        )}
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
};

export default TimeSeriesChart;
