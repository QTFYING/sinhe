import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { queryClient } from './api/queryClient';
import { DashboardLayout } from './layouts/DashboardLayout';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/" element={<DashboardLayout />}>
             <Route path="dashboard" element={<div>工作台概览 (数据接入中...)</div>} />
             <Route path="orders" element={<div>订单管理列表界面 (待 SheetJS 导入)</div>} />
             <Route path="print" element={<div>发货单打单打印作业列...</div>} />
             <Route path="report" element={<div>财务汇总表展示</div>} />
             <Route path="*" element={<div style={{ padding: 24, fontSize: 18 }}>未找到相应的 SaaS 模块 (404)</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
