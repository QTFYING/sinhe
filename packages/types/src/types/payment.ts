import type {
  H5PayOrderStatus as PaymentOrderStatusContract,
  PaymentChannel as PaymentChannelContract,
  PaymentMethod as PaymentMethodContract,
} from '../contracts'
import type { ListParams } from './common'

export type PaymentOrderStatus = `${PaymentOrderStatusContract}`

export type PaymentMethodType = `${PaymentMethodContract}`
export type PaymentChannel = `${PaymentChannelContract}`

export type CashVerifyStatus = 'pending' | 'verified'

export type OfflinePaymentMethod = Extract<PaymentMethodType, 'cash' | 'other_paid'>

export interface PaymentOrderItem {
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

export interface PaymentOrderDetail {
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
  selectedPaymentMethod: PaymentMethodType | null
  offlinePayment: OfflinePaymentInfo | null
  items: PaymentOrderItem[]
}

export interface PaymentOrderActionResult {
  orderNo: string
  status: PaymentOrderStatus
  statusMessage?: string
  selectedPaymentMethod: PaymentMethodType | null
  offlinePayment: OfflinePaymentInfo | null
}

export interface SubmitOfflinePaymentPayload {
  paymentMethod: OfflinePaymentMethod
  remark?: string
}

export interface ConfirmPaymentPayload {
  channel?: Exclude<PaymentChannel, 'direct'>
}

export interface ConfirmPaymentResult {
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

export interface PaymentStatusResult {
  orderNo: string
  status: PaymentOrderStatus
  statusMessage?: string
  paidAmount?: number
  paidAt?: string
  selectedPaymentMethod?: PaymentMethodType
}

export interface WxJsapiPayload {
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

export interface PaymentRecord {
  id: string
  orderId: string
  customer: string
  amount: number
  channel: string
  fee: number
  net: number
  status: 'success' | 'partial' | 'pending'
  tenant?: string
  time?: string
  paidAt?: string
}

export interface PaymentListParams extends ListParams {
  channel?: string
}

export interface PaymentSummary {
  totalAmount: number
  totalFee: number
  totalNet: number
  totalCount: number
  abnormalCount: number
}
