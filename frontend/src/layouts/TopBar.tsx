import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Menu,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { healthService } from '../services/healthService';
import { useLayout } from './LayoutContext';
import { Button } from '../components/ui/Button';

export const TopBar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isCollapsed, toggleCollapse, setMobileOpen, openQuickAction } = useLayout();
  const [searchValue, setSearchValue] = useState('');

  // Query backend health
  const { data: health, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['system-health'],
    queryFn: healthService.checkHealth,
    refetchInterval: 30000,
    retry: 1,
  });

  const getPageTitle = (pathname: string): { title: string; category?: string } => {
    if (pathname === '/') return { title: 'Tổng quan', category: 'Vận hành' };
    if (pathname.startsWith('/customers/')) return { title: 'Chi tiết khách hàng', category: 'Khách hàng' };
    if (pathname === '/customers') return { title: 'Danh bạ khách hàng', category: 'Khách hàng' };
    if (pathname === '/follow-ups') return { title: 'Lịch chăm sóc', category: 'Nhiệm vụ' };
    if (pathname === '/push') return { title: 'Trung tâm xử lý', category: 'Cơ hội' };
    if (pathname === '/analytics') return { title: 'Phân tích dữ liệu', category: 'Báo cáo' };
    if (pathname === '/settings') return { title: 'Cài đặt', category: 'Hệ thống' };
    return { title: 'Bảng điều khiển', category: 'KTEA' };
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      navigate(`/customers?search=${encodeURIComponent(searchValue.trim())}`);
    } else {
      navigate('/customers');
    }
  };

  const pageInfo = getPageTitle(location.pathname);

  return (
    <header className="h-14 bg-slate-950 border-b border-slate-800/90 px-4 md:px-5 flex items-center justify-between gap-3 flex-shrink-0 z-10 select-none">
      {/* Left: Mobile Toggle, Desktop Collapse & Title / Breadcrumb */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800/80"
          aria-label="Mở thanh điều hướng"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Desktop Sidebar Toggle icon button in topbar */}
        <button
          onClick={toggleCollapse}
          className="hidden md:flex p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800/80 transition-colors"
          title={isCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </button>

        {/* Breadcrumb / Page Title */}
        <div className="flex items-center gap-1.5 truncate">
          {pageInfo.category && (
            <>
              <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                {pageInfo.category}
              </span>
              <span className="text-xs text-slate-700 font-mono hidden sm:inline">/</span>
            </>
          )}
          <h1 className="text-sm font-semibold text-slate-100 font-mono tracking-tight truncate">
            {pageInfo.title}
          </h1>
        </div>
      </div>

      {/* Global Customer Search */}
      <div className="flex-1 max-w-sm sm:max-w-md mx-2">
        <form onSubmit={handleSearchSubmit} className="relative">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Tìm kiếm khách hàng theo tên, SĐT... (Nhấn Enter)"
            className="w-full h-8 pl-8 pr-10 text-xs bg-slate-900 border border-slate-800 rounded text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500/70 focus:ring-1 focus:ring-blue-500/30 transition-colors font-sans"
          />
          <kbd className="hidden lg:inline-block absolute right-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[9px] font-mono text-slate-500 bg-slate-850 border border-slate-700/60 rounded">
            Enter
          </kbd>
        </form>
      </div>

      {/* Right Controls: Quick Action & Health Indicator */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Quick Action Button */}
        <Button
          variant="primary"
          size="sm"
          onClick={openQuickAction}
          className="h-8 gap-1.5 text-xs font-medium px-2.5 shadow-none bg-blue-600 hover:bg-blue-500 text-white border-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Thao tác nhanh</span>
        </Button>

        {/* Backend Health Badge */}
        <div
          onClick={() => refetch()}
          title="Nhấn để kiểm tra trạng thái máy chủ"
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono border cursor-pointer transition-colors bg-slate-900/60 border-slate-800 hover:bg-slate-850"
        >
          {isLoading ? (
            <>
              <Activity className="w-3 h-3 text-amber-400 animate-spin" />
              <span className="text-slate-400 text-[10px] hidden md:inline">Đang kết nối</span>
            </>
          ) : isError ? (
            <>
              <AlertCircle className="w-3 h-3 text-red-400" />
              <span className="text-red-400 text-[10px] hidden md:inline">Mất kết nối</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 text-[10px] hidden md:inline">
                Hệ thống sẵn sàng {health?.status ? `(${health.status})` : ''}
              </span>
            </>
          )}
          <RefreshCw
            className={`w-2.5 h-2.5 text-slate-500 ${isFetching ? 'animate-spin' : ''}`}
          />
        </div>
      </div>
    </header>
  );
};

export default TopBar;
