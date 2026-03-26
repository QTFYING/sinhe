import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { queryClient } from './api/query-client';
import { DashboardLayout } from './layouts/dashboard-layout';
import { Login } from './pages/login';
import { Dashboard } from './pages/dashboard';
import { OrderManager } from './pages/orders/order-manager';
import { ImportOrders } from './pages/orders/import-orders';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/" element={<DashboardLayout />}>
             <Route path="dashboard" element={<Dashboard />} />
             <Route path="orders" element={<OrderManager />} />
             <Route path="import" element={<ImportOrders />} />
             <Route path="print" element={<div>[发单] @media print 指令接收池正在上线</div>} />
             <Route path="report" element={<div>[财务] 敏感数据看板呈现域</div>} />
             <Route path="*" element={<div style={{ padding: 24, fontSize: 18, color: '#f5222d' }}>404 越权页面未找到</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
