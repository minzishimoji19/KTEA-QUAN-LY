import React, { useState } from 'react';
import {
  Clock,
  Phone,
  MessageSquare,
  UserCheck,
  FilePlus,
  FileCheck,
  RefreshCw,
  Layers,
  CalendarCheck,
  Send,
  CheckCircle,
  FileText,
  Activity,
  Plus,
  Filter,
} from 'lucide-react';
import { CustomerActivity, ActivityType } from '../../types/models';
import { DateDisplay, StatusBadge, EmptyState } from '../../components/common';
import { Button } from '../../components/ui/Button';

export interface ActivityTimelineProps {
  activities: CustomerActivity[];
  customerId: string;
  onAddActivity?: () => void;
  className?: string;
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  onAddActivity,
  className,
}) => {
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [filterQuery, setFilterQuery] = useState('');

  const getActivityIcon = (type: ActivityType) => {
    switch (type) {
      case 'CONTACT':
        return <UserCheck className="w-3.5 h-3.5 text-blue-400" />;
      case 'CALL':
        return <Phone className="w-3.5 h-3.5 text-emerald-400" />;
      case 'MESSAGE':
        return <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />;
      case 'APPLICATION_CREATED':
        return <FilePlus className="w-3.5 h-3.5 text-purple-400" />;
      case 'APPLICATION_UPDATED':
        return <FileCheck className="w-3.5 h-3.5 text-indigo-400" />;
      case 'STATUS_CHANGED':
        return <RefreshCw className="w-3.5 h-3.5 text-amber-400" />;
      case 'NEED_DETECTED':
        return <Layers className="w-3.5 h-3.5 text-yellow-400" />;
      case 'FOLLOW_UP':
        return <CalendarCheck className="w-3.5 h-3.5 text-orange-400" />;
      case 'PUSH_CREATED':
      case 'PUSH_SENT':
        return <Send className="w-3.5 h-3.5 text-purple-400" />;
      case 'PUSH_RESULT':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
      case 'NOTE_CREATED':
      case 'NOTE':
        return <FileText className="w-3.5 h-3.5 text-slate-300" />;
      case 'MEETING':
        return <UserCheck className="w-3.5 h-3.5 text-blue-400" />;
      case 'SYSTEM_EVENT':
      default:
        return <Activity className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  // Filter activities
  const filtered = [...activities]
    .filter((act) => {
      if (selectedType !== 'ALL' && act.type !== selectedType) return false;
      if (filterQuery.trim()) {
        const q = filterQuery.toLowerCase();
        return (
          act.title.toLowerCase().includes(q) ||
          (act.description && act.description.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

  return (
    <div className={`space-y-4 ${className || ''}`}>
      {/* Controls & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-lg border border-slate-800 bg-slate-900/60">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 select-none mr-1">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="font-mono text-[11px] uppercase tracking-wider hidden sm:inline">
              Bộ lọc:
            </span>
          </div>

          {/* Type Dropdown */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="h-7 bg-slate-950 border border-slate-800 rounded px-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 font-mono"
          >
            <option value="ALL">Tất cả loại ({activities.length})</option>
            <option value="CONTACT">Liên hệ (CONTACT)</option>
            <option value="CALL">Cuộc gọi (CALL)</option>
            <option value="MESSAGE">Tin nhắn (MESSAGE)</option>
            <option value="APPLICATION_CREATED">Tạo hồ sơ (APPLICATION_CREATED)</option>
            <option value="APPLICATION_UPDATED">Cập nhật hồ sơ (APPLICATION_UPDATED)</option>
            <option value="STATUS_CHANGED">Đổi trạng thái (STATUS_CHANGED)</option>
            <option value="NEED_DETECTED">Phát hiện nhu cầu (NEED_DETECTED)</option>
            <option value="FOLLOW_UP">Chăm sóc lại (FOLLOW_UP)</option>
            <option value="PUSH_CREATED">Tạo chuyển khách (PUSH_CREATED)</option>
            <option value="PUSH_RESULT">Kết quả chuyển khách (PUSH_RESULT)</option>
            <option value="NOTE_CREATED">Tạo ghi chú (NOTE_CREATED)</option>
            <option value="SYSTEM_EVENT">Sự kiện hệ thống (SYSTEM_EVENT)</option>
          </select>

          {/* Keyword Search */}
          <input
            type="text"
            placeholder="Tìm kiếm dòng hoạt động..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="h-7 w-36 sm:w-48 px-2 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 font-sans"
          />

          {(selectedType !== 'ALL' || filterQuery) && (
            <button
              onClick={() => {
                setSelectedType('ALL');
                setFilterQuery('');
              }}
              className="text-[11px] text-slate-400 hover:text-slate-200 underline font-mono"
            >
              Đặt lại
            </button>
          )}
        </div>

        {onAddActivity && (
          <Button
            variant="primary"
            size="sm"
            onClick={onAddActivity}
            className="h-7 text-xs gap-1 bg-amber-600 hover:bg-amber-500 text-white font-medium"
          >
            <Plus className="w-3 h-3" />
            <span>Ghi nhận hoạt động</span>
          </Button>
        )}
      </div>

      {/* Timeline Feed */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Clock className="w-6 h-6 text-slate-400" />}
          title="Không tìm thấy hoạt động nào"
          description={
            activities.length === 0
              ? 'Chưa có hoạt động tương tác nào được ghi nhận cho khách hàng này.'
              : 'Không có hoạt động nào khớp với bộ lọc hiện tại.'
          }
          actionLabel={onAddActivity ? '+ Ghi nhận hoạt động' : undefined}
          onAction={onAddActivity}
        />
      ) : (
        <div className="relative pl-6 space-y-3.5 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
          {filtered.map((act) => (
            <div key={act.id} className="relative group">
              {/* Timeline Marker Pin */}
              <div className="absolute -left-[23px] top-2 w-3.5 h-3.5 rounded-full bg-slate-900 border-2 border-slate-700 flex items-center justify-center group-hover:border-blue-500 transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 opacity-80" />
              </div>

              {/* Event Card */}
              <div className="p-3 rounded-lg border border-slate-800 bg-slate-950/70 hover:border-slate-700 transition-colors space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-slate-900 border border-slate-800">
                      {getActivityIcon(act.type)}
                    </div>
                    <StatusBadge status={act.type} />
                    <h4 className="text-xs font-semibold text-slate-100 font-sans">
                      {act.title}
                    </h4>
                  </div>
                  <DateDisplay
                    date={act.occurredAt}
                    showTime
                    relativeContext
                    className="text-[11px] text-slate-400 font-mono"
                  />
                </div>

                {act.description && (
                  <p className="text-xs text-slate-300 leading-relaxed pl-7 pt-0.5">
                    {act.description}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityTimeline;
