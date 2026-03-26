import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { PrintService } from './print.service';
import { CreatePrintJobDto } from './dto/create-print-job.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { UserRoleEnum } from '@prisma/client';

@Controller('print')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PrintController {
  constructor(private readonly printService: PrintService) {}

  @Post('jobs')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async createPrintJob(
    @Body() dto: CreatePrintJobDto,
    @CurrentUser() currentUser: JwtPayload
  ) {
    return this.printService.createPrintJob(dto, currentUser);
  }
}
