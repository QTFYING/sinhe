import type { ListParams } from '../common'
import type {
  CreditOrderStatus,
  OrderImportConflictPolicy,
  OrderImportJobStatus,
  OrderPayType,
  OrderStatus,
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
  customerPhone: string
  customerAddress: string
  totalAmount: number
  paid: number
  status: OrderStatus
  payType: OrderPayType
  prints: number
  orderTime: string
  lineItems: OrderLineItem[]
  customerFieldValues?: Record<string, string>
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
  customerPhone: string
  customerAddress: string
  totalAmount: number
  paid: number
  status: OrderStatus
  payType: OrderPayType
  orderTime: string
  lineItems: OrderLineItem[]
  customerFieldValues?: Record<string, string>
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
  customerPhone?: string
  customerAddress?: string
  summary?: string
  amount: number
  paid?: number
  status?: OrderStatus
  payType?: OrderPayType
  date?: string
}

export interface UpdateOrderRequest {
  customer?: string
  customerPhone?: string
  customerAddress?: string
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

export interface OrderImportTemplateField {
  label: string
  key: string
  mapStr: string
  isRequired: boolean
}

export interface OrderImportCustomerFieldRequest {
  label: string
  mapStr: string
}

export interface OrderImportTemplate {
  id: string
  name: string
  isDefault: boolean
  updatedAt: string
  defaultFields: OrderImportTemplateField[]
  customerFields: OrderImportTemplateField[]
}

export interface OrderImportTemplateMutationResponse {
  id: string
  name: string
  isDefault: boolean
  updatedAt: string
}

export interface CreateOrderImportTemplateRequest {
  name: string
  isDefault: boolean
  defaultFields: OrderImportTemplateField[]
  customerFields: OrderImportCustomerFieldRequest[]
}

export interface UpdateOrderImportTemplateRequest {
  name?: string
  isDefault?: boolean
  defaultFields?: OrderImportTemplateField[]
  customerFields?: OrderImportCustomerFieldRequest[]
}

export interface OrderImportPreviewOrder {
  sourceOrderNo: string
  groupKey?: string
  customer: string
  customerPhone: string
  customerAddress: string
  totalAmount: number | string
  orderTime: string
  payType: OrderPayType
  customerFieldValues: Record<string, string>
  lineItems: OrderLineItem[]
}

export interface OrderImportPreviewOrderResult {
  sourceOrderNo: string
  groupKey?: string
  customer: string
  customerPhone: string
  customerAddress: string
  totalAmount: number
  orderTime: string
  payType: OrderPayType
  customerFieldValues: Record<string, string>
  mappingTemplateId?: string
  lineItems: OrderLineItem[]
}

export interface OrderImportPreviewSummary {
  totalOrders: number
  validOrders: number
  invalidOrders: number
  duplicateOrderCount: number
  errorCount: number
}

export interface OrderImportPreviewError {
  index: number
  field?: string
  sourceOrderNo?: string
  reason: string
}

export interface OrderImportDuplicateOrder {
  sourceOrderNo: string
  existingOrderId?: string
  customer?: string
  totalAmount?: number
  existingStatus?: OrderStatus
  incomingCount: number
}

export interface OrderImportPreviewRequest {
  templateId: string
  orders: OrderImportPreviewOrder[]
}

export interface OrderImportPreviewResponse {
  previewId: string
  templateId: string
  summary: OrderImportPreviewSummary
  orders: OrderImportPreviewOrderResult[]
  duplicateOrders: OrderImportDuplicateOrder[]
  invalidOrders: OrderImportPreviewError[]
}

export interface OrderImportSubmitRequest {
  previewId: string
  conflictPolicy?: OrderImportConflictPolicy
}

export interface OrderImportSubmitResponse {
  jobId: string
  previewId: string
  submittedCount: number
  status: OrderImportJobStatus
}

export interface OrderImportJobFailure {
  index?: number
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
  previewId: string
  status: OrderImportJobStatus
  submittedCount: number
  processedCount: number
  successCount: number
  skippedCount: number
  overwrittenCount: number
  failedCount: number
  failedOrders: OrderImportJobFailure[]
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
