import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  OrderImportConflictPolicyEnum,
  OrderImportJobStatusEnum,
  OrderStatusEnum,
} from '@shou/types/enums';
import { OrderLineItemSwagger } from '../order/order.swagger';

export class OrderImportTemplateFieldSwagger {
  @ApiProperty({ description: '字段名称', example: '客户名称' })
  label!: string;

  @ApiProperty({ description: '字段 key', example: 'customer' })
  key!: string;

  @ApiProperty({ description: 'ERP 表头映射值', example: '客户名称' })
  mapStr!: string;

  @ApiProperty({ description: '是否系统必填', example: true })
  isRequired!: boolean;
}

export class OrderImportTemplateSwagger {
  @ApiProperty({ description: '导入模板 ID' })
  id!: string;

  @ApiProperty({ description: '模板名称', example: '饮品订单模板' })
  name!: string;

  @ApiProperty({ description: '是否默认模板', example: true })
  isDefault!: boolean;

  @ApiProperty({ description: '最近更新时间', example: '2026-04-15T09:00:00.000Z' })
  updatedAt!: string;

  @ApiProperty({ description: '系统默认字段映射', type: [OrderImportTemplateFieldSwagger] })
  defaultFields!: OrderImportTemplateFieldSwagger[];

  @ApiProperty({ description: '自定义字段映射', type: [OrderImportTemplateFieldSwagger] })
  customerFields!: OrderImportTemplateFieldSwagger[];
}

export class OrderImportPreviewOrderSwagger {
  @ApiProperty({ description: '源订单号', example: 'SO-20260415-001' })
  sourceOrderNo!: string;

  @ApiPropertyOptional({ description: '辅助分组/防重键', example: 'SO-20260415-001' })
  groupKey?: string;

  @ApiProperty({ description: '客户名称', example: '深圳华强贸易' })
  customer!: string;

  @ApiProperty({ description: '主商品名称', example: '农夫山泉 550ml' })
  skuName!: string;

  @ApiProperty({ description: '主展示行金额（元）', example: 24 })
  lineAmount!: number;

  @ApiProperty({ description: '订单总金额（元）', example: 48 })
  totalAmount!: number;

  @ApiProperty({ description: '下单时间', example: '2026-04-15T09:30:00.000Z' })
  orderTime!: string;

  @ApiProperty({
    description: '模板自定义字段值',
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { customerKey1: 'MD001', customerKey2: '张三' },
  })
  customerValues!: Record<string, string>;

  @ApiPropertyOptional({ description: '关联映射模板 ID' })
  mappingTemplateId?: string;

  @ApiProperty({ description: '订单明细', type: [OrderLineItemSwagger] })
  lineItems!: OrderLineItemSwagger[];
}

export class OrderImportPreviewSummarySwagger {
  @ApiProperty({ description: '参与预检的订单总数', example: 2 })
  totalOrders!: number;

  @ApiProperty({ description: '通过预检的订单数', example: 2 })
  validOrders!: number;

  @ApiProperty({ description: '预检失败的订单数', example: 0 })
  invalidOrders!: number;

  @ApiProperty({ description: '与库内重复的订单数', example: 0 })
  duplicateOrderCount!: number;

  @ApiProperty({ description: '错误明细总数', example: 0 })
  errorCount!: number;
}

export class OrderImportDuplicateOrderSwagger {
  @ApiProperty({ description: '重复的源订单号', example: 'SO-20260415-001' })
  sourceOrderNo!: string;

  @ApiPropertyOptional({ description: '已存在订单 ID' })
  existingOrderId?: string;

  @ApiPropertyOptional({ description: '客户名称', example: '深圳华强贸易' })
  customer?: string;

  @ApiPropertyOptional({ description: '订单总金额（元）', example: 48 })
  totalAmount?: number;

  @ApiPropertyOptional({
    description: '已存在订单当前状态',
    enum: Object.values(OrderStatusEnum),
    example: OrderStatusEnum.PAID,
  })
  existingStatus?: string;

  @ApiProperty({ description: '当前批次命中的订单数', example: 1 })
  incomingCount!: number;
}

export class OrderImportPreviewErrorSwagger {
  @ApiProperty({ description: '订单序号，从 1 开始', example: 1 })
  index!: number;

