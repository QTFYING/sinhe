import React, { useState } from 'react';
import { Upload, Button, message, Table, Card, Select, Space, Alert, Progress } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { useQuery, useMutation } from '@tanstack/react-query';
import { httpClient } from '../../api/http-client';
import type { ImportTemplate, ImportPreviewResult, ImportJobStatus, ApiResponse, PaginatedData } from '../../types';

const { Dragger } = Upload;

export const ImportOrders: React.FC = () => {
  const [parsedData, setParsedData] = useState<Record<string, unknown>[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [previewResult, setPreviewResult] = useState<ImportPreviewResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  // 获取模板列表
  const { data: templatesResp } = useQuery({
    queryKey: ['import-templates'],
    queryFn: () => httpClient.get('/import/templates') as Promise<ApiResponse<PaginatedData<ImportTemplate>>>,
  });
  const templates = templatesResp?.data?.list || [];
  const selectedTemplate = templates.find(t => t.id === selectedTemplateId);

  // 预检校验 — POST /import/preview
  const previewMutation = useMutation({
    mutationFn: (rows: Record<string, unknown>[]) =>
      httpClient.post('/import/preview', { templateId: selectedTemplateId, rows }) as Promise<ApiResponse<ImportPreviewResult>>,
    onSuccess: (res) => {
      const data = res.data;
      setPreviewResult(data);
      if (data.invalidRows > 0) {
        message.warning(`${data.invalidRows} 条数据校验不通过，请查看错误详情`);
      } else {
        message.success(`全部 ${data.validRows} 条数据校验通过`);
      }
    },
  });

  // 正式导入 — POST /orders/import
  const importMutation = useMutation({
    mutationFn: (rows: Record<string, unknown>[]) =>
      httpClient.post('/orders/import', { templateId: selectedTemplateId, orders: rows }) as Promise<ApiResponse<{ jobId: string; submittedCount: number }>>,
    onSuccess: (res) => {
      const data = res.data;
      setJobId(data.jobId);
      message.success(`已提交 ${data.submittedCount} 条，正在后台处理...`);
      pollJobStatus(data.jobId);
    },
  });

  // 轮询导入任务状态
  const [jobStatus, setJobStatus] = useState<ImportJobStatus | null>(null);

  const pollJobStatus = async (id: string) => {
    const poll = async () => {
      try {
        const res = await httpClient.get(`/orders/import/jobs/${id}`) as ApiResponse<ImportJobStatus>;
        const status = res.data;
        setJobStatus(status);
        if (status.status === 'PENDING' || status.status === 'PROCESSING') {
          setTimeout(poll, 2000);
        } else if (status.status === 'COMPLETED') {
          message.success(`导入完成：成功 ${status.successCount} 条，失败 ${status.failedCount} 条`);
        } else {
          message.error('导入任务失败');
        }
      } catch {
        // 轮询失败时静默
      }
    };
    poll();
  };

  // Excel 浏览器端解析
  const handleFileUpload = (file: File) => {
    if (!selectedTemplate) {
      message.warning('请先选择导入模板');
      return false;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

        if (jsonData.length === 0) {
          message.error('Excel 文件中无数据');
          return;
        }

        if (jsonData.length > 500) {
          message.error('单次导入不超过 500 条');
          return;
        }

        const { mappingRules, customFieldDefs = [] } = selectedTemplate;

        // 按模板映射规则转换数据
        const mappedOrders = jsonData.map((row, index) => {
          const mapped: Record<string, unknown> = {};

          // 标准字段映射
          for (const [excelCol, sysField] of Object.entries(mappingRules)) {
            mapped[sysField] = row[excelCol] != null ? String(row[excelCol]) : '';
          }

          // 自定义字段
          if (customFieldDefs.length > 0) {
            const customFields: Record<string, string> = {};
            for (const def of customFieldDefs) {
              customFields[def.fieldKey] = row[def.columnHeader] != null ? String(row[def.columnHeader]) : '';
            }
            mapped.customFields = customFields;
          }

          // 基础校验
          if (!mapped.erpOrderNo) {
            mapped._error = `第 ${index + 2} 行：ERP订单号为空`;
          }
          if (!mapped.totalAmount || isNaN(Number(mapped.totalAmount)) || Number(mapped.totalAmount) <= 0) {
            mapped._error = `第 ${index + 2} 行：金额不合法`;
          }

          return mapped;
        });

        const errors = mappedOrders.filter(r => r._error);
        if (errors.length > 0) {
          message.warning(`${errors.length} 条数据存在格式问题，请检查`);
        }

        const validData = mappedOrders.map(({ _error, ...rest }) => rest);
        setParsedData(validData);
        setPreviewResult(null);
        setJobId(null);
        setJobStatus(null);
        message.success(`已解析 ${validData.length} 条数据`);
      } catch {
        message.error('Excel 解析失败，请检查文件格式');
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  const previewColumns = [
    { title: 'ERP订单号', dataIndex: 'erpOrderNo', key: 'erpOrderNo' },
    { title: '客户名称', dataIndex: 'customerName', key: 'customerName' },
    { title: '订单金额', dataIndex: 'totalAmount', key: 'totalAmount' },
    { title: '送货人', dataIndex: 'deliveryPersonName', key: 'deliveryPersonName' },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>导入订单</h2>

      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <span style={{ marginRight: 8 }}>选择导入模板：</span>
            <Select
              placeholder="请选择模板"
              style={{ width: 300 }}
              value={selectedTemplateId}
              onChange={setSelectedTemplateId}
              allowClear
            >
              {templates.map(t => (
                <Select.Option key={t.id} value={t.id}>{t.templateName}</Select.Option>
              ))}
            </Select>
          </div>

          <Dragger
            accept=".xlsx,.xls"
            beforeUpload={handleFileUpload}
            showUploadList={false}
            disabled={!selectedTemplateId}
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">点击或拖拽 Excel 文件到此处</p>
            <p className="ant-upload-hint">文件在浏览器本地解析，不会上传到服务器</p>
          </Dragger>
        </Space>
      </Card>

      {parsedData.length > 0 && (
        <Card title={`解析结果 (${parsedData.length} 条)`} style={{ marginBottom: 16 }}>
          <Table
            dataSource={parsedData}
            columns={previewColumns}
            rowKey={(r) => String(r.erpOrderNo || Math.random())}
            pagination={{ pageSize: 10 }}
            size="small"
          />
          <Space style={{ marginTop: 16 }}>
            <Button
              onClick={() => previewMutation.mutate(parsedData)}
              loading={previewMutation.isPending}
            >
              预检校验
            </Button>
            <Button
              type="primary"
              onClick={() => importMutation.mutate(parsedData)}
              loading={importMutation.isPending}
              disabled={!previewResult || previewResult.invalidRows > 0}
            >
              确认导入
            </Button>
          </Space>
        </Card>
      )}

      {/* 预检结果 */}
      {previewResult && previewResult.errors.length > 0 && (
        <Alert
          type="warning"
          message={`${previewResult.invalidRows} 条数据未通过校验`}
          description={
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {previewResult.errors.map((e, i) => (
                <li key={i}>第 {e.row} 行：{e.reason}</li>
              ))}
            </ul>
          }
          style={{ marginBottom: 16 }}
          closable
        />
      )}

      {/* 导入进度 */}
      {jobId && jobStatus && (
        <Card title="导入进度" style={{ marginBottom: 16 }}>
          <Progress
            percent={jobStatus.status === 'COMPLETED' || jobStatus.status === 'FAILED' ? 100 : 50}
            status={jobStatus.status === 'FAILED' ? 'exception' : jobStatus.status === 'COMPLETED' ? 'success' : 'active'}
          />
          <p style={{ marginTop: 8 }}>
            状态：{jobStatus.status} | 提交：{jobStatus.submittedCount} 条
            {jobStatus.successCount != null && ` | 成功：${jobStatus.successCount} 条`}
            {jobStatus.failedCount != null && jobStatus.failedCount > 0 && ` | 失败：${jobStatus.failedCount} 条`}
          </p>
          {jobStatus.errors && jobStatus.errors.length > 0 && (
            <Alert
              type="error"
              message="部分订单导入失败"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {jobStatus.errors.map((e, i) => (
                    <li key={i}>{e.erpOrderNo}：{e.reason}</li>
                  ))}
                </ul>
              }
            />
          )}
        </Card>
      )}
    </div>
  );
};
