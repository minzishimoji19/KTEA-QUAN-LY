import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Send,
  BarChart3,
  SlidersHorizontal,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useLayout } from './LayoutContext';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  { name: 'Tổng quan', href: '/', icon: LayoutDashboard },
  { name: 'Khách hàng', href: '/customers', icon: Users },
  { name: 'Lịch chăm sóc', href: '/follow-ups', icon: CalendarCheck, badge: 'Nhiệm vụ' },
  { name: 'Phân tích dữ liệu', href: '/analytics', icon: BarChart3 },
  { name: 'Trung tâm xử lý', href: '/push', icon: Send },
  { name: 'Cài đặt', href: '/settings', icon: SlidersHorizontal },
];

export const Sidebar: React.FC = () => {
  const { isCollapsed, toggleCollapse, isMobileOpen, setMobileOpen } = useLayout();
  const location = useLocation();

  // Close mobile drawer when route changes
  React.useEffect(() => {
    if (isMobileOpen) {
      setMobileOpen(false);
    }
  }, [location.pathname, isMobileOpen, setMobileOpen]);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-950 border-r border-slate-800/90 select-none">
      {/* Brand Header */}
      <div
        className={cn(
          'h-14 border-b border-slate-800/90 flex items-center px-3.5 justify-between flex-shrink-0 transition-all duration-150',
          isCollapsed ? 'justify-center px-2' : ''
        )}
      >
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-xs tracking-wider flex-shrink-0 font-mono">
            KT
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-xs tracking-wider uppercase text-slate-100 font-mono truncate">
                KTEA OPS
              </span>
              <span className="text-[10px] text-slate-500 font-mono tracking-tight truncate">
                Quản lý Khách hàng
              </span>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden text-slate-400 hover:text-slate-200 p-1 rounded"
          aria-label="Đóng thanh điều hướng"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {!isCollapsed && (
          <div className="px-2 pb-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider font-mono">
            Điều hướng
          </div>
        )}
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            title={isCollapsed ? item.name : undefined}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded transition-colors duration-100 relative',
                isActive
                  ? 'bg-blue-600/15 text-blue-300 font-semibold border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent',
                isCollapsed ? 'justify-center px-2' : ''
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    'w-4 h-4 flex-shrink-0 transition-colors',
                    isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                {!isCollapsed && (
                  <>
                    <span className="flex-1 truncate">{item.name}</span>
                    {item.badge && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-800 text-slate-400 border border-slate-700/60">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Operator Session Info & Collapse Button Footer */}
      <div className="p-2 border-t border-slate-800/90 bg-slate-950 flex flex-col gap-2">
        {!isCollapsed ? (
          <div className="p-2 rounded bg-slate-900/70 border border-slate-800 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-emerald-500/20 flex-shrink-0" />
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-300">
                <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="truncate">Chuyên viên vận hành</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono truncate">
                Phiên làm việc cá nhân
              </span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-1" title="Chuyên viên vận hành đang hoạt động">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-emerald-500/20" />
          </div>
        )}

        {/* Desktop Collapse Toggle */}
        <button
          onClick={toggleCollapse}
          className={cn(
            'hidden md:flex items-center gap-2 p-1.5 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors border border-slate-800/80',
            isCollapsed ? 'justify-center' : 'justify-between'
          )}
          title={isCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
        >
          {!isCollapsed && (
            <span className="text-[11px] font-mono text-slate-500">Thu gọn</span>
          )}
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          'hidden md:block h-full flex-shrink-0 transition-[width] duration-200 ease-in-out',
          isCollapsed ? 'w-16' : 'w-60'
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 md:hidden transform transition-transform duration-200 ease-in-out',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </div>
    </>
  );
};

export default Sidebar;
