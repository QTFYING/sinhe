import type {
  OrderImportConflictPolicy as OrderImportConflictPolicyContract,
  OrderImportJobStatus as OrderImportJobStatusContract,
  OrderStatus as OrderStatusContract,
  OrderTemplateFieldType as OrderTemplateFieldTypeContract,
  PayType as PayTypeContract,
} from '../contracts'
import type { ListParams } from './common'

export type OrderStatus = `${OrderStatusContract}`
export type PayType = `${PayTypeContract}`
export type OrderImportJobStatus = `${OrderImportJobStatusContract}`
export type OrderImportConflictPolicy = `${OrderImportConflictPolicyContract}`
export type OrderTemplateFieldType = `${OrderTemplateFieldTypeContract}`

export type OrderCustomFieldValue = string | number | boolean | null

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

export interface Order {
  id: string
  customer: string
  summary: string
  amount: number
  paid: number
  status: OrderStatus
  payType: PayType
  prints: number
  date: string
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

export interface OrderListParams extends ListParams {
  status?: OrderStatus
  payType?: PayType
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

export interface OrderImportPreviewPayload {
  templateId?: string
  rows: Array<Record<string, unknown>>
}

export interface OrderImportPreviewResult {
  previewId: string
  templateId?: string
  matchedFieldCount?: number
  requiredFieldMissing: string[]
  summary: OrderImportPreviewSummary
  aggregatedOrders: Order[]
  invalidRows: OrderImportPreviewRowError[]
  duplicateOrders: OrderImportDuplicateOrder[]
}

export interface OrderImportSubmitPayload {
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

export interface OrderImportSubmitResult {
  jobId: string
  submittedCount: number
  status: OrderImportJobStatus
}

export interface OrderImportJobResult {
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

export interface OrderImportResult {
  importedCount: number
  skippedCount: number
  errorCount: number
  errors: Array<{
    row: number
    reason: string
  }>
}

export interface OrderExportParams extends OrderListParams {
  ids?: string[]
}

export interface OrderRemindPayload {
  channels?: string[]
}

export interface OrderRemindResult {
  sent: boolean
  channels?: string[]
  channel?: string
}

export interface CreditOrderRecord {
  id: string
  customer: string
  amount: number
  date: string
  creditDays: number
  dueDate: string
  creditStatus: 'normal' | 'soon' | 'today' | 'overdue'
}

export interface MarkOrderReceivedPayload {
  amount?: number
  remark?: string
}

export interface MarkOrderReceivedResult {
  orderId: string
  status: OrderStatus
  paid: number
}
