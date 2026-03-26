import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ImportOrdersDto } from './dto/import-orders.dto';
import { ImportService } from './import.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('import')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async importOrders(
    @Body() importOrdersDto: ImportOrdersDto,
    @CurrentUser() currentUser: JwtPayload
  ) {
    return this.importService.importOrders(importOrdersDto, currentUser);
  }
}
