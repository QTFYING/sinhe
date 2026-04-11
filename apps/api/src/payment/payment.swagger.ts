import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CashVerifyStatusEnum,
  OfflinePaymentMethodEnum,
  OrderStatusEnum,
  PaymentMethodEnum,
  PaymentOrderStatusEnum,
  PaymentRecordStatusEnum,
} from '@shou/types/enums';

export class PaymentOrderLineItemSwagger {
  @ApiProperty({ description: '行项目 ID' })
  itemId!: string;

  @ApiPropertyOptional({ description: '商品主数据 ID', nullable: true })
  skuId?: string | null;

  @ApiProperty({ description: '商品名称', example: '农夫山泉 550ml' })
  skuName!: string;

  @ApiPropertyOptional({ description: '商品规格', example: '24瓶/箱' })
  skuSpec?: string;

  @ApiProperty({ description: '单位', example: '箱' })
  unit!: string;

  @ApiProperty({ description: '数量', example: 2 })
  quantity!: number;

  @ApiProperty({ description: '单价（元）', example: 48.5 })
  unitPrice!: number;

  @ApiProperty({ description: '行金额（元）', example: 97 })
  lineAmount!: number;
}

export class OfflinePaymentInfoSwagger {
  @ApiProperty({ description: '线下支付方式', enum: Object.values(OfflinePaymentMethodEnum), example: OfflinePaymentMethodEnum.OTHER_PAID })
  method!: string;

  @ApiProperty({ description: '备注', example: '客户已转账，待核实' })
  remark!: string;

  @ApiPropertyOptional({ description: '现金核销状态', enum: Object.values(CashVerifyStatusEnum), example: CashVerifyStatusEnum.PENDING, nullable: true })
  cashVerifyStatus!: string | null;

  @ApiProperty({ description: '核销状态文案', example: '待核销' })
  cashVerifyStatusText!: string;

  @ApiProperty({ description: '提交时间', example: '2026-04-11T09:00:00.000Z' })
  submittedAt!: string;

  @ApiPropertyOptional({ description: '核销时间', example: '2026-04-11T10:00:00.000Z', nullable: true })
  verifiedAt?: string | null;
}

export class PaymentOrderDetailResponseSwagger {
  @ApiProperty({ description: '订单号', example: 'ERP20260410001' })
  orderNo!: string;

  @ApiProperty({ description: '商户名称', example: '深圳华强贸易有限公司' })
  merchant!: string;

  @ApiProperty({ description: '客户名称', example: '深圳华强贸易' })
  customer!: string;

  @ApiProperty({ description: '订单金额（元）', example: 198.5 })
  amount!: number;

  @ApiProperty({ description: '已收金额（元）', example: 100 })
  paidAmount!: number;

  @ApiProperty({ description: '订单摘要', example: '农夫山泉 550ml、康师傅冰红茶' })
  summary!: string;

  @ApiProperty({ description: '下单时间', example: '2026-04-10T12:00:00.000Z' })
  date!: string;

  @ApiProperty({ description: '支付单状态', enum: Object.values(PaymentOrderStatusEnum), example: PaymentOrderStatusEnum.UNPAID })
  status!: string;

  @ApiPropertyOptional({ description: '状态说明', example: '订单待支付' })
  statusMessage?: string;

  @ApiPropertyOptional({ description: '客服电话', example: '400-800-1234' })
  servicePhone?: string;

  @ApiPropertyOptional({ description: '当前选择的支付方式', enum: Object.values(PaymentMethodEnum), example: PaymentMethodEnum.ONLINE, nullable: true })
  selectedPaymentMethod!: string | null;

  @ApiPropertyOptional({ description: '线下支付信息', type: OfflinePaymentInfoSwagger, nullable: true })
  offlinePayment!: OfflinePaymentInfoSwagger | null;

  @ApiProperty({ description: '订单明细', type: [PaymentOrderLineItemSwagger] })
  items!: PaymentOrderLineItemSwagger[];
}

export class InitiatePaymentResponseSwagger {
  @ApiProperty({ description: '收银台地址', example: 'https://cashier.example.com/pay/123' })
  cashierUrl!: string;

  @ApiProperty({ description: '支付单 ID' })
  orderId!: string;

  @ApiProperty({ description: '待支付金额字符串', example: '198.50' })
  payableAmount!: string;
}

export class SubmitOfflinePaymentResponseSwagger {
  @ApiProperty({ description: '订单号', example: 'ERP20260410001' })
  orderNo!: string;

  @ApiProperty({ description: '支付单状态', enum: Object.values(PaymentOrderStatusEnum), example: PaymentOrderStatusEnum.PENDING_VERIFICATION })
  status!: string;

  @ApiPropertyOptional({ description: '状态说明', example: '已提交线下支付，等待核销' })
  statusMessage?: string;

  @ApiPropertyOptional({ description: '当前选择的支付方式', enum: Object.values(PaymentMethodEnum), example: PaymentMethodEnum.OTHER_PAID, nullable: true })
  selectedPaymentMethod!: string | null;

