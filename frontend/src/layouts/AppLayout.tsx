import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { LayoutProvider, useLayout } from './LayoutContext';
import { QuickActionModal } from '../components/common/QuickActionModal';

const AppLayoutContent: React.FC = () => {
  const { isQuickActionOpen, closeQuickAction } = useLayout();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100">
      {/* Left Sidebar (collapsible desktop + mobile drawer) */}
      <Sidebar />

      {/* Main Container */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <TopBar />

        {/* Scrollable Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-950">
          <Outlet />
        </main>
      </div>

      {/* Global Quick Action Modal */}
      <QuickActionModal isOpen={isQuickActionOpen} onClose={closeQuickAction} />
    </div>
  );
};

export const AppLayout: React.FC = () => {
  return (
    <LayoutProvider>
      <AppLayoutContent />
    </LayoutProvider>
  );
};

export default AppLayout;
