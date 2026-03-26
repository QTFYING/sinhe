/** 业务类型定义 — 对齐 API.md V1.2 */

// ========== 枚举 ==========

export type PayStatus = 'UNPAID' | 'PAYING' | 'PARTIAL_PAID' | 'PAID' | 'REFUNDED';
export type DeliveryStatus = 'PENDING' | 'IN_TRANSIT' | 'DELIVERED';
export type PaymentMethod = 'ONLINE_PAYMENT' | 'MANUAL_MARKUP';
export type UserRole = 'OS_SUPER_ADMIN' | 'OS_OPERATOR' | 'TENANT_OWNER' | 'TENANT_OPERATOR' | 'TENANT_FINANCE' | 'TENANT_VIEWER';

export const PAY_STATUS_MAP: Record<PayStatus, string> = {
  UNPAID: '未支付',
  PAYING: '支付中',
  PARTIAL_PAID: '部分支付',
  PAID: '已支付',
  REFUNDED: '已退款',
};

export const DELIVERY_STATUS_MAP: Record<DeliveryStatus, string> = {
  PENDING: '待发货',
  IN_TRANSIT: '配送中',
  DELIVERED: '已送达',
};

// ========== 用户 ==========

export interface UserInfo {
  userId: string;
  username: string;
  realName?: string;
  role: UserRole;
  tenantId: string | null;
}

export interface Employee {
  id: string;
  username: string;
  realName: string;
  role: UserRole;
  status: number;
  createdAt: string;
  updatedAt?: string;
}

// ========== 统一响应 ==========

export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ========== 订单 ==========

export interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  amount: string;
}

export interface Order {
  id: string;
  erpOrderNo: string;
  customerName: string;
  customerPhone?: string;
  deliveryAddress?: string;
  deliveryPersonName?: string;
  totalAmount: string;
  paidAmount: string;
  discountAmount: string;
  payStatus: PayStatus;
  deliveryStatus: DeliveryStatus;
  creditExpireAt?: string;
  qrCodeToken?: string;
  qrExpireAt?: string;
  customFields?: Record<string, string>;
  createdAt: string;
  items?: OrderItem[];
  payments?: PaymentRecord[];
  logs?: LifecycleLog[];
}

// ========== 支付 ==========

export interface PaymentRecord {
  id: string;
  orderId: string;
  erpOrderNo?: string;
  customerName?: string;
  paymentMethod: PaymentMethod;
  actualAmount: string;
  channel?: string;
  channelTradeNo?: string;
  status: string;
  paidTime: string;
}

// ========== 操作日志 ==========

export interface LifecycleLog {
  event: string;
  operatorId: string;
  snapshot: Record<string, unknown> | null;
  createdAt: string;
}

// ========== 财务报表 ==========

export interface ReportSummary {
  totalOrderAmount: string;
  totalPaidAmount: string;
  totalDiscountAmount: string;
  unpaidAmount: string;
  paidOrderCount: number;
  unpaidOrderCount: number;
  collectionRate: string;
  byDeliveryPerson?: { name: string; paidAmount: string; orderCount: number }[];
  byTemplate?: { templateName: string; paidAmount: string; orderCount: number }[];
}

// ========== 导入模板 ==========

export interface CustomFieldDef {
  columnHeader: string;
  fieldKey: string;
  label: string;
  showInList: boolean;
}

export interface ImportTemplate {
  id: string;
  templateName: string;
  mappingRules: Record<string, string>;
  customFieldDefs: CustomFieldDef[];
  createdAt: string;
}

export interface ImportPreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  preview: Record<string, unknown>[];
  errors: { row: number; reason: string }[];
}

export interface ImportJobStatus {
  jobId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  submittedCount: number;
  successCount?: number;
  failedCount?: number;
  errors?: { erpOrderNo: string; reason: string }[];
}

// ========== 通知 ==========

export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  isRead: boolean;
  relatedOrderId: string | null;
  createdAt: string;
}

// ========== 租户设置 ==========

export interface TenantSettings {
  name: string;
  contactPhone: string;
  maxCreditDays: number;
  creditReminderDays: number;
  expireAt: string;
  paymentConfig?: { lakalaShopNo: string };
}

// ========== 打印 ==========

export interface PrintJob {
  orderId: string;
  erpOrderNo: string;
  customerName: string;
  deliveryAddress?: string;
  deliveryPersonName?: string;
  totalAmount: string;
  discountAmount?: string;
  items: OrderItem[];
  qrCodeUrl?: string;
  customFields?: Record<string, string>;
}
