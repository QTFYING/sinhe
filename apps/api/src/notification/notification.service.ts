import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/decorators/current-user.decorator';

@Injectable()
export class NotificationService {
  constructor(private prisma: PrismaService) {}

  async getMyUnreadNotifications(currentUser: JwtPayload) {
    if (!currentUser.tenantId) throw new BadRequestException('Not in tenant scope');

    return this.prisma.notification.findMany({
      where: {
        tenantId: currentUser.tenantId,
        recipientId: currentUser.userId,
        isRead: false
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async markAsRead(id: string, currentUser: JwtPayload) {
    return this.prisma.notification.updateMany({
      where: { id, recipientId: currentUser.userId },
      data: { isRead: true, readAt: new Date() }
    });
  }
}
