# 枚举手册

> 主来源：`packages/types/src/enums`
> 兼容出口：`@shou/types/enums`
> 旧兼容别名仍保留在 `@shou/types/contracts`，但不再作为新增枚举的定义入口。
> 警告：本文档不能主动修改，只能由后端同步过来

## 1. 统一规则

- 运行时枚举对象统一命名为 `XxxEnum`
- 值类型统一命名为 `Xxx`
- 枚举值统一使用 `UPPER_SNAKE_CASE` 英文大写下划线格式
- 枚举属性必须包含 `/** 中文说明 */` JSDoc 注释
- API 文档、前端类型、服务端 DTO 的闭集字段，统一引用这里的枚举名
- `packages/types/src/contracts` 只保留兼容出口，不再持有枚举事实来源

## 2. 兼容别名

| 旧名 | 新名 | 说明 |
|------|------|------|
| `PayType` | `OrderPayType` | 旧名过泛，已统一到订单域 |
| `H5PayOrderStatus` | `PaymentOrderStatus` | 同一支付单状态机，去掉 H5 前缀 |
| `PaymentMethodType` | `PaymentMethod` | 统一支付方式命名 |
| `PackageStatus` | `BillingPackageStatus` | 避免与其它 package/package-like 语义冲突 |

## 3. 枚举总表

