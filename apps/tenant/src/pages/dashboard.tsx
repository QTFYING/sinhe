import React from 'react';
import { Card, Row, Col, Statistic, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { httpClient } from '../api/http-client';
import { formatAmount } from 'shared-utils';
import type { ApiResponse, ReportSummary } from '../types';

export const Dashboard: React.FC = () => {
  const today = dayjs().format('YYYY-MM-DD');

  const { data: summaryResp, isLoading } = useQuery({
    queryKey: ['dashboard-summary', today],
    queryFn: () => httpClient.get('/report/summary', {
      params: { startDate: today, endDate: today },
    }) as Promise<ApiResponse<ReportSummary>>,
  });

  const summary = summaryResp?.data;

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>今日概览</h2>
      {isLoading ? <Spin size="large" /> : (
        <Row gutter={[16, 16]}>
          <Col span={6}>
            <Card hoverable>
              <Statistic title="应收总额" value={formatAmount(summary?.totalOrderAmount || '0')} prefix="¥" valueStyle={{ color: '#1677ff', fontWeight: 'bold' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card hoverable>
              <Statistic title="实收总额" value={formatAmount(summary?.totalPaidAmount || '0')} prefix="¥" valueStyle={{ color: '#3f8600', fontWeight: 'bold' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card hoverable>
              <Statistic title="折让总额" value={formatAmount(summary?.totalDiscountAmount || '0')} prefix="¥" valueStyle={{ color: '#cf1322', fontWeight: 'bold' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card hoverable>
              <Statistic title="回款率" value={summary?.collectionRate || '0'} suffix="%" valueStyle={{ color: '#3f8600', fontWeight: 'bold' }} />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic title="已收款订单" value={summary?.paidOrderCount || 0} suffix="笔" />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic title="未收款订单" value={summary?.unpaidOrderCount || 0} suffix="笔" valueStyle={{ color: '#faad14' }} />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic title="未收金额" value={formatAmount(summary?.unpaidAmount || '0')} prefix="¥" valueStyle={{ color: '#faad14' }} />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};
