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
      message.success('财务改价已生效，底层快照审计录入成功！');
      queryClient.invalidateQueries({ queryKey: ['orders-list'] });
      setDiscountDrawerOpen(false);
    }
  });

  const paymentMutation = useMutation({
    mutationFn: (orderId: string) => httpClient.post(`/payment/initiate/${orderId}`),
    onSuccess: (res: any) => {
      // 成功夺取 Redis 分布式防重锁后的安全 Token，并映射到 C 端预设端口
      setPayUrl(`http://localhost:5002/pay/${res.data.qrToken}`);
      setPaymentModalOpen(true);
    }
  });

  const columns = [
    { title: 'ERP源据号', dataIndex: 'erpOrderNo', key: 'erpOrderNo' },
    { title: '商户名称', dataIndex: 'customerName', key: 'customerName' },
    { title: '预估金池', dataIndex: 'totalAmount', render: (val: string) => `¥ ${formatAmount(val)}` },
    { title: '折损豁免', dataIndex: 'discountAmount', render: (val: string) => <span style={{ color: '#cf1322' }}>-¥{formatAmount(val)}</span> },
    { title: '纯入实收', dataIndex: 'paidAmount', render: (val: string) => <strong style={{ color: '#3f8600' }}>¥{formatAmount(val)}</strong> },
    { title: '资金流态', dataIndex: 'payStatus', key: 'payStatus' },
    {
      title: '高权操作区',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="middle">
          <Button type="dashed" danger onClick={() => {
            setSelectedOrder(record);
            form.setFieldsValue({ discountAmount: record.discountAmount });
            setDiscountDrawerOpen(true);
          }}>干预调价金</Button>
          <Button type="primary" loading={paymentMutation.isPending} onClick={() => paymentMutation.mutate(record.id)}>抛出防篡改收银锚点</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 18, color: '#333' }}>高度管制的订单分发总闸</h2>
      <Table columns={columns} dataSource={ordersData?.data || []} rowKey="id" loading={isLoading} bordered />

      <Drawer title="不可逆调价 (Immutable Price Audit)" open={discountDrawerOpen} onClose={() => setDiscountDrawerOpen(false)}>
        <Form form={form} layout="vertical" onFinish={(val) => discountMutation.mutate(val)}>
          <Form.Item name="discountAmount" label="施加扣减缓冲" rules={[{ required: true, message: '请在严格计算后下发改价数字' }]}>
            <Input prefix="¥" placeholder="高危数据录入槽" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={discountMutation.isPending} block danger>
            永久刻入时间线并锁定
          </Button>
        </Form>
      </Drawer>

      <Modal title="资金锁死支付视界" open={paymentModalOpen} onCancel={() => setPaymentModalOpen(false)} footer={null} centered>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
           <p style={{ color: '#666', fontSize: 15 }}>当前资金数据已在服务端冷冻封装。</p>
           <p>请出示给终端业务员或直接访问以下专属链接：</p>
           <a href={payUrl} target="_blank" rel="noreferrer" style={{ fontSize: 18, wordBreak: 'break-all', fontWeight: 'bold' }}>{payUrl}</a>
           <p style={{ marginTop: 32, fontSize: 12, color: '#aaa', borderTop: '1px solid #eee', paddingTop: 16 }}>这串连接由于被底层 Redis 令牌保护，具备独享排他锁，杜绝了多客同时扫码造成系统对账错乱的可能性。</p>
        </div>
      </Modal>
    </div>
  );
};
