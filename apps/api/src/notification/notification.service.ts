import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/decorators/current-user.decorator';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  async getUnreadCount(currentUser: JwtPayload) {
    if (!currentUser.tenantId) throw new BadRequestException('Not in tenant scope');

    const unreadCount = await this.prisma.notification.count({
      where: {
        tenantId: currentUser.tenantId,
        recipientId: currentUser.userId,
        isRead: false,
      },
    });

    return { unreadCount };
  }

  async getNotifications(currentUser: JwtPayload, page = 1, pageSize = 20, isRead?: boolean) {
    if (!currentUser.tenantId) throw new BadRequestException('Not in tenant scope');

    const where: any = {
      tenantId: currentUser.tenantId,
      recipientId: currentUser.userId,
    };
    if (isRead !== undefined) where.isRead = isRead;

    const skip = (page - 1) * pageSize;
    const [list, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { list, total, page, pageSize };
  }

  async markAsRead(id: string, currentUser: JwtPayload) {
    const now = new Date();
    await this.prisma.notification.updateMany({
      where: { id, recipientId: currentUser.userId },
      data: { isRead: true, readAt: now },
    });

    return { id, isRead: true, readAt: now };
  }

  async markAllAsRead(currentUser: JwtPayload) {
    if (!currentUser.tenantId) throw new BadRequestException('Not in tenant scope');

    const result = await this.prisma.notification.updateMany({
      where: {
        tenantId: currentUser.tenantId,
        recipientId: currentUser.userId,
        isRead: false,
      },
      data: { isRead: true, readAt: new Date() },
    });

    return { updatedCount: result.count };
  }
}
