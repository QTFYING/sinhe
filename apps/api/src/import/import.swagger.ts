import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  OrderImportConflictPolicyEnum,
  OrderImportJobStatusEnum,
  OrderStatusEnum,
  OrderTemplateFieldTypeEnum,
} from '@shou/types/enums';
import { TenantOrderItemSwagger } from '../order/order.swagger';

export class OrderImportSourceColumnSwagger {
  @ApiProperty({ description: '源列 key', example: 'customer_name' })
  key!: string;

  @ApiProperty({ description: '源列表头标题', example: '客户名称' })
  title!: string;

  @ApiProperty({ description: '列索引，从 0 开始', example: 0 })
  index!: number;

  @ApiPropertyOptional({ description: '样例值', example: '深圳华强贸易' })
  sampleValue?: string;
}

export class OrderImportTemplateFieldSwagger {
  @ApiProperty({ description: '目标字段 key', example: 'customer' })
  key!: string;

  @ApiProperty({ description: '字段名称', example: '客户名称' })
  label!: string;

  @ApiProperty({ description: '字段类型', enum: Object.values(OrderTemplateFieldTypeEnum), example: OrderTemplateFieldTypeEnum.TEXT })
  fieldType!: string;

  @ApiProperty({ description: '是否必填', example: true })
  required!: boolean;

  @ApiProperty({ description: '是否在打印/展示中可见', example: true })
  visible!: boolean;

  @ApiProperty({ description: '排序号', example: 1 })
  order!: number;

  @ApiPropertyOptional({ description: '是否内置字段', example: true })
  builtin?: boolean;
}

export class OrderImportMappingSwagger {
  @ApiProperty({ description: '源列名', example: '客户名称' })
  sourceColumn!: string;

  @ApiProperty({ description: '目标字段 key', example: 'customer' })
  targetField!: string;

  @ApiPropertyOptional({ description: '样例值', example: '深圳华强贸易' })
  sampleValue?: string;
}

export class OrderImportTemplateSwagger {
  @ApiProperty({ description: '导入模板 ID' })
  id!: string;

  @ApiProperty({ description: '模板名称', example: '饮品订单模板' })
  name!: string;

  @ApiProperty({ description: '是否默认模板', example: true })
  isDefault!: boolean;

  @ApiProperty({ description: '最近更新时间', example: '2026-04-11T09:00:00.000Z' })
  updatedAt!: string;

  @ApiProperty({ description: '源列定义', type: [OrderImportSourceColumnSwagger] })
  sourceColumns!: OrderImportSourceColumnSwagger[];

  @ApiProperty({ description: '目标字段定义', type: [OrderImportTemplateFieldSwagger] })
  fields!: OrderImportTemplateFieldSwagger[];

  @ApiProperty({ description: '映射关系', type: [OrderImportMappingSwagger] })
  mappings!: OrderImportMappingSwagger[];
}

export class OrderImportPreviewSummarySwagger {
  @ApiProperty({ description: '预检总行数', example: 120 })
  totalRows!: number;

  @ApiProperty({ description: '有效行数', example: 100 })
  validRows!: number;

  @ApiProperty({ description: '无效行数', example: 20 })
  invalidRows!: number;

  @ApiProperty({ description: '聚合后的有效订单数', example: 80 })
  aggregatedOrderCount!: number;

  @ApiProperty({ description: '与库内重复的订单数', example: 5 })
  duplicateOrderCount!: number;

  @ApiProperty({ description: '错误总数', example: 23 })
  errorCount!: number;
}

export class OrderImportDuplicateOrderSwagger {
  @ApiProperty({ description: '重复的源订单号', example: 'ERP20260410001' })
  sourceOrderNo!: string;

  @ApiPropertyOptional({ description: '已存在订单 ID' })
  existingOrderId?: string;

  @ApiPropertyOptional({ description: '客户名称', example: '深圳华强贸易' })
  customer?: string;

  @ApiPropertyOptional({ description: '订单金额（元）', example: 198.5 })
  amount?: number;

  @ApiPropertyOptional({ description: '已存在订单当前状态', enum: Object.values(OrderStatusEnum), example: OrderStatusEnum.PAID })
  existingStatus?: string;

  @ApiProperty({ description: '当前批次命中的原始行数', example: 3 })
  incomingRowCount!: number;
}

