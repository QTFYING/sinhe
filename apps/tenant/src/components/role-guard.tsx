import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/use-auth-store';
import { Result, Button } from 'antd';
import type { UserRole } from '../types';

interface RoleGuardProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { token, userInfo } = useAuthStore();

  if (!token || !userInfo) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(userInfo.role as UserRole)) {
    return (
      <Result
        status="403"
        title="无权限"
        subTitle="您的角色无权访问此页面"
        extra={<Button type="primary" onClick={() => window.history.back()}>返回</Button>}
      />
    );
  }

  return <>{children}</>;
};
