# 接口实现分层清单

> 日期：2026-04-11
> 文档状态：当前生效
> 文档定位：接口编码执行手册
> 适用范围：`docs/api`、`packages/types/src/contracts`、`apps/api`
> 目标：把已经稳定的 API 文档，转成可持续落地的后端实现顺序与分层标准

## 一、当前状态

截至当前，项目处于“文档和契约已基本稳定，主业务代码分批重建”的阶段。

已完成：

1. `Auth` 链路校准
2. Prisma 核心模型重建
3. `settings/general` 落地
4. `settings/printing*` 落地
5. API 路径完成一轮资源化调整，减少 RPC 风格命名

未完成：

1. Import Template 实现
2. Orders 主域实现
3. H5 Payment 实现
4. Tenant 支付补充链路实现
5. Print Records 实现
6. Admin 大部分业务实现
7. Swagger 第二轮及后续同步

因此，从现在开始，接口实现应按“分层 + 分域 + 分批”推进，而不是看到哪个接口就直接写哪个 controller。

## 二、实现分层

每个接口落地时，统一按以下 6 层执行。

### L1 契约层

职责：

1. 确认路径、方法、角色、请求体、响应体以 `docs/api/*.md` 为准
2. 确认 `packages/types/src/contracts` 已完成投影
3. 确认该接口是否已被资源化命名，不再沿用旧 RPC 路径

完成标准：

1. 文档正文可独立阅读
2. `contracts` 名称与文档语义一致
3. 不再引用废弃路径

### L2 接口层

职责：

1. 定义 controller 路由
2. 定义 DTO、参数校验、路径参数和 query 参数
3. 接入 Guard、角色校验、租户上下文注入

完成标准：

1. controller 只处理 HTTP 契约
2. DTO 不承载业务流程判断
3. Tenant 接口不接受前端传入最终 `tenantId`

### L3 应用服务层

职责：

1. 编排业务流程
2. 驱动状态流转
3. 控制幂等、事务和跨表写入顺序

完成标准：

1. service 只承载业务语义，不直接暴露 Prisma 细节
2. 跨表写入链路显式收口
3. 状态迁移与文档一致

### L4 领域规则层

职责：

1. 统一处理状态机、金额计算、权限前置规则
2. 抽离可复用规则，例如：
   - 订单是否允许作废
   - 支付单是否允许重新发起
   - 现金核销是否允许执行
   - 打印回执是否重复

完成标准：

1. 规则可被复用
2. 不把核心状态判断散落在多个 controller/service 分支里

### L5 持久化层

职责：

1. 落 Prisma 查询与写入
2. 明确唯一键、组合唯一、索引的用法
3. 必要时使用事务

完成标准：

1. 查询条件带对租户边界
2. 组合唯一键和幂等键被实际利用
3. 不再引用旧 Prisma 字段名

### L6 产物层

职责：

1. Swagger / OpenAPI 同步
2. 最小联调验证
3. 阶段性遗留项记录

完成标准：

1. Swagger 服从文档，不反向改义
2. 至少完成局部类型检查或接口自测
3. 明确写出暂缓项

## 三、接口落地顺序

后续接口实现不按文档章节顺序推进，而按依赖关系推进。

### 第一层：主数据准备层

目标：

先打通后续订单、支付、打印要依赖的主数据。

应实现接口：

1. `GET /import/templates`
2. `POST /import/templates`
3. `PUT /import/templates/{id}`

原因：

1. 打印配置依赖 `importTemplateId`
2. 订单导入依赖模板结构
3. 后续订单 `mappingTemplateId` 需要稳定来源

验收：

1. 模板列表、创建、更新均可用
2. `import_templates` 与 `printer_templates` 绑定关系成立
3. 默认模板逻辑明确

### 第二层：订单主域层

目标：

把订单变成统一主数据源。

应实现接口：

1. `GET /orders`
2. `GET /orders/{id}`
3. `POST /orders`
4. `PUT /orders/{id}`
5. `PATCH /orders/{id}`
6. `POST /orders/import`
7. `GET /orders/import/jobs/{jobId}`
8. `POST /import/preview`

关键点：

1. 创建和导入订单都要生成 `qrCodeToken`
2. 订单详情返回 H5 所需基础信息
3. 作废走 `PATCH /orders/{id}`，不恢复旧 `/void`

验收：

1. 订单列表与详情字段完全对齐文档
2. 导入链路围绕 `sourceOrderNo / mappingTemplateId / customFieldValues`
3. 旧 `erpOrderNo / templateId / customFields` 不回流

### 第三层：H5 支付层

目标：

先打通 H5 自身闭环，再接 Tenant 财务补充动作。

应实现接口：

1. `GET /pay/:token`
2. `POST /pay/:token/initiate`
3. `POST /pay/:token/offline-payment`
4. `GET /pay/:token/status`

关键点：

1. 5 态状态机必须严格一致
2. `expired` 允许重新发起支付
3. `cashierUrl` 为动态返回，不固化在订单字段

验收：

1. `payment_orders` 与 `orders` 状态联动成立
2. 在线支付与线下登记都能走通
3. H5 公开路由只依赖 `qrCodeToken`

