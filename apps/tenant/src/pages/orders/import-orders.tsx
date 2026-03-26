import React, { useState } from 'react';
import { Upload, Button, message, Table, Card } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { useMutation } from '@tanstack/react-query';
import { httpClient } from '../../api/http-client';

const { Dragger } = Upload;

export const ImportOrders: React.FC = () => {
  const [parsedData, setParsedData] = useState<any[]>([]);

  // 【前端红线】：使用 TanStack Query 的 Mutation 管理异步状态，禁止手写 isLoading state
  const mutation = useMutation({
    mutationFn: (data: any[]) => {
      // 提交到我们在后端写的 ImportModule
      return httpClient.post('/import/orders', { orders: data, templateId: 'dummy' });
    },
    onSuccess: (res: any) => {
      message.success(`成功导入 ${res.data.successCount} 条订单`);
      setParsedData([]);
    },
    onError: () => {
      // 错误弹窗已交由底层 Axios 拦截器统管接管
    }
  });

  // 【前端红线】：纯前端浏览器解析 Excel，坚决不上传源文件 .xlsx 到服务端
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        const mappedOrders = jsonData.map((row: any) => ({
          erpOrderNo: String(row['ERP订单号'] || Date.now()),
          customerName: row['客户名称'] || '未知客户',
          totalAmount: String(row['订单金额'] || '0.00'),
          items: [
             {
                productName: row['商品名称'] || '未知商品',
                quantity: Number(row['数量'] || 1),
                unitPrice: String(row['单价'] || '0.00'),
                amount: String(row['订单金额'] || '0.00')
             }
          ]
        }));

        setParsedData(mappedOrders);
        message.success('本地解析 Excel 成功');
      } catch (err) {
        message.error('本地解析失败');
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // 返回 false 阻止 antd 默认上传行为
  };

  const columns = [
    { title: 'ERP订单号', dataIndex: 'erpOrderNo', key: 'erpOrderNo' },
    { title: '客户名称', dataIndex: 'customerName', key: 'customerName' },
    { title: '总金额', dataIndex: 'totalAmount', key: 'totalAmount' },
  ];

  return (
    <Card title="导入发货单 (纯浏览器端解析，极致安全)">
      <Dragger
        accept=".xlsx,.xls"
        beforeUpload={handleFileUpload}
        showUploadList={false}
      >
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <p className="ant-upload-text">点击或拖拽 Excel 文件到这里</p>
        <p className="ant-upload-hint">强制遵循红线：文件不会上传到服务器，所有解析在您的浏览器本地内存中完成。</p>
      </Dragger>

      {parsedData.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Table 
             dataSource={parsedData} 
             columns={columns} 
             rowKey="erpOrderNo" 
             pagination={{ pageSize: 5 }} 
          />
          <Button 
            type="primary" 
            style={{ marginTop: 16 }} 
            onClick={() => mutation.mutate(parsedData)}
            loading={mutation.isPending}
          >
            确认无误，提交到服务器
          </Button>
        </div>
      )}
    </Card>
  );
};
