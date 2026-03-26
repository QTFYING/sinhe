import React from 'react';
import { Layout, Menu, Button } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { MenuUnfoldOutlined, MenuFoldOutlined, DesktopOutlined, FileTextOutlined, PrinterOutlined, AreaChartOutlined } from '@ant-design/icons';
import { useUIStore } from '../store/useUIStore';

const { Header, Sider, Content } = Layout;

// 这是硬编码的角色层级导航渲染树
const getMenuItems = (role: string) => {
  const allItems = [
    { key: '/dashboard', icon: <DesktopOutlined />, label: '工作台概览', roles: ['TENANT_OWNER', 'TENANT_OPERATOR', 'TENANT_FINANCE', 'TENANT_VIEWER'] },
    { key: '/orders', icon: <FileTextOutlined />, label: '订单管理', roles: ['TENANT_OWNER', 'TENANT_OPERATOR', 'TENANT_VIEWER'] },
    { key: '/print', icon: <PrinterOutlined />, label: '发货与打印队列表', roles: ['TENANT_OWNER', 'TENANT_OPERATOR'] },
    { key: '/report', icon: <AreaChartOutlined />, label: '财务报表看板', roles: ['TENANT_OWNER', 'TENANT_FINANCE', 'TENANT_VIEWER'] },
  ];

  return allItems.filter(item => item.roles.includes(role));
};

export const DashboardLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  
  // 暂定模拟 JWT：通过 context 获取角色
  const currentRole = 'TENANT_OWNER'; 
  const menuItems = getMenuItems(currentRole);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={sidebarCollapsed} theme="light">
        <div style={{ height: 64, margin: 16, background: 'rgba(0, 0, 0, 0.05)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
          {sidebarCollapsed ? 'SaaS' : '经销商控制台'}
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: 0, background: '#fff', display: 'flex', alignItems: 'center' }}>
          <Button
            type="text"
            icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={toggleSidebar}
            style={{ fontSize: '16px', width: 64, height: 64 }}
          />
          <div style={{ flex: 1 }} />
          <div style={{ paddingRight: 24 }}>欢迎回来，OS / 业务管理员</div>
        </Header>
        <Content style={{ margin: '24px 16px', padding: 24, minHeight: 280, background: '#fff', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
