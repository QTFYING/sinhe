import React, { useState, useRef } from 'react';
import { Table, Button, Card, Tag, message } from 'antd';
import { useQuery, useMutation } from '@tanstack/react-query';
import { httpClient } from '../../api/http-client';
import { formatAmount } from 'shared-utils';
import dayjs from 'dayjs';
import type { Order, PrintJob, PaginatedData, ApiResponse, PayStatus } from '../../types';
import { PAY_STATUS_MAP } from '../../types';

export const PrintCenter: React.FC = () => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data: ordersResp, isLoading } = useQuery({
    queryKey: ['print-orders-list', page, pageSize],
    queryFn: () => httpClient.get('/orders', { params: { page, pageSize } }) as Promise<ApiResponse<PaginatedData<Order>>>,
  });

  const ordersData = ordersResp?.data;

  const printMutation = useMutation({
    mutationFn: (orderIds: string[]) =>
      httpClient.post('/print/jobs', { orderIds }) as Promise<ApiResponse<{ printData: PrintJob[] }>>,
    onSuccess: (res) => {
      message.success('打印任务已生成');
      const printData = (res as any).data.printData as PrintJob[];
      renderPrint(printData);
    },
  });

  const renderPrint = (printData: PrintJob[]) => {
    const doc = iframeRef.current?.contentWindow?.document;
    if (!doc) return;

    doc.open();
    doc.write(`
      <html>
        <head>
          <title>发货单打印</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 0; margin: 0; color: #000; }
            .print-page { page-break-after: always; padding: 20px; }
            .print-page:last-child { page-break-after: auto; }
            .header { text-align: center; font-size: 22px; font-weight: bold; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            table, th, td { border: 1px solid #000; }
            th { padding: 6px 8px; text-align: left; background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; font-size: 13px; }
            td { padding: 6px 8px; text-align: left; font-size: 13px; }
            .footer { margin-top: 20px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 14px; border-top: 2px solid #000; padding-top: 10px; }
            .qr-section { text-align: center; margin-top: 16px; }
            .qr-section img { width: 120px; height: 120px; }
            @media print { @page { margin: 10mm; } body { background: white; } }
          </style>
        </head>
        <body>
          ${printData.map((job) => `
            <div class="print-page">
              <div class="header">产品经销出库清单</div>
              <div class="info-row">
                <span><strong>订单号：</strong>${job.erpOrderNo}</span>
                <span><strong>客户：</strong>${job.customerName}</span>
              </div>
              <div class="info-row">
                <span><strong>地址：</strong>${job.deliveryAddress || '-'}</span>
                <span><strong>送货人：</strong>${job.deliveryPersonName || '-'}</span>
              </div>
              <div class="info-row">
                <span><strong>打印时间：</strong>${dayjs().format('YYYY/MM/DD HH:mm')}</span>
              </div>
              <table>
                <thead><tr><th>商品名称</th><th>数量</th><th>单价</th><th>金额</th></tr></thead>
                <tbody>
                  ${job.items.length > 0
                    ? job.items.map((item) => `<tr><td>${item.productName}</td><td>${item.quantity}</td><td>${item.unitPrice}</td><td>${item.amount}</td></tr>`).join('')
                    : '<tr><td colspan="4" style="text-align:center;">无商品明细</td></tr>'}
                </tbody>
              </table>
              <div class="footer">
                <span>签收：___________________</span>
                <div style="text-align:right;">
                  <div>订单总额：¥${job.totalAmount}</div>
                  ${job.discountAmount && job.discountAmount !== '0.00' ? `<div style="color:#666;">折让：-¥${job.discountAmount}</div>` : ''}
                </div>
              </div>
              ${job.qrCodeUrl ? `
                <div class="qr-section">
                  <p style="font-size:12px;color:#666;">扫码支付</p>
                  <img src="${job.qrCodeUrl}" alt="收款二维码" />
                </div>
              ` : ''}
            </div>
          `).join('')}
        </body>
      </html>
    `);
    doc.close();

    // 使用 iframe onload 确保内容渲染完成
    const iframe = iframeRef.current!;
    const triggerPrint = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    };
    if (iframe.contentDocument?.readyState === 'complete') {
      setTimeout(triggerPrint, 200);
    } else {
      iframe.onload = triggerPrint;
    }
  };

  const columns = [
    { title: 'ERP订单号', dataIndex: 'erpOrderNo' },
    { title: '客户名称', dataIndex: 'customerName' },
    { title: '订单金额', dataIndex: 'totalAmount', render: (val: string) => `¥${formatAmount(val)}` },
    { title: '支付状态', dataIndex: 'payStatus', render: (val: PayStatus) => <Tag>{PAY_STATUS_MAP[val] || val}</Tag> },
    { title: '配送状态', dataIndex: 'deliveryStatus' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>打印中心</h2>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            disabled={selectedRowKeys.length === 0}
            loading={printMutation.isPending}
            onClick={() => printMutation.mutate(selectedRowKeys as string[])}
          >
            打印所选订单 ({selectedRowKeys.length})
          </Button>
        </div>
        <Table
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
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
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
        />
        <iframe ref={iframeRef} style={{ width: 0, height: 0, border: 'none', position: 'absolute', pointerEvents: 'none' }} title="print-frame" />
      </Card>
    </div>
  );
};
