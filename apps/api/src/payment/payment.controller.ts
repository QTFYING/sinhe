import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRoleEnum } from '@prisma/client';
import type {
  AdminPaymentRecordItem,
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

@ApiTags('H5 Payment')
@Controller('pay')
export class H5PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiOperation({ summary: '获取 H5 支付详情' })
  @Get(':token')
  async getPaymentDetail(@Param('token') token: string): Promise<PaymentOrderDetailResponse> {
    return this.paymentService.getPaymentDetail(token);
  }

  @ApiOperation({ summary: '发起在线支付' })
  @Post(':token/initiate')
  async initiatePayment(@Param('token') token: string): Promise<InitiatePaymentResponse> {
    return this.paymentService.initiatePayment(token);
  }

  @ApiOperation({ summary: '提交线下支付信息' })
  @Post(':token/offline-payment')
  async submitOfflinePayment(
    @Param('token') token: string,
    @Body() request: SubmitOfflinePaymentDto,
  ): Promise<SubmitOfflinePaymentResponse> {
    return this.paymentService.submitOfflinePayment(token, request as SubmitOfflinePaymentRequest);
  }

  @ApiOperation({ summary: '轮询支付状态' })
  @Get(':token/status')
  async getPaymentStatus(@Param('token') token: string): Promise<PaymentStatusResponse> {
    return this.paymentService.getPaymentStatus(token);
  }
}

@ApiTags('Payment Webhook')
@Controller('payment')
export class PaymentWebhookController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiOperation({ summary: '拉卡拉支付回调' })
  @Post('webhook/lakala')
  async handleLakalaWebhook(@Body() payload: Record<string, unknown>) {
    return this.paymentService.handleLakalaWebhook(payload);
  }
}

@ApiTags('Payments')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiOperation({ summary: '获取收款流水列表' })
  @Get('payments')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN, UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_FINANCE)
  async getPayments(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: ListPaymentsQueryDto,
  ): Promise<PaginatedResponse<TenantPaymentRecordItem | AdminPaymentRecordItem>> {
    return this.paymentService.getPayments(currentUser, query as PaymentListQuery);
  }

  @ApiOperation({ summary: '获取收款汇总统计' })
  @Get('payments/summary')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN, UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_FINANCE)
  async getPaymentSummary(@CurrentUser() currentUser: JwtPayload): Promise<PaymentSummaryResponse> {
    return this.paymentService.getPaymentSummary(currentUser);
  }

  @ApiOperation({ summary: '创建现金核销记录' })
  @Post('orders/:id/cash-verifications')
  @Roles(UserRoleEnum.TENANT_FINANCE)
  async createCashVerification(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) orderId: string,
  ): Promise<CreateCashVerificationResponse> {
    return this.paymentService.createCashVerification(currentUser, orderId);
  }
}
