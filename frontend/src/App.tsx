import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { CustomersPage } from './pages/CustomersPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { FollowUpsPage } from './pages/FollowUpsPage';
import { PushPage } from './pages/PushPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersManagementPage } from './pages/UsersManagementPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { SurveyPage } from './pages/SurveyPage';

// Component redirecting PARTNER to their scoped customers page instead of system-wide dashboard
const DashboardOrPartnerRedirect: React.FC = () => {
  const { role } = useAuth();
  if (role === 'PARTNER') {
    return <Navigate to="/customers" replace />;
  }
  return <DashboardPage />;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Authentication Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Public Survey Route for customers - No login required */}
              <Route path="/survey/:token" element={<SurveyPage />} />

              {/* Protected Authenticated Routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                {/* Default route: Dashboard for ADMIN, redirected to /customers for PARTNER */}
                <Route index element={<DashboardOrPartnerRedirect />} />

                {/* Common scoped routes accessible by both ADMIN and PARTNER */}
                <Route path="customers" element={<CustomersPage />} />
                <Route path="customers/:id" element={<CustomerDetailPage />} />
                <Route path="customers/:customerId/cases/:caseId" element={<CaseDetailPage />} />
                <Route path="follow-ups" element={<FollowUpsPage />} />

                {/* Administrative Only Routes */}
                <Route
                  path="users"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <UsersManagementPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="push"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <PushPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="analytics"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AnalyticsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="settings"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
};

export default App;
