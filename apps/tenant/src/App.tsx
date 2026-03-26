import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { queryClient } from './api/query-client';
import { DashboardLayout } from './layouts/dashboard-layout';
import { RoleGuard } from './components/role-guard';
import { Login } from './pages/login';
import { Dashboard } from './pages/dashboard';
import { OrderManager } from './pages/orders/order-manager';
import { OrderDetail } from './pages/orders/order-detail';
import { ImportOrders } from './pages/orders/import-orders';
import { PrintCenter } from './pages/print/print-center';
import { FinancialReport } from './pages/report/financial-report';
import { EmployeeManager } from './pages/employee/employee-manager';
import { NotificationList } from './pages/notification/notification-list';
import { TenantSettingsPage } from './pages/settings/tenant-settings';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/" element={<DashboardLayout />}>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="orders" element={
              <RoleGuard allowedRoles={['TENANT_OWNER', 'TENANT_OPERATOR', 'TENANT_VIEWER']}>
                <OrderManager />
              </RoleGuard>
            } />
            <Route path="orders/:id" element={
              <RoleGuard allowedRoles={['TENANT_OWNER', 'TENANT_OPERATOR', 'TENANT_FINANCE', 'TENANT_VIEWER']}>
                <OrderDetail />
              </RoleGuard>
            } />
            <Route path="import" element={
              <RoleGuard allowedRoles={['TENANT_OWNER', 'TENANT_OPERATOR']}>
                <ImportOrders />
              </RoleGuard>
            } />
            <Route path="print" element={
              <RoleGuard allowedRoles={['TENANT_OWNER', 'TENANT_OPERATOR']}>
                <PrintCenter />
              </RoleGuard>
            } />
            <Route path="report" element={
              <RoleGuard allowedRoles={['TENANT_OWNER', 'TENANT_FINANCE', 'TENANT_VIEWER']}>
                <FinancialReport />
              </RoleGuard>
            } />
            <Route path="employees" element={
              <RoleGuard allowedRoles={['TENANT_OWNER']}>
                <EmployeeManager />
              </RoleGuard>
            } />
            <Route path="notifications" element={
              <RoleGuard allowedRoles={['TENANT_OWNER', 'TENANT_FINANCE']}>
                <NotificationList />
              </RoleGuard>
            } />
            <Route path="settings" element={
              <RoleGuard allowedRoles={['TENANT_OWNER']}>
                <TenantSettingsPage />
              </RoleGuard>
            } />
            <Route path="*" element={
              <div style={{ padding: 48, textAlign: 'center', color: '#999', fontSize: 16 }}>
                404 — 页面不存在
              </div>
            } />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
