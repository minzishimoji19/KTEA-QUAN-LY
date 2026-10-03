import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TableSkeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  onRowClick?: (row: T) => void;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  isEmpty = false,
  emptyTitle = 'Không tìm thấy dữ liệu',
  emptyDescription = 'Không có bản ghi nào phù hợp với điều kiện lọc hiện tại.',
  emptyActionLabel,
  onEmptyAction,
  sortBy,
  sortOrder,
  onSort,
  onRowClick,
  className,
}: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className={cn('rounded-lg border border-slate-800 bg-slate-900/40 p-4', className)}>
        <TableSkeleton rows={6} columns={columns.length || 6} />
      </div>
    );
  }

  if (isEmpty || (!isLoading && data.length === 0)) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/30 p-8">
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onAction={onEmptyAction}
        />
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/50 shadow-sm', className)}>
      <table className="w-full border-collapse text-left text-xs font-sans">
        {/* Table Header */}
        <thead className="bg-slate-950/80 border-b border-slate-800 select-none">
          <tr>
            {columns.map((col) => {
              const isSorted = sortBy === col.key;
              const alignment = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';

              return (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable && onSort && onSort(col.key)}
                  className={cn(
                    'py-2.5 px-3 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400',
                    alignment,
                    col.sortable ? 'cursor-pointer hover:text-slate-200 transition-colors' : ''
                  )}
                >
                  <div className={cn('inline-flex items-center gap-1.5', col.align === 'right' ? 'flex-row-reverse' : '')}>
                    <span>{col.header}</span>
                    {col.sortable && (
                      <span className="text-slate-600">
                        {isSorted ? (
                          sortOrder === 'asc' ? (
                            <ArrowUp className="w-3 h-3 text-blue-400" />
                          ) : (
                            <ArrowDown className="w-3 h-3 text-blue-400" />
                          )
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-600 hover:text-slate-400" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-slate-800/60">
          {data.map((row, idx) => {
            const key = keyExtractor(row, idx);
            return (
              <tr
                key={key}
                onClick={() => onRowClick && onRowClick(row)}
                className={cn(
                  'transition-colors duration-100',
                  onRowClick ? 'cursor-pointer hover:bg-slate-800/50' : 'hover:bg-slate-850/30'
                )}
              >
                {columns.map((col) => {
                  const alignment = col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left';
                  const cellValue = col.render ? col.render(row, idx) : (row as any)[col.key];

                  return (
                    <td
                      key={`${key}-${col.key}`}
                      className={cn('py-2 px-3 text-slate-300 align-middle', alignment)}
                    >
                      {cellValue ?? '--'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
