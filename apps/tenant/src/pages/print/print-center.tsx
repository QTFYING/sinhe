import React, { useState, useRef } from 'react';
import { Table, Button, Card, message } from 'antd';
import { useQuery, useMutation } from '@tanstack/react-query';
import { httpClient } from '../../api/http-client';
import dayjs from 'dayjs';

export const PrintCenter: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { data: ordersData, isLoading } = useQuery({
    queryKey: ['print-orders-list'],
    queryFn: () => httpClient.get('/order')
  });

  const printMutation = useMutation({
    mutationFn: (orderIds: string[]) => httpClient.post('/print/jobs', { orderIds }),
    onSuccess: (res: any) => {
      message.success('企业发货工单生成完毕，系统打印驱动已响应接入');
      const printData = res.data; 
      
      const doc = iframeRef.current?.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <html>
            <head>
              <title>大宗企业面单打印流水</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 0; margin: 0; color: #000; }
                .print-page { page-break-after: always; padding: 20px; }
                .print-page:last-child { page-break-after: auto; }
                .header { text-align: center; font-size: 24px; font-weight: bold; margin-bottom: 24px; letter-spacing: 2px; border-bottom: 2px solid #000; padding-bottom: 12px; }
                .row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
                table { width: 100%; border-collapse: collapse; margin-top: 24px; }
                table, th, td { border: 1px solid #000; }
                th { padding: 8px; text-align: left; background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; }
                td { padding: 8px; text-align: left; }
                .footer { margin-top: 24px; display: flex; justify-content: space-between; font-weight: bold; font-size: 16px; border-top: 2px solid #000; padding-top: 12px; }
                @media print {
                  @page { margin: 10mm; }
                  body { background: white; }
                }
              </style>
            </head>
            <body>
              ${printData.map((job: any) => `
                <div class="print-page">
                   <div class="header">产品经销出库清单 (核销联)</div>
                   <div class="row">
                     <span><strong>官方订单编号:</strong> ${job.erpOrderNo}</span>
                     <span><strong>下沉订货单位:</strong> ${job.customerName}</span>
                   </div>
                   <div class="row">
                     <span><strong>流水作业代码:</strong> ${job.printBatchNo}</span>
                     <span><strong>作业列印时间:</strong> ${dayjs().format('YYYY/MM/DD HH:mm:ss')}</span>
                   </div>
                   <table>
                     <thead><tr><th>商品通用规则名目</th><th>作业数量</th><th>会计归集金额</th></tr></thead>
                     <tbody>
                        ${ job.items && job.items.length > 0 ? job.items.map((item: any) => `
                          <tr><td>${item.productName}</td><td>${item.quantity}</td><td>${item.amount}</td></tr>
                        `).join('') : `<tr><td colspan="3" style="text-align:center;">（无关联随货单详细）</td></tr>` }
                     </tbody>
                   </table>
                   <div class="footer">
                      <span>核签经办区：___________________</span>
                      <span>票单账面合计总额：¥${job.totalAmount}</span>
                   </div>
                </div>
              `).join('')}
            </body>
          </html>
        `);
        doc.close();

        setTimeout(() => {
          iframeRef.current?.contentWindow?.focus();
          iframeRef.current?.contentWindow?.print();
        }, 800);
      }
    }
  });

  const columns = [
    { title: '企业关联订单号', dataIndex: 'erpOrderNo' },
    { title: '商流订购方', dataIndex: 'customerName' },
    { title: '业务汇总账面', dataIndex: 'totalAmount' },
    { title: '资金结账状态', dataIndex: 'payStatus', render: (val: string) => <span style={{ fontWeight: 'bold' }}>{val}</span> },
  ];

  return (
    <Card title="综合打单发运室" extra={<span style={{color:'#666', fontSize:12}}>后台物理核心调度引擎</span>}>
       <div style={{ marginBottom: 16 }}>
          <Button 
            type="primary" 
            size="large"
            disabled={selectedRowKeys.length === 0}
            loading={printMutation.isPending}
            onClick={() => printMutation.mutate(selectedRowKeys as string[])}
          >
            请求授权分配打印所选的 {selectedRowKeys.length} 笔业务数据
          </Button>
       </div>
       <Table 
         rowSelection={{
           selectedRowKeys,
           onChange: setSelectedRowKeys,
         }}
         columns={columns} 
         dataSource={ordersData?.data || []} 
         rowKey="id" 
         loading={isLoading} 
         bordered
       />
       {/* 隐形高权调用打印服务网关映射窗 */}
       <iframe ref={iframeRef} style={{ width: 0, height: 0, border: 'none', position: 'absolute', pointerEvents: 'none' }} title="hidden-print-frame" />
    </Card>
  );
};
