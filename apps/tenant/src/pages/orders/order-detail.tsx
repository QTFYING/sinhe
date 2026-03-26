import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Descriptions, Table, Tag, Timeline, Button, Spin, Space } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { httpClient } from '../../api/http-client';
import { formatAmount } from 'shared-utils';
import dayjs from 'dayjs';
import type { Order, ApiResponse, PayStatus, DeliveryStatus } from '../../types';
import { PAY_STATUS_MAP, DELIVERY_STATUS_MAP } from '../../types';

const EVENT_LABEL: Record<string, string> = {
  ORDER_CREATED: '订单创建',
  ORDER_PRINTED: '已打印',
  PAYMENT_INITIATED: '发起支付',
  PAYMENT_SUCCESS_WEBHOOK: '支付成功(回调)',
  PAYMENT_SUCCESS_POLLING: '支付成功(轮询)',
  PAYMENT_MANUAL_MARKUP: '手工标记已支付',
  PRICE_ADJUSTED: '改价',
  DELIVERY_STATUS_UPDATED: '配送状态更新',
  ORDER_REFUNDED: '已退款',
  QR_CODE_EXPIRED: '二维码过期',
};

export const OrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: orderResp, isLoading } = useQuery({
    queryKey: ['order-detail', id],
    queryFn: () => httpClient.get(`/orders/${id}`) as Promise<ApiResponse<Order>>,
    enabled: !!id,
  });

  const order = orderResp?.data;

  if (isLoading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>;
  if (!order) return <div style={{ padding: 24, color: '#999' }}>订单不存在</div>;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/orders')}>返回列表</Button>
        <h2 style={{ margin: 0 }}>订单详情</h2>
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Descriptions column={3} bordered size="small">
          <Descriptions.Item label="ERP订单号">{order.erpOrderNo}</Descriptions.Item>
          <Descriptions.Item label="客户名称">{order.customerName}</Descriptions.Item>
          <Descriptions.Item label="客户电话">{order.customerPhone || '-'}</Descriptions.Item>
          <Descriptions.Item label="送货地址" span={2}>{order.deliveryAddress || '-'}</Descriptions.Item>
          <Descriptions.Item label="送货人">{order.deliveryPersonName || '-'}</Descriptions.Item>
          <Descriptions.Item label="订单金额"><strong>¥{formatAmount(order.totalAmount)}</strong></Descriptions.Item>
          <Descriptions.Item label="折让金额"><span style={{ color: '#cf1322' }}>-¥{formatAmount(order.discountAmount)}</span></Descriptions.Item>
          <Descriptions.Item label="实收金额"><strong style={{ color: '#3f8600' }}>¥{formatAmount(order.paidAmount)}</strong></Descriptions.Item>
          <Descriptions.Item label="支付状态"><Tag>{PAY_STATUS_MAP[order.payStatus as PayStatus] || order.payStatus}</Tag></Descriptions.Item>
          <Descriptions.Item label="配送状态"><Tag>{DELIVERY_STATUS_MAP[order.deliveryStatus as DeliveryStatus] || order.deliveryStatus}</Tag></Descriptions.Item>
          <Descriptions.Item label="创建时间">{dayjs(order.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
          {order.creditExpireAt && (
            <Descriptions.Item label="账期截止">{dayjs(order.creditExpireAt).format('YYYY-MM-DD')}</Descriptions.Item>
          )}
        </Descriptions>
      </Card>

      {/* 自定义字段 */}
      {order.customFields && Object.keys(order.customFields).length > 0 && (
        <Card title="自定义字段" size="small" style={{ marginBottom: 16 }}>
          <Descriptions column={3} size="small">
            {Object.entries(order.customFields).map(([key, val]) => (
              <Descriptions.Item key={key} label={key}>{val}</Descriptions.Item>
            ))}
          </Descriptions>
        </Card>
      )}

      {/* 商品明细 */}
      <Card title="商品明细" size="small" style={{ marginBottom: 16 }}>
        <Table
          dataSource={order.items || []}
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: '商品名称', dataIndex: 'productName' },
            { title: '数量', dataIndex: 'quantity', width: 80 },
            { title: '单价', dataIndex: 'unitPrice', width: 120, render: (v: string) => `¥${formatAmount(v)}` },
            { title: '金额', dataIndex: 'amount', width: 120, render: (v: string) => `¥${formatAmount(v)}` },
          ]}
        />
      </Card>

      {/* 支付记录 */}
      {order.payments && order.payments.length > 0 && (
        <Card title="支付记录" size="small" style={{ marginBottom: 16 }}>
          <Table
            dataSource={order.payments}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              { title: '支付方式', dataIndex: 'paymentMethod', render: (v: string) => v === 'ONLINE_PAYMENT' ? '线上支付' : '手工标记' },
              { title: '金额', dataIndex: 'actualAmount', render: (v: string) => `¥${formatAmount(v)}` },
              { title: '渠道流水号', dataIndex: 'channelTradeNo' },
              { title: '状态', dataIndex: 'status' },
              { title: '时间', dataIndex: 'paidTime', render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss') },
            ]}
          />
        </Card>
      )}

      {/* 操作日志 */}
      {order.logs && order.logs.length > 0 && (
        <Card title="操作日志" size="small">
          <Timeline
            items={order.logs.map((log) => ({
              children: (
                <div>
                  <strong>{EVENT_LABEL[log.event] || log.event}</strong>
                  <span style={{ color: '#999', marginLeft: 8 }}>{dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss')}</span>
                  {log.snapshot && (
                    <pre style={{ fontSize: 12, background: '#f5f5f5', padding: 8, borderRadius: 4, marginTop: 4 }}>
                      {JSON.stringify(log.snapshot, null, 2)}
                    </pre>
                  )}
                </div>
              ),
            }))}
          />
        </Card>
      )}
    </div>
  );
};
