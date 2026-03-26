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
      message.success('云端发货单生成完毕，正在强制接管系统物理打印驱动...');
      const printData = res.data; 
      
      const doc = iframeRef.current?.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <html>
            <head>
              <title>批量面单脱机冲印</title>
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
                   <div class="header">大宗发货单 (防伪凭证)</div>
                   <div class="row">
                     <span><strong>ERP 源单载体号:</strong> ${job.erpOrderNo}</span>
                     <span><strong>核销客户:</strong> ${job.customerName}</span>
                   </div>
                   <div class="row">
                     <span><strong>流水暗号:</strong> ${job.printBatchNo}</span>
                     <span><strong>印发原时刻:</strong> ${dayjs().format('YYYY/MM/DD HH:mm:ss')}</span>
                   </div>
                   <table>
                     <thead><tr><th>商品品规基准名称</th><th>清点数量</th><th>财务认定金额</th></tr></thead>
                     <tbody>
                        ${ job.items && job.items.length > 0 ? job.items.map((item: any) => `
                          <tr><td>${item.productName}</td><td>${item.quantity}</td><td>${item.amount}</td></tr>
                        `).join('') : `<tr><td colspan="3" style="text-align:center;">（裸单模型，无明细附载）</td></tr>` }
                     </tbody>
                   </table>
                   <div class="footer">
                      <span>盖印处：___________________</span>
                      <span>法定位合计：¥${job.totalAmount}</span>
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
    { title: 'ERP源单号', dataIndex: 'erpOrderNo' },
    { title: '大客称谓', dataIndex: 'customerName' },
    { title: '锚定总款', dataIndex: 'totalAmount' },
    { title: '流水分支', dataIndex: 'payStatus', render: (val: string) => <span style={{ fontWeight: 'bold' }}>{val}</span> },
  ];

  return (
    <Card title="云端发单中心 (排队执行)" extra={<span style={{color:'#666', fontSize:12}}>调用浏览器自身内核排程渲染</span>}>
       <div style={{ marginBottom: 16 }}>
          <Button 
            type="primary" 
            size="large"
            disabled={selectedRowKeys.length === 0}
            loading={printMutation.isPending}
            onClick={() => printMutation.mutate(selectedRowKeys as string[])}
          >
            调度 {selectedRowKeys.length} 份数据下探底层打印机
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
       {/* 无感知物理打印逃逸窗层 */}
       <iframe ref={iframeRef} style={{ width: 0, height: 0, border: 'none', position: 'absolute', pointerEvents: 'none' }} title="hidden-print-frame" />
    </Card>
  );
};
