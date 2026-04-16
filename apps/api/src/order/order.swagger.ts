import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreditOrderStatusEnum, OrderPayTypeEnum, OrderStatusEnum } from '@shou/types/enums';

export class OrderLineItemSwagger {
  @ApiPropertyOptional({ description: '行项目 ID', example: 'e9c3c63d-8fbf-42f0-9008-3f6bb62a137d' })
  itemId?: string;

  @ApiPropertyOptional({ description: '商品主数据 ID', example: 'SKU-001', nullable: true })
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

export class TenantOrderItemSwagger {
  @ApiProperty({ description: '订单 ID', example: '95dc7f09-5a01-4cae-9071-8d048d4f787c' })
  id!: string;

  @ApiPropertyOptional({ description: '原始 ERP 订单号', example: 'ERP20260410001' })
  sourceOrderNo?: string;

  @ApiPropertyOptional({ description: '防重辅键', example: 'ERP20260410001#张三' })
  groupKey?: string;

  @ApiPropertyOptional({ description: '导入映射模板 ID', example: 'c92a1e5b-87f0-4d61-9c26-6141d81df7fa' })
  mappingTemplateId?: string;

  @ApiPropertyOptional({ description: '订单二维码令牌', example: '0b8f8ad4d034c46f...' })
  qrCodeToken?: string;

  @ApiProperty({ description: '客户名称', example: '深圳华强贸易' })
  customer!: string;

  @ApiProperty({ description: '客户电话', example: '13800138000' })
  customerPhone!: string;

  @ApiProperty({ description: '客户地址', example: '深圳市福田区深南大道1001号' })
  customerAddress!: string;

  @ApiProperty({ description: '订单总金额（元）', example: 198.5 })
  totalAmount!: number;

  @ApiProperty({ description: '已收金额（元）', example: 100 })
  paid!: number;

  @ApiProperty({ description: '订单状态', enum: Object.values(OrderStatusEnum), example: OrderStatusEnum.PARTIAL })
  status!: string;

  @ApiProperty({ description: '结算方式', enum: Object.values(OrderPayTypeEnum), example: OrderPayTypeEnum.CASH })
  payType!: string;

  @ApiProperty({ description: '打印次数', example: 2 })
  prints!: number;

  @ApiProperty({ description: '下单时间', example: '2026-04-10T12:00:00.000Z' })
  orderTime!: string;

  @ApiProperty({ description: '订单明细', type: [OrderLineItemSwagger] })
  lineItems!: OrderLineItemSwagger[];

  @ApiPropertyOptional({
    description: '自定义字段键值对',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { customerCode: 'C-001', deliveryRoute: 'A区' },
  })
  customerFieldValues?: Record<string, string>;

  @ApiProperty({ description: '是否已作废', example: false })
  voided!: boolean;

  @ApiPropertyOptional({ description: '作废原因', example: '客户取消订单' })
  voidReason?: string;

  @ApiPropertyOptional({ description: '作废时间', example: '2026-04-10T13:00:00.000Z' })
  voidedAt?: string;
}

export class AdminOrderItemSwagger {
  @ApiProperty({ description: '订单 ID', example: '95dc7f09-5a01-4cae-9071-8d048d4f787c' })
  id!: string;

  @ApiProperty({ description: '所属租户名称', example: '华南一区商户A' })
  tenant!: string;

  @ApiPropertyOptional({ description: '原始 ERP 订单号', example: 'ERP20260410001' })
  sourceOrderNo?: string;

  @ApiPropertyOptional({ description: '防重辅键', example: 'ERP20260410001#张三' })
  groupKey?: string;

  @ApiPropertyOptional({ description: '导入映射模板 ID', example: 'c92a1e5b-87f0-4d61-9c26-6141d81df7fa' })
  mappingTemplateId?: string;

  @ApiPropertyOptional({ description: '订单二维码令牌', example: '0b8f8ad4d034c46f...' })
  qrCodeToken?: string;

  @ApiProperty({ description: '客户名称', example: '深圳华强贸易' })
  customer!: string;

  @ApiProperty({ description: '客户电话', example: '13800138000' })
  customerPhone!: string;

  @ApiProperty({ description: '客户地址', example: '深圳市福田区深南大道1001号' })
  customerAddress!: string;

  @ApiProperty({ description: '订单总金额（元）', example: 198.5 })
  totalAmount!: number;

