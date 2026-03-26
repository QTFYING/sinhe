import React from 'react';
import { Card, Form, InputNumber, Button, Descriptions, Spin, message } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { httpClient } from '../../api/http-client';
import type { TenantSettings, ApiResponse } from '../../types';

export const TenantSettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [form] = Form.useForm();

  // 获取配置 — GET /tenant/settings
  const { data: settingsResp, isLoading } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => httpClient.get('/tenant/settings') as Promise<ApiResponse<TenantSettings>>,
  });

  const settings = settingsResp?.data;

  // 更新配置 — PATCH /tenant/settings
  const updateMutation = useMutation({
    mutationFn: (values: { maxCreditDays?: number; creditReminderDays?: number }) =>
      httpClient.patch('/tenant/settings', values),
    onSuccess: () => {
      message.success('设置已保存');
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
    },
  });

  if (isLoading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>;

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>租户设置</h2>

      {/* 基本信息（只读） */}
      <Card title="基本信息" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label="租户名称">{settings?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="联系电话">{settings?.contactPhone || '-'}</Descriptions.Item>
          <Descriptions.Item label="SaaS到期时间">{settings?.expireAt ? dayjs(settings.expireAt).format('YYYY-MM-DD') : '-'}</Descriptions.Item>
          <Descriptions.Item label="拉卡拉商户号">{settings?.paymentConfig?.lakalaShopNo || '-'}</Descriptions.Item>
        </Descriptions>
        <p style={{ marginTop: 8, fontSize: 12, color: '#999' }}>以上信息仅 OS 平台可修改，如需变更请联系平台管理员。</p>
      </Card>

      {/* 账期配置（可编辑） */}
      <Card title="账期配置">
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            maxCreditDays: settings?.maxCreditDays || 30,
            creditReminderDays: settings?.creditReminderDays || 3,
          }}
          onFinish={(values) => updateMutation.mutate(values)}
        >
          <Form.Item
            name="maxCreditDays"
            label="最大账期天数"
            rules={[{ required: true, message: '请输入' }, { type: 'number', min: 1, max: 365, message: '范围 1-365' }]}
          >
            <InputNumber min={1} max={365} style={{ width: 200 }} addonAfter="天" />
          </Form.Item>
          <Form.Item
            name="creditReminderDays"
            label="提前提醒天数"
            rules={[{ required: true, message: '请输入' }, { type: 'number', min: 1, max: 30, message: '范围 1-30' }]}
          >
            <InputNumber min={1} max={30} style={{ width: 200 }} addonAfter="天" />
          </Form.Item>
          <p style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>
            修改账期天数仅影响后续新建订单，历史订单不受影响。
          </p>
          <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>
            保存设置
          </Button>
        </Form>
      </Card>
    </div>
  );
};