  @ApiPropertyOptional({ description: '线下支付信息', type: OfflinePaymentInfoSwagger, nullable: true })
  offlinePayment!: OfflinePaymentInfoSwagger | null;
}

export class PaymentStatusResponseSwagger {
  @ApiProperty({ description: '订单号', example: 'ERP20260410001' })
  orderNo!: string;

  @ApiProperty({ description: '支付单状态', enum: Object.values(PaymentOrderStatusEnum), example: PaymentOrderStatusEnum.PAID })
  status!: string;

  @ApiPropertyOptional({ description: '状态说明', example: '支付成功' })
  statusMessage?: string;

  @ApiPropertyOptional({ description: '已收金额（元）', example: 198.5 })
  paidAmount?: number;

  @ApiPropertyOptional({ description: '支付完成时间', example: '2026-04-11T10:00:00.000Z' })
  paidAt?: string;

  @ApiPropertyOptional({ description: '最终支付方式', enum: Object.values(PaymentMethodEnum), example: PaymentMethodEnum.ONLINE })
  selectedPaymentMethod?: string;
}

export class CreateCashVerificationResponseSwagger {
  @ApiProperty({ description: '订单 ID' })
  orderId!: string;

  @ApiProperty({ description: '订单状态', enum: Object.values(OrderStatusEnum), example: OrderStatusEnum.PAID })
  orderStatus!: string;

  @ApiProperty({ description: '支付状态', example: 'paid' })
  paymentStatus!: string;

  @ApiProperty({ description: '核销时间', example: '2026-04-11T10:00:00.000Z' })
  verifiedAt!: string;
}

export class TenantPaymentRecordItemSwagger {
  @ApiProperty({ description: '流水 ID' })
  id!: string;

  @ApiProperty({ description: '订单 ID' })
  orderId!: string;

  @ApiProperty({ description: '客户名称', example: '深圳华强贸易' })
  customer!: string;

  @ApiProperty({ description: '收款金额（元）', example: 198.5 })
  amount!: number;

  @ApiProperty({ description: '支付渠道', example: 'lakala' })
  channel!: string;

  @ApiProperty({ description: '手续费（元）', example: 0.6 })
  fee!: number;

  @ApiProperty({ description: '净额（元）', example: 197.9 })
  net!: number;

  @ApiProperty({ description: '流水状态', enum: Object.values(PaymentRecordStatusEnum), example: PaymentRecordStatusEnum.SUCCESS })
  status!: string;

  @ApiProperty({ description: '支付时间', example: '2026-04-11T10:00:00.000Z' })
  paidAt!: string;
}

export class AdminPaymentRecordItemSwagger {
  @ApiProperty({ description: '流水 ID' })
  id!: string;

  @ApiProperty({ description: '所属租户名称', example: '华南一区商户A' })
  tenant!: string;

  @ApiProperty({ description: '订单 ID' })
  orderId!: string;

  @ApiProperty({ description: '客户名称', example: '深圳华强贸易' })
  customer!: string;

  @ApiProperty({ description: '收款金额（元）', example: 198.5 })
  amount!: number;

  @ApiProperty({ description: '支付渠道', example: 'lakala' })
  channel!: string;

  @ApiProperty({ description: '手续费（元）', example: 0.6 })
  fee!: number;

  @ApiProperty({ description: '净额（元）', example: 197.9 })
  net!: number;

  @ApiProperty({ description: '时间字段', example: '2026-04-11T10:00:00.000Z' })
  time!: string;

  @ApiProperty({ description: '流水状态', enum: Object.values(PaymentRecordStatusEnum), example: PaymentRecordStatusEnum.SUCCESS })
  status!: string;
}

export class TenantPaymentListResponseSwagger {
  @ApiProperty({ description: '流水列表', type: [TenantPaymentRecordItemSwagger] })
  list!: TenantPaymentRecordItemSwagger[];

  @ApiProperty({ description: '总数', example: 50 })
  total!: number;

  @ApiProperty({ description: '当前页', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页条数', example: 20 })
  pageSize!: number;
}

export class AdminPaymentListResponseSwagger {
  @ApiProperty({ description: '流水列表', type: [AdminPaymentRecordItemSwagger] })
  list!: AdminPaymentRecordItemSwagger[];

  @ApiProperty({ description: '总数', example: 50 })
  total!: number;

  @ApiProperty({ description: '当前页', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页条数', example: 20 })
  pageSize!: number;
}

export class PaymentSummaryResponseSwagger {
  @ApiProperty({ description: '总收款金额（元）', example: 12800 })
  totalAmount!: number;

  @ApiProperty({ description: '总手续费（元）', example: 38.5 })
  totalFee!: number;

  @ApiProperty({ description: '总净额（元）', example: 12761.5 })
  totalNet!: number;

  @ApiProperty({ description: '流水总数', example: 66 })
  totalCount!: number;

  @ApiProperty({ description: '异常流水数', example: 1 })
  abnormalCount!: number;
}
