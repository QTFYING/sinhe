import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportOrdersDto } from './dto/import-orders.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { UserRoleEnum } from '@prisma/client';

@Controller('import')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('orders')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async importOrders(
    @Body() importOrdersDto: ImportOrdersDto,
    @CurrentUser() currentUser: JwtPayload
  ) {
    return this.importService.importOrders(importOrdersDto, currentUser);
  }
}
