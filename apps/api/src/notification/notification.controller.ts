import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { TenantNotificationRecordItem } from '@shou/types/contracts';
import type { PaginatedResponse } from '@shou/types/common';
import { UserRoleEnum } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ListNotificationsQueryDto } from './dto/list-notifications.query.dto';
import { NotificationService } from './notification.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @ApiOperation({ summary: '获取平台公告列表' })
  @Get()
  @Roles(
    UserRoleEnum.TENANT_OWNER,
    UserRoleEnum.TENANT_OPERATOR,
    UserRoleEnum.TENANT_FINANCE,
    UserRoleEnum.TENANT_VIEWER,
  )
  async getNotifications(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<PaginatedResponse<TenantNotificationRecordItem>> {
    return this.notificationService.getNotifications(currentUser, query.page, query.pageSize);
  }

  @ApiOperation({ summary: '标记公告已读' })
  @Post(':id/read-records')
  @Roles(
    UserRoleEnum.TENANT_OWNER,
    UserRoleEnum.TENANT_OPERATOR,
    UserRoleEnum.TENANT_FINANCE,
    UserRoleEnum.TENANT_VIEWER,
  )
  async markAsRead(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) noticeId: string,
  ): Promise<null> {
    return this.notificationService.markAsRead(currentUser, noticeId);
  }
}
