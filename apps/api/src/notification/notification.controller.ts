import { Controller, Get, Patch, Post, Param, Query, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { UserRoleEnum } from '@prisma/client';

@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('unread-count')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_FINANCE)
  async getUnreadCount(@CurrentUser() currentUser: JwtPayload) {
    return this.notificationService.getUnreadCount(currentUser);
  }

  @Get()
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_FINANCE)
  async getNotifications(
    @CurrentUser() currentUser: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('isRead') isRead?: string,
  ) {
    return this.notificationService.getNotifications(
      currentUser,
      page ? parseInt(page, 10) : 1,
      pageSize ? Math.min(parseInt(pageSize, 10), 100) : 20,
      isRead !== undefined ? isRead === 'true' : undefined,
    );
  }

  @Patch(':id/read')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_FINANCE)
  async markRead(@Param('id') id: string, @CurrentUser() currentUser: JwtPayload) {
    return this.notificationService.markAsRead(id, currentUser);
  }

  @Post('read-all')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_FINANCE)
  async markAllRead(@CurrentUser() currentUser: JwtPayload) {
    return this.notificationService.markAllAsRead(currentUser);
  }
}
