import type { BillingPackageStatus, ContractStatus, ContractType, InvoiceStatus } from '../enums'

export interface PackagePlanItem {
  id: string
  name: string
  price: string
  rate: string
  tenants: number
  strategy: string
  orderTrend: string
  features: string[]
  status: BillingPackageStatus
}

export interface CreatePackagePlanRequest {
  name: string
  price: string
  rate: string
  strategy: string
  features: string[]
}

export interface UpdatePackagePlanRequest {
  name?: string
  price?: string
  rate?: string
  strategy?: string
  features?: string[]
}

export interface ContractRecordItem {
  contractNo: string
  tenant: string
  type: ContractType
  expireAt: string
  status: ContractStatus
  terminateReason?: string
}

export interface CreateContractRequest {
  tenant: string
  contactName: string
  phone: string
  packageName: string
  annualFee: string
  rate: string
  serviceStart: string
  serviceEnd: string
}

export interface UpdateContractRequest {
  contactName?: string
  phone?: string
  packageName?: string
  annualFee?: string
  rate?: string
  serviceStart?: string
  serviceEnd?: string
}

export interface CreateContractResponse {
  contractNo: string
  signLink: string
  smsSent: boolean
}

export interface ApproveContractRequest {
  remark?: string
}

export interface TerminateContractRequest {
  terminateReason: string
}

export interface InvoiceRecordItem {
  billNo: string
  tenant: string
  amount: string
  cycle: string
  status: InvoiceStatus
  issuedAt?: string | null
}

export interface CreateInvoiceRequest {
  tenant: string
  cycle: string
  amount: string
  taxRate?: number
}

export interface CreateInvoiceResponse {
  billNo: string
  status: 'pending_issue'
}

export interface VoidInvoiceRequest {
  voidReason: string
}
