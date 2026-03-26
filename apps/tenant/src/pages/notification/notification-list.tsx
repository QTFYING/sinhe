import React, { useState } from 'react';
import { List, Button, Tag, Card, Space, message, Badge } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { httpClient } from '../../api/http-client';
import type { Notification as NotifType, PaginatedData, ApiResponse } from '../../types';

export const NotificationList: React.FC = () => {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  // 消息列表 — GET /notifications
  const { data: notifResp, isLoading } = useQuery({
    queryKey: ['notifications', page],
    queryFn: () => httpClient.get('/notifications', { params: { page, pageSize: 20 } }) as Promise<ApiResponse<PaginatedData<NotifType>>>,
  });

  const notifData = notifResp?.data;

  // 标记单条已读 — PATCH /notifications/:id/read
  const markReadMutation = useMutation({
    mutationFn: (id: string) => httpClient.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  // 全部已读 — POST /notifications/read-all
  const markAllReadMutation = useMutation({
    mutationFn: () => httpClient.post('/notifications/read-all'),
    onSuccess: (res) => {
      const data = (res as any).data;
      message.success(`已标记 ${data?.updatedCount || 0} 条为已读`);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] });
    },
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>站内信</h2>
        <Button onClick={() => markAllReadMutation.mutate()} loading={markAllReadMutation.isPending}>
          全部已读
        </Button>
      </div>

      <Card>
        <List
          loading={isLoading}
          dataSource={notifData?.list || []}
          pagination={{
            current: page,
            pageSize: 20,
            total: notifData?.total || 0,
            onChange: setPage,
          }}
          renderItem={(item: NotifType) => (
            <List.Item
              actions={
                !item.isRead
                  ? [<Button size="small" type="link" onClick={() => markReadMutation.mutate(item.id)}>标为已读</Button>]
                  : []
              }
            >
              <List.Item.Meta
                title={
                  <Space>
                    {!item.isRead && <Badge status="processing" />}
                    <span style={{ fontWeight: item.isRead ? 'normal' : 'bold' }}>{item.title}</span>
                    <Tag>{item.type}</Tag>
                  </Space>
                }
                description={
                  <div>
                    <p style={{ margin: '4px 0', color: '#666' }}>{item.content}</p>
                    <span style={{ fontSize: 12, color: '#999' }}>{dayjs(item.createdAt).format('YYYY-MM-DD HH:mm')}</span>
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};
