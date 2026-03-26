import React, { useState } from 'react';
import { Table, Button, Space, Drawer, Form, Input, Select, Modal, Tag, message, DatePicker } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { httpClient } from '../../api/http-client';
import { useAuthStore } from '../../store/use-auth-store';
import { formatAmount } from 'shared-utils';
import type { Order, PaginatedData, PayStatus, DeliveryStatus, ApiResponse } from '../../types';
import { PAY_STATUS_MAP, DELIVERY_STATUS_MAP } from '../../types';

const { RangePicker } = DatePicker;

const PAY_STATUS_COLOR: Record<PayStatus, string> = {
  UNPAID: 'red', PAYING: 'orange', PARTIAL_PAID: 'gold', PAID: 'green', REFUNDED: 'default',
};

const DELIVERY_STATUS_COLOR: Record<DeliveryStatus, string> = {
  PENDING: 'default', IN_TRANSIT: 'blue', DELIVERED: 'green',
};

export const OrderManager: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const userRole = useAuthStore((s) => s.userInfo?.role);
  const canWrite = userRole === 'TENANT_OWNER' || userRole === 'TENANT_OPERATOR';

  // 分页和筛选
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<{ payStatus?: string; keyword?: string; dateRange?: [string, string] }>({});

  // 弹窗状态
  const [discountDrawerOpen, setDiscountDrawerOpen] = useState(false);
  const [manualPaidModalOpen, setManualPaidModalOpen] = useState(false);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [payUrl, setPayUrl] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [discountForm] = Form.useForm();
  const [manualPaidForm] = Form.useForm();
  const [deliveryForm] = Form.useForm();
  const [filterForm] = Form.useForm();

  // 订单列表 — GET /orders
  const { data: ordersResp, isLoading } = useQuery({
    queryKey: ['orders-list', page, pageSize, filters],
    queryFn: () => httpClient.get('/orders', {
      params: {
        page, pageSize,
        ...(filters.payStatus ? { payStatus: filters.payStatus } : {}),
        ...(filters.keyword ? { keyword: filters.keyword } : {}),
        ...(filters.dateRange ? { startDate: filters.dateRange[0], endDate: filters.dateRange[1] } : {}),
      },
    }) as Promise<ApiResponse<PaginatedData<Order>>>,
  });

  const ordersData = ordersResp?.data;

  // 改价 — PATCH /orders/:id/discount
  const discountMutation = useMutation({
    mutationFn: (values: { discountAmount: string; reason?: string }) =>
      httpClient.patch(`/orders/${selectedOrder!.id}/discount`, values),
    onSuccess: () => {
      message.success('改价成功');
      queryClient.invalidateQueries({ queryKey: ['orders-list'] });
      setDiscountDrawerOpen(false);
      discountForm.resetFields();
    },
  });

  // 发起支付 — POST /pay (C端由后端处理, 此处发起收款链接)
  const paymentMutation = useMutation({
    mutationFn: (orderId: string) => httpClient.get(`/orders/${orderId}/qrcode`) as Promise<ApiResponse<{ qrCodeUrl: string }>>,
    onSuccess: (res) => {
      const data = (res as any).data;
      setPayUrl(data.qrCodeUrl);
      setPaymentModalOpen(true);
    },
  });

  // 手工标记已支付 — POST /orders/:id/manual-paid
  const manualPaidMutation = useMutation({
    mutationFn: (values: { actualAmount: string; markReason: string }) =>
      httpClient.post(`/orders/${selectedOrder!.id}/manual-paid`, values),
    onSuccess: () => {
      message.success('已标记支付');
      queryClient.invalidateQueries({ queryKey: ['orders-list'] });
      setManualPaidModalOpen(false);
      manualPaidForm.resetFields();
    },
  });

  // 更新配送状态 — PATCH /orders/:id/delivery-status
  const deliveryMutation = useMutation({
    mutationFn: (values: { deliveryStatus: string }) =>
      httpClient.patch(`/orders/${selectedOrder!.id}/delivery-status`, values),
    onSuccess: () => {
      message.success('配送状态已更新');
      queryClient.invalidateQueries({ queryKey: ['orders-list'] });
      setDeliveryModalOpen(false);
      deliveryForm.resetFields();
    },
  });

  const handleFilter = (values: Record<string, unknown>) => {
    const dateRange = values.dateRange as [{ format: (f: string) => string }, { format: (f: string) => string }] | undefined;
    setFilters({
      payStatus: values.payStatus as string | undefined,
      keyword: values.keyword as string | undefined,
      dateRange: dateRange ? [dateRange[0].format('YYYY-MM-DD'), dateRange[1].format('YYYY-MM-DD')] : undefined,
    });
    setPage(1);
  };

  const columns = [
    { title: 'ERP订单号', dataIndex: 'erpOrderNo', width: 160 },
    { title: '客户名称', dataIndex: 'customerName', width: 140 },
    { title: '订单金额', dataIndex: 'totalAmount', width: 120, render: (val: string) => `¥${formatAmount(val)}` },
    { title: '折让金额', dataIndex: 'discountAmount', width: 110, render: (val: string) => val !== '0.00' ? <span style={{ color: '#cf1322' }}>-¥{formatAmount(val)}</span> : '-' },
    { title: '实收金额', dataIndex: 'paidAmount', width: 110, render: (val: string) => <strong style={{ color: '#3f8600' }}>¥{formatAmount(val)}</strong> },
    { title: '支付状态', dataIndex: 'payStatus', width: 100, render: (val: PayStatus) => <Tag color={PAY_STATUS_COLOR[val]}>{PAY_STATUS_MAP[val] || val}</Tag> },
    { title: '配送状态', dataIndex: 'deliveryStatus', width: 100, render: (val: DeliveryStatus) => <Tag color={DELIVERY_STATUS_COLOR[val]}>{DELIVERY_STATUS_MAP[val] || val}</Tag> },
    {
      title: '操作',
      key: 'action',
      width: 320,
      render: (_: unknown, record: Order) => (
        <Space size="small" wrap>
          <Button size="small" onClick={() => navigate(`/orders/${record.id}`)}>详情</Button>
          {canWrite && record.payStatus !== 'PAID' && record.payStatus !== 'REFUNDED' && (
            <>
              <Button size="small" type="dashed" onClick={() => {
                setSelectedOrder(record);
                discountForm.setFieldsValue({ discountAmount: record.discountAmount });
                setDiscountDrawerOpen(true);
              }}>改价</Button>
              <Button size="small" type="primary" loading={paymentMutation.isPending} onClick={() => paymentMutation.mutate(record.id)}>收款码</Button>
              <Button size="small" onClick={() => {
                setSelectedOrder(record);
                setManualPaidModalOpen(true);
              }}>手工标记</Button>
              <Button size="small" onClick={() => {
                setSelectedOrder(record);
                deliveryForm.setFieldsValue({ deliveryStatus: record.deliveryStatus });
                setDeliveryModalOpen(true);
              }}>配送</Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>订单管理</h2>

      {/* 筛选栏 */}
      <Form form={filterForm} layout="inline" onFinish={handleFilter} style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <Form.Item name="keyword">
          <Input placeholder="搜索订单号/客户名" allowClear style={{ width: 180 }} />
        </Form.Item>
        <Form.Item name="payStatus">
          <Select placeholder="支付状态" allowClear style={{ width: 130 }}>
            {Object.entries(PAY_STATUS_MAP).map(([k, v]) => <Select.Option key={k} value={k}>{v}</Select.Option>)}
          </Select>
        </Form.Item>
        <Form.Item name="dateRange">
          <RangePicker style={{ width: 240 }} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">查询</Button>
        </Form.Item>
        <Form.Item>
          <Button onClick={() => { filterForm.resetFields(); setFilters({}); setPage(1); }}>重置</Button>
        </Form.Item>
      </Form>

      <Table
        columns={columns}
        dataSource={ordersData?.list || []}
        rowKey="id"
        loading={isLoading}
        bordered
        size="middle"
        pagination={{
          current: page,
          pageSize,
          total: ordersData?.total || 0,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />

      {/* 改价抽屉 */}
      <Drawer title="调整折让金额" open={discountDrawerOpen} onClose={() => setDiscountDrawerOpen(false)} width={400}>
        <Form form={discountForm} layout="vertical" onFinish={(val) => discountMutation.mutate(val)}>
          <Form.Item name="discountAmount" label="折让金额" rules={[{ required: true, message: '请输入折让金额' }]}>
            <Input prefix="¥" placeholder="请输入折让金额" />
          </Form.Item>
          <Form.Item name="reason" label="改价原因">
            <Input.TextArea placeholder="请输入改价原因（选填）" rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={discountMutation.isPending} block>
            确认改价
          </Button>
        </Form>
      </Drawer>

      {/* 手工标记已支付 */}
      <Modal title="手工标记已支付" open={manualPaidModalOpen} onCancel={() => setManualPaidModalOpen(false)} footer={null}>
        <Form form={manualPaidForm} layout="vertical" onFinish={(val) => manualPaidMutation.mutate(val)}>
          <Form.Item name="actualAmount" label="实收金额" rules={[{ required: true, message: '请输入实收金额' }]}>
            <Input prefix="¥" placeholder="请输入本次实收金额" />
          </Form.Item>
          <Form.Item name="markReason" label="标记原因" rules={[{ required: true, message: '请输入标记原因' }]}>
            <Input.TextArea placeholder="如：客户已现金付款" rows={2} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={manualPaidMutation.isPending} block>
            确认标记
          </Button>
        </Form>
      </Modal>

      {/* 配送状态更新 */}
      <Modal title="更新配送状态" open={deliveryModalOpen} onCancel={() => setDeliveryModalOpen(false)} footer={null}>
        <Form form={deliveryForm} layout="vertical" onFinish={(val) => deliveryMutation.mutate(val)}>
          <Form.Item name="deliveryStatus" label="配送状态" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="PENDING">待发货</Select.Option>
              <Select.Option value="IN_TRANSIT">配送中</Select.Option>
              <Select.Option value="DELIVERED">已送达</Select.Option>
            </Select>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={deliveryMutation.isPending} block>
            确认更新
          </Button>
        </Form>
      </Modal>

      {/* 收款码弹窗 */}
      <Modal title="收款二维码" open={paymentModalOpen} onCancel={() => setPaymentModalOpen(false)} footer={null} centered>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={{ color: '#666', marginBottom: 16 }}>请将以下收款链接提供给买家扫码支付：</p>
          <a href={payUrl} target="_blank" rel="noreferrer" style={{ fontSize: 16, wordBreak: 'break-all', fontWeight: 'bold' }}>
            {payUrl}
          </a>
          <p style={{ marginTop: 24, fontSize: 12, color: '#999' }}>
            提示：金额由系统自动计算，买家无法修改支付金额。
          </p>
        </div>
      </Modal>
    </div>
  );
};
