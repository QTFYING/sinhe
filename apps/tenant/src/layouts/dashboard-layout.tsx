import React, { useEffect } from 'react';
import { Layout, Menu, Button, Badge } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  MenuUnfoldOutlined, MenuFoldOutlined, DesktopOutlined, FileTextOutlined,
  PrinterOutlined, AreaChartOutlined, LogoutOutlined, UploadOutlined,
  TeamOutlined, BellOutlined, SettingOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useUIStore } from '../store/use-ui-store';
import { useAuthStore } from '../store/use-auth-store';
import { httpClient } from '../api/http-client';
import type { UserRole } from '../types';

const { Header, Sider, Content } = Layout;

const ROLE_LABEL: Record<string, string> = {
  TENANT_OWNER: '管理员',
  TENANT_OPERATOR: '操作员',
  TENANT_FINANCE: '财务',
  TENANT_VIEWER: '只读',
  OS_SUPER_ADMIN: '超管',
  OS_OPERATOR: '运营',
};

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string | React.ReactNode;
  roles: UserRole[];
}

const getMenuItems = (role: string, unreadCount: number) => {
  const allItems: NavItem[] = [
    { key: '/dashboard', icon: <DesktopOutlined />, label: '工作台', roles: ['TENANT_OWNER', 'TENANT_OPERATOR', 'TENANT_FINANCE', 'TENANT_VIEWER'] },
    { key: '/orders', icon: <FileTextOutlined />, label: '订单管理', roles: ['TENANT_OWNER', 'TENANT_OPERATOR', 'TENANT_VIEWER'] },
    { key: '/import', icon: <UploadOutlined />, label: '导入订单', roles: ['TENANT_OWNER', 'TENANT_OPERATOR'] },
    { key: '/print', icon: <PrinterOutlined />, label: '打印中心', roles: ['TENANT_OWNER', 'TENANT_OPERATOR'] },
    { key: '/report', icon: <AreaChartOutlined />, label: '财务报表', roles: ['TENANT_OWNER', 'TENANT_FINANCE', 'TENANT_VIEWER'] },
    { key: '/employees', icon: <TeamOutlined />, label: '员工管理', roles: ['TENANT_OWNER'] },
    {
      key: '/notifications',
      icon: <BellOutlined />,
      label: <span>站内信 {unreadCount > 0 && <Badge count={unreadCount} size="small" offset={[4, -2]} />}</span>,
      roles: ['TENANT_OWNER', 'TENANT_FINANCE'],
    },
    { key: '/settings', icon: <SettingOutlined />, label: '租户设置', roles: ['TENANT_OWNER'] },
  ];
  return allItems
    .filter(item => item.roles.includes(role as UserRole))
    .map(({ roles, ...rest }) => rest);
};

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { userInfo, token, logout } = useAuthStore();

  useEffect(() => {
    if (!token) navigate('/login', { replace: true });
  }, [token, navigate]);

  // 轮询未读通知数
  const { data: unreadData } = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: () => httpClient.get('/notifications/unread-count'),
    refetchInterval: 30000,
    enabled: !!token && ['TENANT_OWNER', 'TENANT_FINANCE'].includes(userInfo?.role || ''),
  });
  const unreadCount = (unreadData as any)?.data?.unreadCount ?? 0;

  if (!userInfo) return null;

  const menuItems = getMenuItems(userInfo.role, unreadCount);

  const handleLogout = async () => {
    try {
      await httpClient.post('/auth/logout');
    } catch {
      // 即使后端失败也清除本地状态
    }
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={sidebarCollapsed} theme="light">
        <div style={{ height: 64, margin: 16, background: '#1677ff', color: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
          {sidebarCollapsed ? '经' : '经销商工作台'}
        </div>
        <Menu theme="light" mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => navigate(key)} />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: '#fff', display: 'flex', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,21,41,0.08)' }}>
          <Button type="text" icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={toggleSidebar} style={{ fontSize: 16, width: 64, height: 64 }} />
          <div style={{ flex: 1 }} />
          <div style={{ paddingRight: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 13, color: '#666' }}>
              {userInfo.username} <span style={{ color: '#999' }}>({ROLE_LABEL[userInfo.role] || userInfo.role})</span>
            </span>
            <Button type="link" danger onClick={handleLogout} icon={<LogoutOutlined />}>退出</Button>
          </div>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280, background: '#fff', borderRadius: 8, overflow: 'auto' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
