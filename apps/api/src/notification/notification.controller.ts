import { Controller, Get, Patch, Param, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';

@Controller('notification')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get('unread')
  async getUnread(@CurrentUser() currentUser: JwtPayload) {
    return this.notificationService.getMyUnreadNotifications(currentUser);
  }

  @Patch(':id/read')
  async markRead(@Param('id') id: string, @CurrentUser() currentUser: JwtPayload) {
    return this.notificationService.markAsRead(id, currentUser);
  }
}