| 枚举名 | 值 | 中文 | 主要使用字段 | 说明 |
|------|------|------|------|------|
| `TenantRole` | `TENANT_OWNER`, `TENANT_OPERATOR`, `TENANT_FINANCE`, `TENANT_VIEWER` | 老板、打单员、财务、访客 | `user.role`、租户员工角色 | 租户侧固定角色 |
| `TenantStatus` | `ACTIVE`, `ONBOARDING`, `ATTENTION`, `PAUSED` | 正常、待审、关注、停用 | `tenants.status` | 平台视角的租户状态 |
| `UserStatus` | `ACTIVE`, `INVITED`, `LOCKED`, `DISABLED` | 正常、邀请中、锁定、禁用 | `users.status` | 平台账号完整状态机 |
| `UserSimpleStatus` | `ACTIVE`, `DISABLED` | 启用、禁用 | 租户员工启停 | 租户侧员工管理最小状态集 |
| `TenantSide` | `PLATFORM`, `TENANT` | 平台侧、租户侧 | `users.tenantType` | 用户所属侧 |
| `AuthSourceTag` | `MOCK`, `REMOTE` | 模拟、本地外部来源 | Auth 标准化映射 | 标识登录信息来源 |
| `SortOrder` | `ASC`, `DESC` | 升序、降序 | 列表排序 Query | 通用排序方向 |
| `TenantSortField` | `NAME`, `PACKAGE_NAME`, `STATUS`, `DUE_IN_DAYS` | 租户名、套餐名、状态、到期天数 | 租户列表排序 | 平台租户中心排序字段 |
| `ReviewAction` | `APPROVE`, `REJECT` | 通过、驳回 | 审核动作 | 用于资质审核等二选一动作 |
| `FreezeAction` | `FREEZE`, `UNFREEZE` | 冻结、解冻 | 租户冻结动作 | 平台冻结/解冻租户 |
| `TenantCertificationStatus` | `PENDING_INITIAL_REVIEW`, `PENDING_SECONDARY_REVIEW`, `PENDING_CONFIRMATION`, `APPROVED`, `REJECTED` | 待初审、待复核、待确认、已通过、已驳回 | `tenant_certifications.status` | 资质审核唯一状态机 |
| `TenantRenewPaymentMethod` | `BANK_TRANSFER`, `WECHAT_PAY`, `ALIPAY`, `OFFLINE_REMITTANCE` | 银行转账、微信支付、支付宝、线下打款 | 平台续费记录 | 平台收款登记方式 |
| `AuditTargetType` | `ACCOUNT`, `ROLE`, `TENANT` | 账号、角色、租户 | 审计对象类型 | 审计日志 | 平台审计对象分类 |
| `AuditResult` | `SUCCESS`, `PENDING` | 成功、待处理 | 执行结果 | 审计日志 | 平台审计执行结果 |
| `OrderStatus` | `PENDING`, `PARTIAL`, `PAID`, `EXPIRED`, `CREDIT` | 待收款、部分收款、已结清、已作废/超期、账期单 | `orders.status` | 订单收款状态 |
| `OrderPayType` | `CASH`, `CREDIT` | 现款、账期 | `orders.payType` | 订单付款类型 |
| `OrderImportJobStatus` | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` | 待处理、处理中、已完成、失败 | 导入任务状态 | Excel 导入异步任务状态 |
| `OrderImportConflictPolicy` | `SKIP`, `OVERWRITE` | 跳过、覆盖 | 导入提交冲突策略 | 重复订单处理策略 |
| `OrderTemplateFieldType` | `TEXT`, `NUMBER`, `MONEY`, `DATE`, `ENUM` | 文本、数字、金额、日期、枚举 | 映射模板字段类型 | 导入模板字段元信息 |
| `CreditOrderStatus` | `NORMAL`, `SOON`, `TODAY`, `OVERDUE` | 正常、即将到期、今日到期、已逾期 | 账期订单视图 | 账期提醒状态 |
| `PaymentMethod` | `ONLINE`, `CASH`, `OTHER_PAID` | 在线支付、现金支付、其他方式已支付 | `payment_orders.paymentMethod` | H5 用户选择的支付方式 |
| `OfflinePaymentMethod` | `CASH`, `OTHER_PAID` | 现金支付、其他方式已支付 | 线下登记接口 | 线下支付子集 |
| `PaymentChannel` | `WX_JSAPI`, `ALI_H5`, `DIRECT` | 微信 JSAPI、支付宝 H5、直连网关 | `payment_orders.channel` | 实际发起支付的通道 |
| `PaymentOrderStatus` | `UNPAID`, `PAYING`, `PENDING_VERIFICATION`, `PAID`, `EXPIRED` | 待支付、支付中、待核销、已完成、已过期 | `payment_orders.status` | H5 支付单状态机 |
| `CashVerifyStatus` | `PENDING`, `VERIFIED` | 待核销、已核销 | 现金核销状态 | 仅现金支付场景使用 |
| `PaymentRecordStatus` | `SUCCESS`, `PARTIAL`, `PENDING`, `FAILED` | 成功、部分、处理中、失败 | 支付流水状态 | 对账与流水列表使用 |
| `BillingPackageStatus` | `ACTIVE`, `DRAFT`, `ARCHIVED` | 生效、草稿、归档 | `packages.status` | 平台套餐状态 |
| `ContractType` | `ELECTRONIC_SIGNATURE`, `ARCHIVE_COPY` | 电子签、归档件 | 合同类型 | 电子合同与归档合同 |
| `ContractStatus` | `ACTIVE`, `PENDING_RENEWAL`, `PENDING_SIGNING`, `PENDING_ARCHIVE`, `TERMINATED` | 履约中、待续约、待签署、待归档、已终止 | 合同管理 | 平台合同状态 |
| `InvoiceStatus` | `ISSUED`, `PENDING_ISSUE`, `RECONCILING`, `VOIDED` | 已开票、待开票、对账中、已作废 | 发票状态 | 发票管理 | 平台发票状态 |
| `PublishTiming` | `IMMEDIATE`, `SCHEDULED` | 立即发布、定时发布 | 公告发布 | 公告发布时间类型 |
| `NoticeStatus` | `PUBLISHED`, `DRAFT`, `OFFLINE` | 已发布、草稿、已下架 | 公告状态 | 公告管理 | 平台公告状态 |
| `TicketStatus` | `PENDING`, `PROCESSING`, `RESOLVED` | 待分派、处理中、已解决 | 工单状态 | 工单管理 | 平台工单状态 |
| `ServiceProviderStatus` | `ACTIVE`, `TRIAL` | 已接入、试运行 | 接入状态 | 服务商管理 | 服务商接入状态 |
| `FinanceReconciliationStatus` | `VERIFIED`, `PENDING`, `EXCEPTION` | 已核销、待核销、异常 | 对账核销状态 | 租户财务对账 | 租户侧对账状态 |
| `AdminReconciliationStatus` | `RECONCILING`, `VERIFIED`, `PARTIAL_UNVERIFIED`, `OVERDUE_UNPAID` | 对账中、已核销、部分未核、逾期未收 | 平台对账状态 | 平台对账日报 | 平台视角日报状态 |

## 4. 使用建议

- API 文档中不要再直接写裸字面量联合类型，优先写成 `status: PaymentOrderStatus`
- 前端若需要渲染中文文案，应基于枚举值再维护展示字典，不要直接把中文文案当作业务状态值
- 新增闭集字段时，先补 `packages/types/src/enums/*`，再补 API 文档与 Prisma 设计文档
