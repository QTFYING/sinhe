import React, { useState } from 'react';
import { Card, Row, Col, Statistic, Spin, DatePicker, Space, Table, Tabs, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { httpClient } from '../../api/http-client';
import { formatAmount } from 'shared-utils';
import type { ReportSummary, PaymentRecord, PaginatedData, ApiResponse } from '../../types';

const { RangePicker } = DatePicker;

export const FinancialReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('month'), dayjs().endOf('month'),
  ]);
  const [paymentPage, setPaymentPage] = useState(1);

  const startDate = dateRange[0]?.format('YYYY-MM-DD');
  const endDate = dateRange[1]?.format('YYYY-MM-DD');

  // 回款概览 — GET /report/summary
  const { data: summaryResp, isLoading: summaryLoading } = useQuery({
    queryKey: ['report-summary', startDate, endDate],
    queryFn: () => httpClient.get('/report/summary', { params: { startDate, endDate } }) as Promise<ApiResponse<ReportSummary>>,
    enabled: !!startDate && !!endDate,
  });

  const summary = summaryResp?.data;

  // 支付流水 — GET /report/payments
  const { data: paymentsResp, isLoading: paymentsLoading } = useQuery({
    queryKey: ['report-payments', startDate, endDate, paymentPage],
    queryFn: () => httpClient.get('/report/payments', {
      params: { startDate, endDate, page: paymentPage, pageSize: 20 },
    }) as Promise<ApiResponse<PaginatedData<PaymentRecord> & { totalAmount: string }>>,
    enabled: !!startDate && !!endDate,
  });

  const paymentsData = paymentsResp?.data;

  const paymentColumns = [
    { title: 'ERP订单号', dataIndex: 'erpOrderNo', width: 160 },
    { title: '客户名称', dataIndex: 'customerName', width: 130 },
    { title: '支付方式', dataIndex: 'paymentMethod', width: 120, render: (v: string) => v === 'ONLINE_PAYMENT' ? <Tag color="blue">线上支付</Tag> : <Tag color="orange">手工标记</Tag> },
    { title: '实收金额', dataIndex: 'actualAmount', width: 120, render: (v: string) => `¥${formatAmount(v)}` },
    { title: '渠道流水号', dataIndex: 'channelTradeNo', width: 180 },
    { title: '支付时间', dataIndex: 'paidTime', width: 180, render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss') },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>财务报表</h2>
        <Space>
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates && dates[0] && dates[1]) {
                setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs]);
              }
            }}
          />
        </Space>
      </div>

      <Tabs defaultActiveKey="summary" items={[
        {
          key: 'summary',
          label: '回款概览',
          children: summaryLoading ? (
            <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div>
          ) : (
            <>
              <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                <Col span={6}>
                  <Card bordered={false} style={{ borderTop: '3px solid #1677ff' }}>
                    <Statistic title="应收总额" value={formatAmount(summary?.totalOrderAmount || '0')} prefix="¥" valueStyle={{ color: '#1677ff', fontFamily: 'monospace' }} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card bordered={false} style={{ borderTop: '3px solid #3f8600' }}>
                    <Statistic title="实收总额" value={formatAmount(summary?.totalPaidAmount || '0')} prefix="¥" valueStyle={{ color: '#3f8600', fontFamily: 'monospace' }} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card bordered={false} style={{ borderTop: '3px solid #cf1322' }}>
                    <Statistic title="折让总额" value={formatAmount(summary?.totalDiscountAmount || '0')} prefix="¥" valueStyle={{ color: '#cf1322', fontFamily: 'monospace' }} />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card bordered={false} style={{ borderTop: '3px solid #faad14' }}>
                    <Statistic title="未收金额" value={formatAmount(summary?.unpaidAmount || '0')} prefix="¥" valueStyle={{ color: '#faad14', fontFamily: 'monospace' }} />
                  </Card>
                </Col>
              </Row>

              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Card bordered={false}>
                    <Statistic title="已收款订单" value={summary?.paidOrderCount || 0} suffix="笔" />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bordered={false}>
                    <Statistic title="未收款订单" value={summary?.unpaidOrderCount || 0} suffix="笔" />
                  </Card>
                </Col>
                <Col span={8}>
                  <Card bordered={false}>
                    <Statistic title="回款率" value={summary?.collectionRate || '0'} suffix="%" valueStyle={{ color: '#3f8600' }} />
                  </Card>
                </Col>
              </Row>

              {/* 按送货人统计 */}
              {summary?.byDeliveryPerson && summary.byDeliveryPerson.length > 0 && (
                <Card title="按送货人统计" style={{ marginTop: 16 }} size="small">
                  <Table
                    dataSource={summary.byDeliveryPerson}
                    rowKey="name"
                    size="small"
                    pagination={false}
                    columns={[
                      { title: '送货人', dataIndex: 'name' },
                      { title: '回款金额', dataIndex: 'paidAmount', render: (v: string) => `¥${formatAmount(v)}` },
                      { title: '订单数', dataIndex: 'orderCount' },
                    ]}
                  />
                </Card>
              )}
            </>
          ),
        },
        {
          key: 'payments',
          label: '支付流水',
          children: (
            <Table
              columns={paymentColumns}
              dataSource={paymentsData?.list || []}
              rowKey="id"
              loading={paymentsLoading}
              bordered
              size="middle"
              pagination={{
                current: paymentPage,
                pageSize: 20,
                total: paymentsData?.total || 0,
                onChange: (p) => setPaymentPage(p),
              }}
              footer={() => paymentsData?.totalAmount ? (
                <div style={{ textAlign: 'right', fontWeight: 'bold' }}>
                  流水合计：¥{formatAmount(paymentsData.totalAmount)}
                </div>
              ) : null}
            />
          ),
        },
      ]} />
    </div>
  );
};