export class OrderImportPreviewRowErrorSwagger {
  @ApiProperty({ description: '行号', example: 12 })
  row!: number;

  @ApiPropertyOptional({ description: '字段 key', example: 'customer' })
  field?: string;

  @ApiPropertyOptional({ description: '源订单号', example: 'ERP20260410001' })
  sourceOrderNo?: string;

  @ApiProperty({ description: '错误原因', example: '客户名称不能为空' })
  reason!: string;
}

export class OrderImportPreviewResponseSwagger {
  @ApiProperty({ description: '预检批次 ID' })
  previewId!: string;

  @ApiPropertyOptional({ description: '命中的模板 ID' })
  templateId?: string;

  @ApiPropertyOptional({ description: '匹配到的字段数', example: 12 })
  matchedFieldCount?: number;

  @ApiProperty({ description: '缺失的必填字段 key 列表', type: [String], example: ['customer'] })
  requiredFieldMissing!: string[];

  @ApiProperty({ description: '汇总信息', type: OrderImportPreviewSummarySwagger })
  summary!: OrderImportPreviewSummarySwagger;

  @ApiProperty({ description: '聚合后的订单预览', type: [TenantOrderItemSwagger] })
  aggregatedOrders!: TenantOrderItemSwagger[];

  @ApiProperty({ description: '重复订单信息', type: [OrderImportDuplicateOrderSwagger] })
  duplicateOrders!: OrderImportDuplicateOrderSwagger[];

  @ApiProperty({ description: '无效行信息', type: [OrderImportPreviewRowErrorSwagger] })
  invalidRows!: OrderImportPreviewRowErrorSwagger[];
}

export class OrderImportSubmitResponseSwagger {
  @ApiProperty({ description: '导入任务 ID' })
  jobId!: string;

  @ApiProperty({ description: '提交的订单数', example: 80 })
  submittedCount!: number;

  @ApiProperty({ description: '任务状态', enum: Object.values(OrderImportJobStatusEnum), example: OrderImportJobStatusEnum.PENDING })
  status!: string;
}

export class OrderImportJobFailureSwagger {
  @ApiProperty({ description: '行号', example: 18 })
  row!: number;

  @ApiPropertyOptional({ description: '源订单号', example: 'ERP20260410018' })
  sourceOrderNo?: string;

  @ApiProperty({ description: '失败原因', example: '订单金额格式错误' })
  reason!: string;
}

export class OrderImportJobConflictDetailSwagger {
  @ApiProperty({ description: '源订单号', example: 'ERP20260410001' })
  sourceOrderNo!: string;

  @ApiPropertyOptional({ description: '命中的已有订单 ID' })
  existingOrderId?: string;

  @ApiProperty({ description: '冲突处理动作', enum: Object.values(OrderImportConflictPolicyEnum), example: OrderImportConflictPolicyEnum.SKIP })
  action!: string;

  @ApiProperty({ description: '处理原因', example: '命中重复订单，按 skip 跳过' })
  reason!: string;
}

export class OrderImportJobResponseSwagger {
  @ApiProperty({ description: '导入任务 ID' })
  jobId!: string;

  @ApiProperty({ description: '任务状态', enum: Object.values(OrderImportJobStatusEnum), example: OrderImportJobStatusEnum.PROCESSING })
  status!: string;

  @ApiProperty({ description: '提交总数', example: 80 })
  submittedCount!: number;

  @ApiProperty({ description: '已处理数量', example: 50 })
  processedCount!: number;

  @ApiProperty({ description: '成功入库数', example: 40 })
  successCount!: number;

  @ApiProperty({ description: '跳过数', example: 5 })
  skippedCount!: number;

  @ApiProperty({ description: '覆盖更新数', example: 3 })
  overwrittenCount!: number;

  @ApiProperty({ description: '失败数', example: 2 })
  failedCount!: number;

  @ApiProperty({ description: '失败明细', type: [OrderImportJobFailureSwagger] })
  failedRows!: OrderImportJobFailureSwagger[];

  @ApiProperty({ description: '冲突处理明细', type: [OrderImportJobConflictDetailSwagger] })
  conflictDetails!: OrderImportJobConflictDetailSwagger[];

  @ApiPropertyOptional({ description: '任务完成时间', example: '2026-04-11T10:00:00.000Z' })
  completedAt?: string;
}
