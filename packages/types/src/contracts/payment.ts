import type { ListParams } from '../common'
import type {
  CashVerifyStatus,
  OfflinePaymentMethod,
  PaymentChannel,
  PaymentMethod,
  PaymentOrderStatus,
  PaymentRecordStatus,
} from '../enums'

export interface PaymentOrderLineItem {
  itemId: string
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
  paidAmount?: number
  summary: string
  date: string
  status: PaymentOrderStatus
  statusMessage?: string
  servicePhone?: string
  selectedPaymentMethod: PaymentMethod | null
  offlinePayment: OfflinePaymentInfo | null
  items: PaymentOrderLineItem[]
}

export interface PaymentOrderActionResponse {
  orderNo: string
  status: PaymentOrderStatus
  statusMessage?: string
  selectedPaymentMethod: PaymentMethod | null
  offlinePayment: OfflinePaymentInfo | null
}

export interface SubmitOfflinePaymentRequest {
  paymentMethod: OfflinePaymentMethod
  remark?: string
}

export interface ConfirmPaymentRequest {
  channel?: Exclude<PaymentChannel, 'direct'>
}

export interface ConfirmPaymentResponse {
  orderNo: string
  paymentId: string
  channel: PaymentChannel
  channelParams: {
    appId?: string
    timeStamp?: string
    nonceStr?: string
    package?: string
    signType?: string
    paySign?: string
    tradePageUrl?: string
    directResult?: 'paid'
  }
}

export interface PaymentStatusResponse {
  orderNo: string
  status: PaymentOrderStatus
  statusMessage?: string
  paidAmount?: number
  paidAt?: string
  selectedPaymentMethod?: PaymentMethod
}

export interface WxJsapiRequest {
  openId: string
}

export interface WxJsapiParams {
  appId: string
  timeStamp: string
  nonceStr: string
  package: string
  signType: 'RSA'
  paySign: string
}

export interface PaymentRecordItem {
  id: string
  orderId: string
  customer: string
  amount: number
  channel: string
  fee: number
  net: number
  status: PaymentRecordStatus
  tenant?: string
  time?: string
  paidAt?: string
}

export interface PaymentListQuery extends ListParams {
  channel?: string
}

export interface PaymentSummaryResponse {
  totalAmount: number
  totalFee: number
  totalNet: number
  totalCount: number
  abnormalCount: number
}
