import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ManualPaidDto } from './dto/manual-paid.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { UserRoleEnum } from '@prisma/client';

// C端收款页路由 — 无需 JWT，凭 qrCodeToken 访问
@Controller('pay')
export class PayController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get(':token')
  async getOrderByToken(@Param('token') token: string) {
    return this.paymentService.getOrderByToken(token);
  }

  @Post(':token/initiate')
  async initiatePayment(@Param('token') token: string) {
    return this.paymentService.initiatePayment(token);
  }

  @Get(':token/status')
  async getPaymentStatus(@Param('token') token: string) {
    return this.paymentService.getPaymentStatus(token);
  }
}

// Webhook 路由
@Controller('payment')
export class PaymentWebhookController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('webhook/lakala')
  async lakalaWebhook(@Body() payload: any) {
    return this.paymentService.handleWebhook(payload);
  }
}

// B端手工标记路由 — 挂在 orders 下
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ManualPaidController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post(':id/manual-paid')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async manualMarkup(
    @Param('id') id: string,
    @Body() dto: ManualPaidDto,
    @CurrentUser() currentUser: JwtPayload
  ) {
    return this.paymentService.manualMarkup(id, dto.actualAmount, dto.markReason, dto.paidTime, currentUser);
  }
}
