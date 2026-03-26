import React, { useState } from 'react';
import { Table, Button, Tag, Modal, Form, Input, Select, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpClient } from '../../api/http-client';
import type { Employee, PaginatedData, ApiResponse, UserRole } from '../../types';

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'TENANT_OPERATOR', label: '操作员' },
  { value: 'TENANT_FINANCE', label: '财务' },
  { value: 'TENANT_VIEWER', label: '只读' },
];

const ROLE_LABEL: Record<string, string> = {
  TENANT_OWNER: '管理员',
  TENANT_OPERATOR: '操作员',
  TENANT_FINANCE: '财务',
  TENANT_VIEWER: '只读',
};

export const EmployeeManager: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // 员工列表 — GET /tenant/users
  const { data: empResp, isLoading } = useQuery({
    queryKey: ['employee-list', page],
    queryFn: () => httpClient.get('/tenant/users', { params: { page, pageSize: 20 } }) as Promise<ApiResponse<PaginatedData<Employee>>>,
  });

  const empData = empResp?.data;

  // 创建员工 — POST /tenant/users
  const createMutation = useMutation({
    mutationFn: (values: { username: string; password: string; realName: string; role: string }) =>
      httpClient.post('/tenant/users', values),
    onSuccess: () => {
      message.success('员工创建成功');
      queryClient.invalidateQueries({ queryKey: ['employee-list'] });
      setCreateModalOpen(false);
      createForm.resetFields();
    },
  });

  // 更新员工 — PATCH /tenant/users/:id
  const editMutation = useMutation({
    mutationFn: (values: { realName?: string; role?: string; password?: string }) =>
      httpClient.patch(`/tenant/users/${editingEmployee!.id}`, values),
    onSuccess: () => {
      message.success('已更新');
      queryClient.invalidateQueries({ queryKey: ['employee-list'] });
      setEditModalOpen(false);
      editForm.resetFields();
    },
  });

  // 冻结/恢复 — POST /tenant/users/:id/freeze | /unfreeze
  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, freeze }: { id: string; freeze: boolean }) =>
      httpClient.post(`/tenant/users/${id}/${freeze ? 'freeze' : 'unfreeze'}`),
    onSuccess: () => {
      message.success('状态已更新');
      queryClient.invalidateQueries({ queryKey: ['employee-list'] });
    },
  });

  const columns = [
    { title: '用户名', dataIndex: 'username', width: 140 },
    { title: '姓名', dataIndex: 'realName', width: 120 },
    { title: '角色', dataIndex: 'role', width: 100, render: (v: string) => ROLE_LABEL[v] || v },
    { title: '状态', dataIndex: 'status', width: 80, render: (v: number) => v === 1 ? <Tag color="green">正常</Tag> : <Tag color="red">冻结</Tag> },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: Employee) => (
        <Space size="small">
          <Button size="small" onClick={() => {
            setEditingEmployee(record);
            editForm.setFieldsValue({ realName: record.realName, role: record.role });
            setEditModalOpen(true);
          }}>编辑</Button>
          {record.role !== 'TENANT_OWNER' && (
            <Button
              size="small"
              danger={record.status === 1}
              onClick={() => toggleStatusMutation.mutate({ id: record.id, freeze: record.status === 1 })}
              loading={toggleStatusMutation.isPending}
            >
              {record.status === 1 ? '冻结' : '恢复'}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>员工管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
          添加员工
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={empData?.list || []}
        rowKey="id"
        loading={isLoading}
        bordered
        size="middle"
        pagination={{
          current: page,
          pageSize: 20,
          total: empData?.total || 0,
          onChange: setPage,
        }}
      />

      {/* 创建员工 */}
      <Modal title="添加员工" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} footer={null}>
        <Form form={createForm} layout="vertical" onFinish={(val) => createMutation.mutate(val)}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input placeholder="登录用户名" />
          </Form.Item>
          <Form.Item name="password" label="初始密码" rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '至少6位' }]}>
            <Input.Password placeholder="初始登录密码" />
          </Form.Item>
          <Form.Item name="realName" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input placeholder="真实姓名" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select options={ROLE_OPTIONS} placeholder="选择角色" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={createMutation.isPending} block>
            确认创建
          </Button>
        </Form>
      </Modal>

      {/* 编辑员工 */}
      <Modal title="编辑员工" open={editModalOpen} onCancel={() => setEditModalOpen(false)} footer={null}>
        <Form form={editForm} layout="vertical" onFinish={(val) => editMutation.mutate(val)}>
          <Form.Item name="realName" label="姓名">
            <Input placeholder="真实姓名" />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select options={ROLE_OPTIONS} placeholder="选择角色" />
          </Form.Item>
          <Form.Item name="password" label="重置密码">
            <Input.Password placeholder="留空则不修改" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={editMutation.isPending} block>
            确认修改
          </Button>
        </Form>
      </Modal>
    </div>
  );
};
