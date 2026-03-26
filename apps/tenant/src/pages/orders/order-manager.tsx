import React, { useState } from 'react';
import { Table, Button, Space, Drawer, Form, Input, message, Modal } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../api/http-client';
import { formatAmount } from 'shared-utils';

export const OrderManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [discountDrawerOpen, setDiscountDrawerOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payUrl, setPayUrl] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [form] = Form.useForm();

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['orders-list'],
    queryFn: () => httpClient.get('/order')
  });

  const discountMutation = useMutation({
    mutationFn: (values: { discountAmount: string }) => httpClient.patch(`/order/${selectedOrder.id}/price`, values),
    onSuccess: () => {
      message.success('财务改价设定完毕，操作已并入底层审计网络！');
      queryClient.invalidateQueries({ queryKey: ['orders-list'] });
      setDiscountDrawerOpen(false);
    }
  });

  const paymentMutation = useMutation({
    mutationFn: (orderId: string) => httpClient.post(`/payment/initiate/${orderId}`),
    onSuccess: (res: any) => {
      // 获取服务端安全锚点，提供专属 C 端支付码
      setPayUrl(`http://localhost:5002/pay/${res.data.qrToken}`);
      setPaymentModalOpen(true);
    }
  });

  const columns = [
    { title: 'ERP订单号', dataIndex: 'erpOrderNo', key: 'erpOrderNo' },
    { title: '企业客户', dataIndex: 'customerName', key: 'customerName' },
    { title: '应付大纲金额', dataIndex: 'totalAmount', render: (val: string) => `¥ ${formatAmount(val)}` },
    { title: '商务折让幅度', dataIndex: 'discountAmount', render: (val: string) => <span style={{ color: '#cf1322' }}>-¥{formatAmount(val)}</span> },
    { title: '实收核销口径', dataIndex: 'paidAmount', render: (val: string) => <strong style={{ color: '#3f8600' }}>¥{formatAmount(val)}</strong> },
    { title: '资金交付状态', dataIndex: 'payStatus', key: 'payStatus' },
    {
      title: '业务核准操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button type="dashed" danger onClick={() => {
            setSelectedOrder(record);
            form.setFieldsValue({ discountAmount: record.discountAmount });
            setDiscountDrawerOpen(true);
          }}>申请折让金调整</Button>
          <Button type="primary" loading={paymentMutation.isPending} onClick={() => paymentMutation.mutate(record.id)}>建构终端支付链接</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 18, color: '#333' }}>商用订单核销中心席</h2>
      <Table columns={columns} dataSource={ordersData?.data || []} rowKey="id" loading={isLoading} bordered />

      <Drawer title="账单数字改价审批项" open={discountDrawerOpen} onClose={() => setDiscountDrawerOpen(false)}>
        <Form form={form} layout="vertical" onFinish={(val) => discountMutation.mutate(val)}>
          <Form.Item name="discountAmount" label="设置折让扣除项" rules={[{ required: true, message: '必须严格输入下发的改价缓冲数字' }]}>
            <Input prefix="¥" placeholder="企业减免金额录入" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={discountMutation.isPending} block danger>
            经手锁定并确认记账
          </Button>
        </Form>
      </Drawer>

      <Modal title="企业终端支付路由收银组件" open={paymentModalOpen} onCancel={() => setPaymentModalOpen(false)} footer={null} centered>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
           <p style={{ color: '#666', fontSize: 15 }}>当前待结资金链已入库锁紧，不可随意更改。</p>
           <p>请提供下方企业级官方收银通道链接予下游业务单位使用：</p>
           <a href={payUrl} target="_blank" rel="noreferrer" style={{ fontSize: 18, wordBreak: 'break-all', fontWeight: 'bold' }}>{payUrl}</a>
           <p style={{ marginTop: 32, fontSize: 12, color: '#aaa', borderTop: '1px solid #eee', paddingTop: 16 }}>提示：当前专属支付门禁代码已嵌入防连击防串账逻辑引擎体系内。</p>
        </div>
      </Modal>
    </div>
  );
};
