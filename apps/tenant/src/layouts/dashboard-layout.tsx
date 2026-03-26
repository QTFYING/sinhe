import React, { useEffect } from 'react';
import { Layout, Menu, Button } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { MenuUnfoldOutlined, MenuFoldOutlined, DesktopOutlined, FileTextOutlined, PrinterOutlined, AreaChartOutlined, LogoutOutlined } from '@ant-design/icons';
import { useUIStore } from '../store/use-ui-store';
import { useAuthStore } from '../store/use-auth-store';

const { Header, Sider, Content } = Layout;

// 这是硬编码的角色层级导航渲染树
const getMenuItems = (role: string) => {
  const allItems = [
    { key: '/dashboard', icon: <DesktopOutlined />, label: '工作台概览', roles: ['OS_SUPER_ADMIN', 'TENANT_OWNER', 'TENANT_OPERATOR', 'TENANT_FINANCE', 'TENANT_VIEWER'] },
    { key: '/orders', icon: <FileTextOutlined />, label: '订单管理', roles: ['OS_SUPER_ADMIN', 'TENANT_OWNER', 'TENANT_OPERATOR', 'TENANT_VIEWER'] },
    { key: '/print', icon: <PrinterOutlined />, label: '发货与打印队列表', roles: ['OS_SUPER_ADMIN', 'TENANT_OWNER', 'TENANT_OPERATOR'] },
    { key: '/report', icon: <AreaChartOutlined />, label: '财务报表看板', roles: ['OS_SUPER_ADMIN', 'TENANT_OWNER', 'TENANT_FINANCE', 'TENANT_VIEWER'] },
  ];
  return allItems.filter(item => item.roles.includes(role));
};

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { userInfo, token, logout } = useAuthStore();
  
  // 按照实现架构：严格的前置防御跳板，空跑退信
  useEffect(() => {
    if (!token) navigate('/login', { replace: true });
  }, [token, navigate]);

  if (!userInfo) return null; // 防止数据未响应前带来的路由穿透闪屏效应

  const menuItems = getMenuItems(userInfo.role);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={sidebarCollapsed} theme="light">
        <div style={{ height: 64, margin: 16, background: '#1677ff', color: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
          {sidebarCollapsed ? 'OS' : (userInfo.role === 'OS_SUPER_ADMIN' ? 'OS运营后台' : '数字经销商')}
        </div>
        <Menu theme="light" mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => navigate(key)} />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: '#fff', display: 'flex', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,21,41,0.08)' }}>
          <Button type="text" icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={toggleSidebar} style={{ fontSize: '16px', width: 64, height: 64 }} />
          <div style={{ flex: 1 }} />
          <div style={{ paddingRight: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, color: '#666' }}>当前操作员：<strong style={{ color: '#333' }}>{userInfo.username}</strong> ({userInfo.role})</span>
            <Button type="link" danger onClick={handleLogout} icon={<LogoutOutlined />}>退出系统</Button>
          </div>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280, background: '#fff', borderRadius: 8, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
