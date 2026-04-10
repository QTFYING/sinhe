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
  lineId: string
  sourceLineNo?: string
  sourceOrderNo?: string
  skuCode?: string
  skuName: string
  skuSpec?: string
  unit?: string
  quantity: number
  unitPrice: number
  lineAmount: number
}

export type OrderCustomFieldValue = string | number | boolean | null

export interface OrderItem {
  id: string
  customer: string
  summary: string
  amount: number
  paid: number
  status: OrderStatus
  payType: OrderPayType
  prints: number
  date: string
  qrCodeToken?: string
  sourceOrderNo?: string
  groupKey?: string
  sourcePlatform?: string
  mappingTemplateId?: string
  importBatchId?: string
  importedAt?: string
  voided?: boolean
  voidReason?: string
  voidedAt?: string
  lineItems?: OrderLineItem[]
  customFieldValues?: Record<string, OrderCustomFieldValue>
}

export interface OrderListQuery extends ListParams {
  status?: OrderStatus
  payType?: OrderPayType
  dateFrom?: string
  dateTo?: string
  templateId?: string
  sourceOrderNo?: string
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
  isDefault?: boolean
  updatedAt?: string
  mappings: OrderImportMapping[]
  sourceColumns?: OrderImportSourceColumn[]
  fields?: OrderImportTemplateField[]
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
  aggregatedOrders: OrderItem[]
  invalidRows: OrderImportPreviewRowError[]
  duplicateOrders: OrderImportDuplicateOrder[]
}

export interface OrderImportSubmitRequest {
  previewId?: string
  templateId?: string
  conflictPolicy?: OrderImportConflictPolicy
  rows?: Array<Record<string, unknown>>
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

export interface OrderImportSubmitResponse {
  jobId: string
  submittedCount: number
  status: OrderImportJobStatus
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

export interface OrderRemindRequest {
  channels?: string[]
}

export interface OrderRemindResponse {
  sent: boolean
  channels?: string[]
  channel?: string
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

export interface MarkOrderReceivedRequest {
  amount?: number
  remark?: string
}

export interface MarkOrderReceivedResponse {
  orderId: string
  status: OrderStatus
  paid: number
}