### 第四层：Tenant 收款补充层

目标：

把 H5 之后的财务动作接回后台。

应实现接口：

1. `GET /payments`
2. `GET /payments/summary`
3. `POST /orders/{id}/cash-verifications`
4. `POST /orders/{id}/receipts`
5. `POST /orders/{id}/reminders`
6. `GET /orders/credit`
7. `GET /finance/summary`
8. `GET /finance/reconciliation`
9. `GET /finance/reconciliation/export`

关键点：

1. `cash-verifications` 不是简单改状态，而是创建核销事实
2. `receipts` 不是简单改状态，而是创建回款事实
3. `reminders` 是子资源创建，不回退旧动词路径

验收：

1. `orders + payment_orders + payments` 联动成立
2. 金额累计可解释
3. 财务汇总、对账查询口径一致

### 第五层：打印回执层

目标：

在订单和支付链路稳定后，补打印闭环。

应实现接口：

1. `POST /orders/print-records`

关键点：

1. 使用 `tenantId + requestId` 批次级幂等
2. 只累计打印次数，不承担实际打印
3. 不恢复 `/print/jobs`

验收：

1. 重复提交不重复累加
2. `prints` 与 `print_record_batches` 口径一致

### 第六层：Tenant 设置外围层

目标：

在主链路跑通后，补设置域剩余接口。

应实现接口：

1. `GET /settings/users`
2. `POST /settings/users`
3. `PUT /settings/users/{id}`
4. `DELETE /settings/users/{id}`
5. `PATCH /settings/users/{id}`
6. `GET /settings/roles`
7. `GET /settings/permissions`
8. `GET /settings/audit-logs`
9. `GET /notifications`
10. `POST /notifications/{id}/read-records`
11. `POST /tenants/certification`
12. `GET /tenants/certification`

验收：

1. 用户状态更新走 `PATCH`
2. 公告已读走 `read-records`
3. 不扩散到旧动态角色模型

### 第七层：Admin 主域层

目标：

平台侧优先实现与主链路强相关的只读和审核能力。

应实现接口：

1. `GET /tenants`
2. `POST /tenants`
3. `POST /tenants/{id}/audit-decisions`
4. `POST /tenants/audit-batches`
5. `POST /tenants/{id}/renewals`
6. `PATCH /tenants/{id}`
7. `POST /tenants/status-change-batches`
8. `GET /tenants/certifications`
9. `POST /tenants/certifications/{id}/review-decisions`
10. `GET /users`
11. `POST /users`
12. `PUT /users/{id}`
13. `DELETE /users/{id}`
14. `PATCH /users/{id}`
15. `POST /users/{id}/password-resets`
16. `GET /orders`
17. `GET /orders/{id}`
18. `GET /payments`
19. `GET /payments/summary`
20. `GET /reconciliation/summary`
21. `GET /reconciliation/daily`
22. `GET /reconciliation/export`

验收：

1. 平台接口跨租户可读，租户接口默认隔离
2. 审核、续费、冻结已改为资源化路径
3. 不混入租户侧默认作用域

### 第八层：Admin 外围层

目标：

最后补套餐、合同、发票、工单、服务商、Ops 等外围域。

应实现接口：

1. `billing/packages*`
2. `billing/contracts*`
3. `billing/invoices*`
4. `service-providers*`
5. `notices*`
6. `tickets*`
7. `security/*`
8. `ops/alert-rules*`
9. `ops/system-configs`
10. `ops/service-configs*`

关键点：

1. `approvals / terminations / replies / assignments / closures` 都按子资源实现
2. `PATCH /billing/invoices/{id}`、`PATCH /ops/alert-rules/{id}` 只做局部状态更新

## 四、单接口实施检查表

每实现一个接口，统一按以下清单打勾：

1. 路径、方法、角色是否与 `docs/api` 一致
2. `contracts` 是否已存在或已同步更新
3. DTO 是否只做参数校验
4. controller 是否只承接 HTTP 参数
5. service 是否收口业务流程
6. 是否需要事务
7. 是否需要幂等
8. 是否需要 tenant scope
9. 是否涉及状态机
10. 是否涉及金额计算
11. 是否需要同步 Swagger
12. 是否已记录遗留项

## 五、当前推荐的实施顺序

从现在开始，建议严格按以下顺序继续写代码：

1. P5 Import Template
2. Orders 主域
3. H5 Payment
4. Tenant Payment / Finance / Credit
5. Print Records
6. Tenant Users / Notifications / Certification
7. Admin 主域
8. Admin 外围域
9. Swagger 分阶段同步

## 六、非目标

本清单不要求当前立即完成以下事项：

1. 一次性把所有旧模块编译错误清零
2. 先写完外围域再回头补主链路
3. 为了局部接口落地而反向改义 API 文档
4. 恢复任何旧 RPC 路径或 `/print/jobs`

## 七、收口原则

每完成一层，必须完成对应收口：

1. 文档一致性检查
2. 局部类型检查
3. 关键路径自测或最小验证记录
4. 遗留项写入设计文档或阶段清单

后续若进入真正的“第二批实施”，本清单可作为第二批执行顺序的直接依据。
