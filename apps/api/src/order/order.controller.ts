import { Controller, Param, Patch, Body, UseGuards, Get, Query } from '@nestjs/common';
import { OrderService } from './order.service';
import { AdjustPriceDto } from './dto/adjust-price.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { UserRoleEnum } from '@prisma/client';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR, UserRoleEnum.TENANT_FINANCE, UserRoleEnum.TENANT_VIEWER)
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('payStatus') payStatus?: string,
    @Query('deliveryStatus') deliveryStatus?: string,
    @Query('keyword') keyword?: string,
    @Query('templateId') templateId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.orderService.findAll(
      currentUser,
      page ? parseInt(page, 10) : 1,
      pageSize ? Math.min(parseInt(pageSize, 10), 100) : 20,
      { payStatus, deliveryStatus, keyword, templateId, startDate, endDate },
    );
  }

  @Get(':id')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR, UserRoleEnum.TENANT_FINANCE, UserRoleEnum.TENANT_VIEWER)
  async getOrder(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload
  ) {
    return this.orderService.getOrder(id, currentUser);
  }

  @Patch(':id/discount')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async adjustPrice(
    @Param('id') id: string,
    @Body() adjustPriceDto: AdjustPriceDto,
    @CurrentUser() currentUser: JwtPayload
  ) {
    return this.orderService.adjustPrice(id, adjustPriceDto, currentUser);
  }
}