  @ApiPropertyOptional({ description: '字段 key', example: 'totalAmount' })
  field?: string;

  @ApiPropertyOptional({ description: '源订单号', example: 'SO-20260415-001' })
  sourceOrderNo?: string;

  @ApiProperty({ description: '错误原因', example: '总金额不能为空' })
  reason!: string;
}

export class OrderImportPreviewResponseSwagger {
  @ApiProperty({ description: '预检批次 ID' })
  previewId!: string;

  @ApiProperty({ description: '本次预检使用的模板 ID' })
  templateId!: string;

  @ApiProperty({ description: '汇总信息', type: OrderImportPreviewSummarySwagger })
  summary!: OrderImportPreviewSummarySwagger;

  @ApiProperty({ description: '服务端规范化后的订单预览', type: [OrderImportPreviewOrderSwagger] })
  orders!: OrderImportPreviewOrderSwagger[];

  @ApiProperty({ description: '重复订单信息', type: [OrderImportDuplicateOrderSwagger] })
  duplicateOrders!: OrderImportDuplicateOrderSwagger[];

  @ApiProperty({ description: '预检失败明细', type: [OrderImportPreviewErrorSwagger] })
  invalidOrders!: OrderImportPreviewErrorSwagger[];
}

export class OrderImportSubmitResponseSwagger {
  @ApiProperty({ description: '导入任务 ID' })
  jobId!: string;

  @ApiProperty({ description: '本次消费的预检批次 ID' })
  previewId!: string;

  @ApiProperty({ description: '提交的订单数', example: 2 })
  submittedCount!: number;

  @ApiProperty({
    description: '任务状态',
    enum: Object.values(OrderImportJobStatusEnum),
    example: OrderImportJobStatusEnum.PENDING,
  })
  status!: string;
}

export class OrderImportJobFailureSwagger {
  @ApiPropertyOptional({ description: '失败订单序号', example: 1 })
  index?: number;

  @ApiPropertyOptional({ description: '源订单号', example: 'SO-20260415-001' })
  sourceOrderNo?: string;

  @ApiProperty({ description: '失败原因', example: '订单总金额必须大于 0' })
  reason!: string;
}

export class OrderImportJobConflictDetailSwagger {
  @ApiProperty({ description: '源订单号', example: 'SO-20260415-001' })
  sourceOrderNo!: string;

  @ApiPropertyOptional({ description: '命中的已有订单 ID' })
  existingOrderId?: string;

  @ApiProperty({
    description: '冲突处理动作',
    enum: Object.values(OrderImportConflictPolicyEnum),
    example: OrderImportConflictPolicyEnum.SKIP,
  })
  action!: string;

  @ApiProperty({ description: '处理原因', example: '命中重复订单，按 skip 跳过' })
  reason!: string;
}

export class OrderImportJobResponseSwagger {
  @ApiProperty({ description: '导入任务 ID' })
  jobId!: string;

  @ApiProperty({ description: '预检批次 ID' })
  previewId!: string;

  @ApiProperty({
    description: '任务状态',
    enum: Object.values(OrderImportJobStatusEnum),
    example: OrderImportJobStatusEnum.PROCESSING,
  })
  status!: string;

  @ApiProperty({ description: '提交总数', example: 2 })
  submittedCount!: number;

  @ApiProperty({ description: '已处理数量', example: 1 })
  processedCount!: number;

  @ApiProperty({ description: '成功新增入库数', example: 1 })
  successCount!: number;

  @ApiProperty({ description: '跳过数', example: 0 })
  skippedCount!: number;

  @ApiProperty({ description: '覆盖更新数', example: 0 })
  overwrittenCount!: number;

  @ApiProperty({ description: '失败数', example: 0 })
  failedCount!: number;

  @ApiProperty({ description: '失败订单明细', type: [OrderImportJobFailureSwagger] })
  failedOrders!: OrderImportJobFailureSwagger[];

  @ApiProperty({ description: '冲突处理明细', type: [OrderImportJobConflictDetailSwagger] })
  conflictDetails!: OrderImportJobConflictDetailSwagger[];

  @ApiPropertyOptional({ description: '任务完成时间', example: '2026-04-15T10:00:00.000Z' })
  completedAt?: string;
}
