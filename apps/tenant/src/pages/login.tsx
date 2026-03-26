import React, { useState } from 'react';
import { Card, Form, Input, Button, message, Typography } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/use-auth-store';
import { httpClient } from '../api/http-client';

const { Title } = Typography;

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      // 拨动 API 打入登录
      const resp: any = await httpClient.post('/auth/login', values);
      // 拦截器已剥离 axios 外壳，直接访问后端返回的 JSON 结构
      login(resp.access_token, {
        userId: resp.user.id,
        username: resp.user.username,
        role: resp.user.role,
        tenantId: resp.user.tenantId,
      });
      message.success('口令验签通过！欢迎进入工作环境');
      navigate('/dashboard');
    } catch (err: any) {
      console.error('前端解析异常:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card title={<Title level={3} style={{ textAlign: 'center', margin: 0, color: '#333' }}>B2B 经销商业务控制台</Title>} style={{ width: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', borderRadius: 12 }}>
        <Form name="login" onFinish={onFinish} layout="vertical" size="large">
          <Form.Item name="username" rules={[{ required: true, message: '系统隔离要求，必须填明登录名' }]}>
            <Input prefix={<UserOutlined style={{ color: '#ccc' }} />} placeholder="用户名或工号 (如 boss 或 admin)" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '鉴权密码不能为空！' }]}>
            <Input.Password prefix={<LockOutlined style={{ color: '#ccc' }} />} placeholder="安全密码 (如 123456)" />
          </Form.Item>
          <Form.Item style={{ marginTop: 32, marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading} block style={{ height: 44, fontSize: 16 }}>
              登 录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
