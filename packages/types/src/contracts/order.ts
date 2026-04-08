export enum OrderStatus {
  PENDING = 'pending', // 待支付
  PARTIAL = 'partial', // 部分支付
  PAID = 'paid', // 已支付
  EXPIRED = 'expired', // 已作废/超期
  CREDIT = 'credit', // 收账期(挂账)
}

export enum PayType {
  CASH = '现款', // 现款
  CREDIT = '账期', // 账期
}

export enum OrderImportJobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum OrderImportConflictPolicy {
  SKIP = 'skip',
  OVERWRITE = 'overwrite',
}

export enum OrderTemplateFieldType {
  TEXT = 'text',
  NUMBER = 'number',
  MONEY = 'money',
  DATE = 'date',
  ENUM = 'enum',
}
