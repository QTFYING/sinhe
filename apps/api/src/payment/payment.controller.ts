import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import type {
  CreateCashVerificationResponse,
  InitiatePaymentResponse,
  PaymentListQuery,
  PaymentOrderDetailResponse,
  PaymentStatusResponse,
  PaymentSummaryResponse,
  SubmitOfflinePaymentRequest,
  SubmitOfflinePaymentResponse,
  TenantPaymentRecordItem,
} from '@shou/types/contracts';
import type { PaginatedResponse } from '@shou/types/common';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ListPaymentsQueryDto } from './dto/list-payments.query.dto';
import { SubmitOfflinePaymentDto } from './dto/submit-offline-payment.dto';
import { PaymentService } from './payment.service';

@Controller('pay')
export class H5PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get(':token')
  async getPaymentDetail(@Param('token') token: string): Promise<PaymentOrderDetailResponse> {
    return this.paymentService.getPaymentDetail(token);
  }

  @Post(':token/initiate')
  async initiatePayment(@Param('token') token: string): Promise<InitiatePaymentResponse> {
    return this.paymentService.initiatePayment(token);
  }

  @Post(':token/offline-payment')
  async submitOfflinePayment(
    @Param('token') token: string,
    @Body() request: SubmitOfflinePaymentDto,
  ): Promise<SubmitOfflinePaymentResponse> {
    return this.paymentService.submitOfflinePayment(token, request as SubmitOfflinePaymentRequest);
  }

  @Get(':token/status')
  async getPaymentStatus(@Param('token') token: string): Promise<PaymentStatusResponse> {
    return this.paymentService.getPaymentStatus(token);
  }
}

@Controller('payment')
export class PaymentWebhookController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post('webhook/lakala')
  async handleLakalaWebhook(@Body() payload: Record<string, unknown>) {
    return this.paymentService.handleLakalaWebhook(payload);
  }
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get('payments')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_FINANCE)
  async getPayments(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: ListPaymentsQueryDto,
  ): Promise<PaginatedResponse<TenantPaymentRecordItem>> {
    return this.paymentService.getPayments(currentUser, query as PaymentListQuery);
  }

  @Get('payments/summary')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_FINANCE)
  async getPaymentSummary(@CurrentUser() currentUser: JwtPayload): Promise<PaymentSummaryResponse> {
    return this.paymentService.getPaymentSummary(currentUser);
  }

  @Post('orders/:id/cash-verifications')
  @Roles(UserRoleEnum.TENANT_FINANCE)
  async createCashVerification(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) orderId: string,
  ): Promise<CreateCashVerificationResponse> {
    return this.paymentService.createCashVerification(currentUser, orderId);
  }
}
