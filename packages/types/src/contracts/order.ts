import type { ListParams } from '../common'
import type {
  CreditOrderStatus,
  OrderImportConflictPolicy,
  OrderImportJobStatus,
  OrderPayType,
  OrderStatus,
  OrderTemplateFieldType,
} from '../enums'

export interface OrderLineItem {
  itemId?: string
  skuId?: string | null
  skuName: string
  skuSpec?: string
  unit: string
  quantity: number
  unitPrice: number
  lineAmount: number
}

export interface TenantOrderItem {
  id: string
  sourceOrderNo?: string
  groupKey?: string
  mappingTemplateId?: string
  qrCodeToken?: string
  customer: string
  summary: string
  amount: number
  paid: number
  status: OrderStatus
  payType: OrderPayType
  prints: number
  date: string
  lineItems: OrderLineItem[]
  customFieldValues?: Record<string, string>
  voided: boolean
  voidReason?: string
  voidedAt?: string
}

export interface AdminOrderItem {
  id: string
  tenant: string
  sourceOrderNo?: string
  groupKey?: string
  mappingTemplateId?: string
  qrCodeToken?: string
  customer: string
  lineItems: OrderLineItem[]
  customFieldValues?: Record<string, string>
  amount: number
  paid: number
  status: OrderStatus
  payType: OrderPayType
  date: string
  voided: boolean
  voidReason?: string
  voidedAt?: string
}

export interface OrderListQuery extends ListParams {
  status?: OrderStatus
  payType?: OrderPayType
  templateId?: string
  sourceOrderNo?: string
  dateFrom?: string
  dateTo?: string
}

export interface AdminOrderListQuery {
  page: number
  pageSize: number
  keyword?: string
}

export interface CreateOrderRequest {
  customer: string
  summary?: string
  amount: number
  paid?: number
  status?: OrderStatus
  payType?: OrderPayType
  date?: string
}

export interface UpdateOrderRequest {
  customer?: string
  summary?: string
  amount?: number
  paid?: number
  status?: OrderStatus
  payType?: OrderPayType
  date?: string
  lineItems?: OrderLineItem[]
  customFieldValues?: Record<string, string>
}

export interface VoidOrderRequest {
  voidReason: string
}

export interface OrderImportMapping {
  sourceColumn: string
  targetField: string
  sampleValue?: string
}

export interface OrderImportSourceColumn {
  key: string
  title: string
  index: number
  sampleValue?: string
}

export interface OrderImportTemplateField {
  key: string
  label: string
  fieldType: OrderTemplateFieldType
  required: boolean
  visible: boolean
  order: number
  builtin?: boolean
}

export interface OrderImportTemplate {
  id: string
  name: string
  isDefault: boolean
  updatedAt: string
  sourceColumns: OrderImportSourceColumn[]
  fields: OrderImportTemplateField[]
  mappings: OrderImportMapping[]
}

export interface CreateOrderImportTemplateRequest {
  name: string
  isDefault: boolean
  sourceColumns: OrderImportSourceColumn[]
  fields: OrderImportTemplateField[]
  mappings: OrderImportMapping[]
}

export interface UpdateOrderImportTemplateRequest {
  name?: string
  isDefault?: boolean
  sourceColumns?: OrderImportSourceColumn[]
  fields?: OrderImportTemplateField[]
  mappings?: OrderImportMapping[]
}

export interface OrderImportPreviewSummary {
  totalRows: number
  validRows: number
  invalidRows: number
  aggregatedOrderCount: number
  duplicateOrderCount: number
  errorCount: number
}

export interface OrderImportPreviewRowError {
  row: number
  field?: string
  sourceOrderNo?: string
  reason: string
}

export interface OrderImportDuplicateOrder {
  sourceOrderNo: string
  existingOrderId?: string
  customer?: string
  amount?: number
  existingStatus?: OrderStatus
  incomingRowCount: number
}

export interface OrderImportPreviewRequest {
  templateId?: string
  rows: Array<Record<string, unknown>>
}

export interface OrderImportPreviewResponse {
  previewId: string
  templateId?: string
  matchedFieldCount?: number
  requiredFieldMissing: string[]
  summary: OrderImportPreviewSummary
  aggregatedOrders: TenantOrderItem[]
  duplicateOrders: OrderImportDuplicateOrder[]
  invalidRows: OrderImportPreviewRowError[]
}

export interface OrderImportSubmitRequest {
  previewId?: string
  templateId?: string
  conflictPolicy?: OrderImportConflictPolicy
  rows?: Array<Record<string, unknown>>
}

export interface OrderImportSubmitResponse {
  jobId: string
  submittedCount: number
  status: OrderImportJobStatus
}

export interface OrderImportJobFailure {
  row: number
  sourceOrderNo?: string
  reason: string
}

export interface OrderImportJobConflictDetail {
  sourceOrderNo: string
  existingOrderId?: string
  action: OrderImportConflictPolicy
  reason: string
}

export interface OrderImportJobResponse {
  jobId: string
  status: OrderImportJobStatus
  submittedCount: number
  processedCount: number
  successCount: number
  skippedCount: number
  overwrittenCount: number
  failedCount: number
  failedRows: OrderImportJobFailure[]
  conflictDetails: OrderImportJobConflictDetail[]
  completedAt?: string
}

export interface OrderExportQuery extends OrderListQuery {
  ids?: string[]
}

export interface OrderPrintRecordRequest {
  orderIds: string[]
  requestId?: string
  remark?: string
}

export interface OrderPrintRecordResponse {
  requestId?: string
  totalCount: number
  successCount: number
  confirmedAt: string
  remark?: string
}

export interface CreateOrderReminderRequest {
  channels?: string[]
}

export interface CreateOrderReminderResponse {
  sent: boolean
  channels: string[]
}

export interface CreditOrderItem {
  id: string
  customer: string
  amount: number
  date: string
  creditDays: number
  dueDate: string
  creditStatus: CreditOrderStatus
}

export interface CreateOrderReceiptRequest {
  amount?: number
  remark?: string
}

export interface CreateOrderReceiptResponse {
  orderId: string
  status: OrderStatus
  paid: number
}