  @ApiProperty({ description: '订单明细', type: [OrderLineItemSwagger] })
  lineItems!: OrderLineItemSwagger[];

  @ApiPropertyOptional({
    description: '自定义字段键值对',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { customerCode: 'C-001', deliveryRoute: 'A区' },
  })
  customerFieldValues?: Record<string, string>;

  @ApiProperty({ description: '已收金额（元）', example: 100 })
  paid!: number;

  @ApiProperty({ description: '订单状态', enum: Object.values(OrderStatusEnum), example: OrderStatusEnum.PARTIAL })
  status!: string;

  @ApiProperty({ description: '结算方式', enum: Object.values(OrderPayTypeEnum), example: OrderPayTypeEnum.CASH })
  payType!: string;

  @ApiProperty({ description: '下单时间', example: '2026-04-10T12:00:00.000Z' })
  orderTime!: string;

  @ApiProperty({ description: '是否已作废', example: false })
  voided!: boolean;

  @ApiPropertyOptional({ description: '作废原因', example: '客户取消订单' })
  voidReason?: string;

  @ApiPropertyOptional({ description: '作废时间', example: '2026-04-10T13:00:00.000Z' })
  voidedAt?: string;
}

export class CreditOrderItemSwagger {
  @ApiProperty({ description: '订单 ID' })
  id!: string;

  @ApiProperty({ description: '客户名称' })
  customer!: string;

  @ApiProperty({ description: '订单金额（元）', example: 399 })
  amount!: number;

  @ApiProperty({ description: '下单时间', example: '2026-04-10T12:00:00.000Z' })
  date!: string;

  @ApiProperty({ description: '账期天数', example: 30 })
  creditDays!: number;

  @ApiProperty({ description: '到期日', example: '2026-05-10' })
  dueDate!: string;

  @ApiProperty({ description: '账期状态', enum: Object.values(CreditOrderStatusEnum), example: CreditOrderStatusEnum.SOON })
  creditStatus!: string;
}

export class CreditOrderListResponseSwagger {
  @ApiProperty({ description: '列表数据', type: [CreditOrderItemSwagger] })
  list!: CreditOrderItemSwagger[];

  @ApiProperty({ description: '总条数', example: 12 })
  total!: number;

  @ApiProperty({ description: '当前页码', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页条数', example: 20 })
  pageSize!: number;
}

export class TenantOrderListResponseSwagger {
  @ApiProperty({ description: '列表数据', type: [TenantOrderItemSwagger] })
  list!: TenantOrderItemSwagger[];

  @ApiProperty({ description: '总条数', example: 48 })
  total!: number;

  @ApiProperty({ description: '当前页码', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页条数', example: 20 })
  pageSize!: number;
}

export class AdminOrderListResponseSwagger {
  @ApiProperty({ description: '列表数据', type: [AdminOrderItemSwagger] })
  list!: AdminOrderItemSwagger[];

  @ApiProperty({ description: '总条数', example: 48 })
  total!: number;

  @ApiProperty({ description: '当前页码', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页条数', example: 20 })
  pageSize!: number;
}

export class OrderPrintRecordResponseSwagger {
  @ApiPropertyOptional({ description: '批次请求号', example: 'print-batch-20260411-001' })
  requestId?: string;

  @ApiProperty({ description: '提交总数', example: 10 })
  totalCount!: number;

  @ApiProperty({ description: '成功累计打印次数的订单数', example: 10 })
  successCount!: number;

  @ApiProperty({ description: '确认时间', example: '2026-04-11T10:00:00.000Z' })
  confirmedAt!: string;

  @ApiPropertyOptional({ description: '备注', example: '一联打印成功' })
  remark?: string;
}

export class CreateOrderReminderResponseSwagger {
  @ApiProperty({ description: '是否发送成功', example: true })
  sent!: boolean;

  @ApiProperty({ description: '实际发送渠道', type: [String], example: ['sms', 'wechat'] })
  channels!: string[];
}

export class CreateOrderReceiptResponseSwagger {
  @ApiProperty({ description: '订单 ID' })
  orderId!: string;

  @ApiProperty({ description: '回款后的订单状态', enum: Object.values(OrderStatusEnum), example: OrderStatusEnum.PAID })
  status!: string;

  @ApiProperty({ description: '回款后的已收金额（元）', example: 198.5 })
  paid!: number;
}
