/**
 * 收单吧 SaaS 系统 - 前后端共享枚举字典 (极简速查版)
 * 供前端直接拷贝至项目中作为 Constants/Types 引用
 */

// ==============================================
// 1. 权限与租户域
// ==============================================

export enum TenantRole {
  OWNER = 'TENANT_OWNER',         // 老板
  OPERATOR = 'TENANT_OPERATOR',   // 打单员
  FINANCE = 'TENANT_FINANCE',     // 财务
  VIEWER = 'TENANT_VIEWER',       // 访客/只读
}

export enum TenantStatus {
  ACTIVE = 'active',              // 正常活跃
  ONBOARDING = 'onboarding',      // 初始化/资料待审
  ATTENTION = 'attention',        // 临近过期警告
  PAUSED = 'paused',              // 冻结/停用
}

export enum UserStatus {
  ACTIVE = 'active',              // 正常活跃
  INVITED = 'invited',            // 邀请中/未激活
  LOCKED = 'locked',              // 已锁定
  DISABLED = 'disabled',          // 已禁用
}

// ==============================================
// 2. 核心交易流（订单与支付）
// ==============================================

export enum OrderStatus {
  PENDING = 'pending',            // 待支付
  PARTIAL = 'partial',            // 部分支付
  PAID = 'paid',                  // 已支付
  EXPIRED = 'expired',            // 已作废/超期
  CREDIT = 'credit',              // 收账期(挂账)
}

export enum PaymentMethod {
  ONLINE = 'online',              // 线上代扣/扫码
  CASH = 'cash',                  // 现金交款
  OTHER_PAID = 'other_paid',      // 其他方式已付(如对公转账)
}

export enum PaymentChannel {
  WX_JSAPI = 'wx_jsapi',          // 微信 JSAPI
  ALI_H5 = 'ali_h5',              // 支付宝 H5
  DIRECT = 'direct',              // 直接支付网关
}

export enum H5PayOrderStatus {
  UNPAID = 'UNPAID',                            // 初始化未付
  PAYING = 'PAYING',                            // 取码支付中
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',// 待财务核销(如离线现金流)
  PAID = 'PAID',                                // 彻底完结
  EXPIRED = 'EXPIRED',                          // 二维码过期或交易关闭
}

// ==============================================
// 3. 运维与其他
// ==============================================

export enum TicketStatus {
  PENDING = '待分派',
  PROCESSING = '处理中',
  RESOLVED = '已解决',
}

export enum PackageStatus {
  DRAFT = 'draft',                // 草稿
  ACTIVE = 'active',              // 售卖中
  ARCHIVED = 'archived',          // 已下架
}

// ------------------------------------------------
// 附：用于 UI 渲染的中文映射表 (Map) 示例
// ------------------------------------------------

export const OrderStatusMap: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: '待支付',
  [OrderStatus.PARTIAL]: '部分支付',
  [OrderStatus.PAID]: '已完成',
  [OrderStatus.EXPIRED]: '已作废',
  [OrderStatus.CREDIT]: '记账期',
};
