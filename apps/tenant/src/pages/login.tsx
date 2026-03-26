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
      // 业务请求拨入底层接口网关
      const resp: any = await httpClient.post('/auth/login', values);
      // 从服务总线中解析出受信任数据流
      login(resp.access_token, {
        userId: resp.user.id,
        username: resp.user.username,
        role: resp.user.role,
        tenantId: resp.user.tenantId,
      });
      message.success('口令验签通过！成功切入系统隔离沙箱级应用层');
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
          <Form.Item name="username" rules={[{ required: true, message: '请基于安全合规要求准确投送用户名' }]}>
            <Input prefix={<UserOutlined style={{ color: '#ccc' }} />} placeholder="经授权之合法员工登入凭证名称" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '核对要素缺失！输入您的凭签口令' }]}>
            <Input.Password prefix={<LockOutlined style={{ color: '#ccc' }} />} placeholder="预设防线密码参数" />
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
