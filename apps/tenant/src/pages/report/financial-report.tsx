import React, { useState } from 'react';
import { Card, Row, Col, Statistic, Spin, DatePicker, Space, Alert } from 'antd';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { httpClient } from '../../api/http-client';
import { formatAmount } from 'shared-utils';

const { RangePicker } = DatePicker;

export const FinancialReport: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs().endOf('month')]);

  const { data, isLoading } = useQuery({
    // Add dependence on stringified dates
    queryKey: ['financial-report', dateRange[0]?.toISOString(), dateRange[1]?.toISOString()],
    queryFn: () => {
      return httpClient.get('/report/daily-summary', {
        params: { 
          startDate: dateRange[0].toISOString(), 
          endDate: dateRange[1].toISOString() 
        }
      });
    },
    enabled: !!dateRange[0] && !!dateRange[1]
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: '#333' }}>财务报表大盘</h2>
        <Space>
           <RangePicker 
             value={dateRange as any} 
             onChange={(dates) => {
               if (dates && dates[0] && dates[1]) {
                 setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs]);
               }
             }} 
           />
        </Space>
      </div>

      <Alert 
        message="财务合规数据说明" 
        description="本报表中呈现的每一笔实收流水与企业商折金额，均已与系统底层带有防篡改基因的 OrderLifecycleLog 审计快照进行对齐，符合财务红线审计标准。" 
        type="info" 
        showIcon 
        style={{ marginBottom: 24 }}
      />

      {isLoading ? <div style={{ textAlign: 'center', padding: 50 }}><Spin size="large" /></div> : (
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card hoverable bordered={false} style={{ borderTop: '4px solid #1677ff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Statistic title="所选周期：应收总计 (元)" value={formatAmount(data?.data?.totalAmount || '0')} valueStyle={{ fontSize: 32, color: '#1677ff', fontWeight: 'bold', fontFamily: 'Courier New, Courier, monospace' }} />
            </Card>
          </Col>
          <Col span={8}>
            <Card hoverable bordered={false} style={{ borderTop: '4px solid #3f8600', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Statistic title="所选周期：入账净得 (元)" value={formatAmount(data?.data?.paidAmount || '0')} valueStyle={{ fontSize: 32, color: '#3f8600', fontWeight: 'bold', fontFamily: 'Courier New, Courier, monospace' }} />
            </Card>
          </Col>
          <Col span={8}>
            <Card hoverable bordered={false} style={{ borderTop: '4px solid #cf1322', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <Statistic title="所选周期：审计减免 (元)" value={formatAmount(data?.data?.discountAmount || '0')} valueStyle={{ fontSize: 32, color: '#cf1322', fontWeight: 'bold', fontFamily: 'Courier New, Courier, monospace' }} />
            </Card>
          </Col>
        </Row>
      )}

      <Card title="业务资金流向趋势视界" style={{ marginTop: 24, minHeight: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
         <div style={{ textAlign: 'center', color: '#999' }}>
           <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
           <p style={{ fontSize: 16 }}>高阶可视报表组件 (Charts) 即将合入</p>
           <p style={{ fontSize: 13 }}>敬请期待商业拓展期 V2.0 搭载的动态折线BI引擎...</p>
         </div>
      </Card>
    </div>
  );
};
