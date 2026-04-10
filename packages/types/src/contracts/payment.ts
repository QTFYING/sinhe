import type { ListParams } from '../common'
import type {
  CashVerifyStatus,
  OfflinePaymentMethod,
  OrderStatus,
  PaymentMethod,
  PaymentOrderStatus,
  PaymentRecordStatus,
} from '../enums'

export interface PaymentOrderLineItem {
  itemId: string
  skuId?: string | null
  skuName: string
  skuSpec?: string
  unit: string
  quantity: number
  unitPrice: number
  lineAmount: number
}

export interface OfflinePaymentInfo {
  method: OfflinePaymentMethod
  remark: string
  cashVerifyStatus: CashVerifyStatus | null
  cashVerifyStatusText: string
  submittedAt: string
  verifiedAt?: string | null
}

export interface PaymentOrderDetailResponse {
  orderNo: string
  merchant: string
  customer: string
  amount: number
  paidAmount: number
  summary: string
  date: string
  status: PaymentOrderStatus
  statusMessage?: string
  servicePhone?: string
  selectedPaymentMethod: PaymentMethod | null
  offlinePayment: OfflinePaymentInfo | null
  items: PaymentOrderLineItem[]
}

export interface InitiatePaymentResponse {
  cashierUrl: string
  orderId: string
  payableAmount: string
}

export interface SubmitOfflinePaymentRequest {
  paymentMethod: OfflinePaymentMethod
  remark?: string
}

export interface SubmitOfflinePaymentResponse {
  orderNo: string
  status: PaymentOrderStatus
  statusMessage?: string
  selectedPaymentMethod: PaymentMethod | null
  offlinePayment: OfflinePaymentInfo | null
}

export interface PaymentStatusResponse {
  orderNo: string
  status: PaymentOrderStatus
  statusMessage?: string
  paidAmount?: number
  paidAt?: string
  selectedPaymentMethod?: PaymentMethod
}

export interface CreateCashVerificationResponse {
  orderId: string
  orderStatus: OrderStatus
  paymentStatus: 'paid'
  verifiedAt: string
}

export interface TenantPaymentRecordItem {
  id: string
  orderId: string
  customer: string
  amount: number
  channel: string
  fee: number
  net: number
  status: PaymentRecordStatus
  paidAt: string
}

export interface AdminPaymentRecordItem {
  id: string
  tenant: string
  orderId: string
  customer: string
  amount: number
  channel: string
  fee: number
  net: number
  time: string
  status: PaymentRecordStatus
}

export interface PaymentListQuery extends ListParams {
  channel?: string
}

export interface AdminPaymentListQuery {
  page: number
  pageSize: number
  keyword?: string
  channel?: string
}

export interface PaymentSummaryResponse {
  totalAmount: number
  totalFee: number
  totalNet: number
  totalCount: number
  abnormalCount: number
}
