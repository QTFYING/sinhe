export interface PackagePlan {
  id: string
  name: string
  price: string
  rate: string
  tenants: number
  strategy: string
  orderTrend: string
  features: string[]
  status?: 'active' | 'draft' | 'archived'
}

export interface PackagePlanPayload {
  name: string
  price: string
  rate: string
  strategy: string
  features: string[]
}

export interface ContractRecord {
  contractNo: string
  tenant: string
  type: '电子签' | '归档件'
  expireAt: string
  status: '履约中' | '待续约' | '待签署' | '待归档'
}

export type ContractRow = ContractRecord

export interface CreateContractPayload {
  tenant: string
  contactName: string
  phone: string
  packageName: string
  annualFee: string
  rate: string
  serviceStart: string
  serviceEnd: string
}

export interface CreateContractResult {
  contractNo: string
  signLink: string
  smsSent: boolean
}

export interface InvoiceRecord {
  billNo: string
  tenant: string
  amount: string
  period: string
  status: '已开票' | '待开票' | '对账中'
  issuedAt?: string | null
}

export type InvoiceRow = InvoiceRecord
