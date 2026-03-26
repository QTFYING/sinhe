import { Controller, Param, Patch, Body, UseGuards, Get } from '@nestjs/common';
import { OrderService } from './order.service';
import { AdjustPriceDto } from './dto/adjust-price.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { UserRoleEnum } from '@prisma/client';

@Controller('order')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR, UserRoleEnum.TENANT_FINANCE, UserRoleEnum.TENANT_VIEWER)
  async findAll(@CurrentUser() currentUser: JwtPayload) {
    return this.orderService.findAll(currentUser);
  }

  @Get(':id')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR, UserRoleEnum.TENANT_FINANCE, UserRoleEnum.TENANT_VIEWER)
  async getOrder(
    @Param('id') id: string,
    @CurrentUser() currentUser: JwtPayload
  ) {
    return this.orderService.getOrder(id, currentUser);
  }

  @Patch(':id/adjust-price')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async adjustPrice(
    @Param('id') id: string,
    @Body() adjustPriceDto: AdjustPriceDto,
    @CurrentUser() currentUser: JwtPayload
  ) {
    return this.orderService.adjustPrice(id, adjustPriceDto, currentUser);
  }
}
