import React from 'react';
import { Card, Row, Col, Statistic, Spin } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { httpClient } from '../api/http-client';
import { formatAmount } from 'shared-utils';

export const Dashboard: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['report-daily-summary'],
    queryFn: () => {
      const today = dayjs().format('YYYY-MM-DD');
      return httpClient.get('/report/daily-summary', {
        params: { startDate: `${today}T00:00:00.000Z`, endDate: `${today}T23:59:59.999Z` }
      });
    }
  });

  return (
    <div>
      <h2 style={{ marginBottom: 24, color: '#333' }}>今日核心数据沙盘</h2>
      {isLoading ? <Spin size="large" /> : (
        <Row gutter={16}>
          <Col span={8}>
            <Card hoverable>
              <Statistic title="总应收资产池 (元)" value={formatAmount(data?.data?.totalAmount || '0')} valueStyle={{ color: '#1677ff', fontWeight: 'bold' }} />
            </Card>
          </Col>
          <Col span={8}>
            <Card hoverable>
              <Statistic title="扫码系统实收 (元)" value={formatAmount(data?.data?.paidAmount || '0')} valueStyle={{ color: '#3f8600', fontWeight: 'bold' }} />
            </Card>
          </Col>
          <Col span={8}>
            <Card hoverable>
              <Statistic title="授权改价折损 (元)" value={formatAmount(data?.data?.discountAmount || '0')} valueStyle={{ color: '#cf1322', fontWeight: 'bold' }} />
            </Card>
          </Col>
        </Row>
      )}
    </div>
  );
};
