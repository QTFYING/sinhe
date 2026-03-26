import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { UserRoleEnum } from '@prisma/client';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('initiate/:qrToken')
  async initiatePayment(@Param('qrToken') qrToken: string) {
    return this.paymentService.initiatePayment(qrToken);
  }

  @Post('webhook/lakala')
  async lakalaWebhook(@Body() payload: any) {
    return this.paymentService.handleWebhook(payload);
  }

  @Post('manual-mark/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR, UserRoleEnum.TENANT_FINANCE)
  async manualMarkup(
    @Param('orderId') orderId: string,
    @Body('remark') remark: string,
    @CurrentUser() currentUser: JwtPayload
  ) {
    return this.paymentService.manualMarkup(orderId, remark || '人工收款', currentUser);
  }
}
