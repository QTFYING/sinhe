# 枚举手册

> 枚举事实源：`packages/types/src/enums`
> 契约定义：`packages/types/src/contracts`
> 通用结构：`packages/types/src/common`
> 约束：`packages/types/src/types` 已删除，不再作为任何定义入口

## 1. 统一规则

- 运行时枚举对象统一命名为 `XxxEnum`
- 值类型统一命名为 `Xxx`
- 枚举值统一使用稳定英文值，优先采用 `lower_snake_case`
- 每个枚举成员必须补中文 JSDoc 注释
- `contracts` 只定义请求、响应、资源结构，不定义枚举事实源
- API 文档正文必须直接展开关键枚举值，不能只留下类型名让前端跳文档

## 2. 枚举总表

| 枚举名 | 取值 | 中文说明 | 主要使用字段 |
|------|------|------|------|
| `UserRole` | `OS_SUPER_ADMIN` `TENANT_OWNER` `TENANT_OPERATOR` `TENANT_FINANCE` `TENANT_VIEWER` | 平台超级管理员、老板、打单员、财务、访客 | `users.role` |
| `TenantRole` | `TENANT_OWNER` `TENANT_OPERATOR` `TENANT_FINANCE` `TENANT_VIEWER` | 老板、打单员、财务、访客 | `users.role` |
| `TenantStatus` | `active` `onboarding` `attention` `paused` | 正常、待审、关注、停用 | `tenants.status` |
| `UserStatus` | `active` `invited` `locked` `disabled` | 正常、邀请中、锁定、禁用 | `users.status` |
| `UserSimpleStatus` | `active` `disabled` | 启用、禁用 | Tenant 用户启停 |
| `TenantSide` | `platform` `tenant` | 平台侧、租户侧 | `users.tenantType`、`roles.side` |
| `AuthSourceTag` | `mock` `remote` | 模拟、本地真实来源 | 登录标准化映射 |
| `SortOrder` | `asc` `desc` | 升序、降序 | 列表排序 |
| `TenantSortField` | `name` `packageName` `status` `dueInDays` | 租户名、套餐名、状态、距到期天数 | 租户列表排序 |
| `ReviewAction` | `approve` `reject` | 通过、驳回 | 资质审核动作 |
| `FreezeAction` | `freeze` `unfreeze` | 冻结、解冻 | 租户冻结动作 |
| `TenantCertificationStatus` | `pending_initial_review` `pending_secondary_review` `pending_confirmation` `approved` `rejected` | 待初审、待复核、待确认、已通过、已驳回 | `tenant_certifications.status` |
| `TenantRenewPaymentMethod` | `bank_transfer` `wechat_pay` `alipay` `offline_remittance` | 银行转账、微信支付、支付宝、线下打款 | 平台续费记录 |
| `AuditTargetType` | `account` `role` `tenant` | 账号、角色、租户 | `audit_logs.targetType` |
| `AuditResult` | `success` `pending` | 成功、待处理 | `audit_logs.result` |
| `OrderStatus` | `pending` `partial` `paid` `expired` `credit` | 待收款、部分收款、已结清、已作废或过期、账期单 | `orders.status` |
| `OrderPayType` | `cash` `credit` | 现款、账期 | `orders.payType` |
| `OrderImportJobStatus` | `pending` `processing` `completed` `failed` | 待处理、处理中、已完成、失败 | `import_jobs.status` |
| `OrderImportConflictPolicy` | `skip` `overwrite` | 跳过、覆盖 | 导入冲突处理 |
| `OrderImportTemplateFieldSourceType` | `list` `line` | 订单头字段、订单明细字段 | 导入模板字段 `type` |
| `OrderTemplateFieldType` | `text` `number` `money` `date` `enum` | 文本、数字、金额、日期、枚举 | 导入模板字段类型 |
| `CreditOrderStatus` | `normal` `soon` `today` `overdue` | 正常、即将到期、今日到期、已逾期 | 账期订单视图 |
| `PaymentMethod` | `online` `cash` `other_paid` | 在线支付、现金支付、其他方式已支付 | `payment_orders.paymentMethod` |
| `OfflinePaymentMethod` | `cash` `other_paid` | 现金支付、其他方式已支付 | H5 线下登记 |
| `PaymentChannel` | `lakala` | 拉卡拉 | `payment_orders.channel` |
| `PaymentOrderStatus` | `unpaid` `paying` `pending_verification` `paid` `expired` | 待支付、支付中、待核销、已完成、已过期 | `payment_orders.status` |
| `CashVerifyStatus` | `pending` `verified` | 待核销、已核销 | `payment_orders.cashVerifyStatus` |
| `PaymentRecordStatus` | `success` `partial` `pending` `failed` | 成功、部分完成、处理中、失败 | `payments.status` |
| `BillingPackageStatus` | `active` `draft` `archived` | 生效、草稿、归档 | `packages.status` |
| `ContractType` | `electronic_signature` `archive_copy` | 电子签、归档件 | `contracts.type` |
| `ContractStatus` | `active` `pending_renewal` `pending_signing` `pending_archive` `terminated` | 履约中、待续约、待签署、待归档、已终止 | `contracts.status` |
| `InvoiceStatus` | `issued` `pending_issue` `reconciling` `voided` | 已开票、待开票、对账中、已作废 | `invoices.status` |
| `PublishTiming` | `immediate` `scheduled` | 立即发布、定时发布 | `notices.timing` |
| `NoticeStatus` | `published` `draft` `offline` | 已发布、草稿、已下架 | `notices.status` |
| `TicketStatus` | `pending` `processing` `resolved` | 待分派、处理中、已解决 | `tickets.status` |
| `ServiceProviderStatus` | `active` `trial` | 已接入、试运行 | `service_providers.status` |
| `FinanceReconciliationStatus` | `verified` `pending` `exception` | 已核销、待核销、异常 | Tenant 对账状态 |
| `AdminReconciliationStatus` | `reconciling` `verified` `partial_unverified` `overdue_unpaid` | 对账中、已核销、部分未核、逾期未收 | Admin 对账状态 |

## 3. 维护顺序

1. 先改 `packages/types/src/enums/*`
2. 再改 `packages/types/src/contracts/*`
3. 再改 `docs/api/*.md`
4. 最后同步 `docs/prisma/data-model-reference.md` 与本手册
