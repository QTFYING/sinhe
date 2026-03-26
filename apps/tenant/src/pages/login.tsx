import React from 'react';
import { Card, Form, Input, Button, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../store/use-auth-store';
import { httpClient } from '../api/http-client';
import type { ApiResponse, UserInfo } from '../types';

const { Title } = Typography;

interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: { id: string; username: string; realName: string; role: string; tenantId: string | null };
}

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const loginMutation = useMutation({
    mutationFn: (values: { username: string; password: string }) =>
      httpClient.post('/auth/login', values) as Promise<ApiResponse<LoginResponse>>,
    onSuccess: (res) => {
      const { accessToken, user } = res.data;
      login(accessToken, {
        userId: user.id,
        username: user.username,
        role: user.role as UserInfo['role'],
        tenantId: user.tenantId,
      });
      message.success('登录成功');
      navigate('/dashboard');
    },
  });

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card
        title={<Title level={3} style={{ textAlign: 'center', margin: 0 }}>经销商工作台</Title>}
        style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: 12 }}
      >
        <Form
          name="login"
          onFinish={(values) => loginMutation.mutate(values)}
          layout="vertical"
          size="large"
          autoComplete="on"
        >
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined style={{ color: '#ccc' }} />} placeholder="用户名" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined style={{ color: '#ccc' }} />} placeholder="密码" autoComplete="current-password" />
          </Form.Item>
          <Form.Item style={{ marginTop: 32, marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loginMutation.isPending} block style={{ height: 44, fontSize: 16 }}>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
