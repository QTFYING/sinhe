**修订目标**

本次文档修订围绕 6 个已确认结论展开：

1. `qrCodeToken` 放入 `orders`，作为 H5 公开入口。
2. `payment_orders.status` 统一为 H5 五态：`UNPAID / PAYING / PENDING_VERIFICATION / PAID / EXPIRED`。
3. 打印配置后端只存黑盒 JSON，并按 `tenantId + importTemplateId` 维护。
4. `/settings/general` 采用“平台默认 + 租户覆盖”两层模型。
5. 打印回执采用“批次级幂等”。
6. 资质状态统一为：`待初审 / 待复核 / 待确认 / 已通过 / 已驳回`。

**API 文档修订清单**

[api-architecture-overview.md](/D:/Sinhe/api/docs/api/api-architecture-overview.md)
- 在全局设计原则和 H5/Tenant 关联描述中，明确 `qrCodeToken` 来源于 `orders.qrCodeToken`。
- 修正 H5 支付时序图中遗留的 `POST /confirm` 表述，统一为 `POST /pay/:token/initiate`。
- 在 H5 说明处明确：`payment_orders` 支持 `EXPIRED` 后重新发起支付。
- 在 Tenant Settings 模块说明中，补充 `/settings/general` 为“平台默认 + 租户覆盖”的合并视图。
- 在 Tenant Orders 模块说明中，补充 `POST /orders/print-records` 为“批次级幂等”，`requestId` 为必填推荐字段。
- 校对 Tenant/Admin/H5 端点数量统计，和各子文档保持一致。

[h5-api-doc.md](/D:/Sinhe/api/docs/api/h5-api-doc.md)
- 在 `GET /pay/:token` 的说明中补一句：`token` 对应 `orders.qrCodeToken`。
- 在 `POST /pay/:token/initiate` 的业务规则中补充：当状态为 `EXPIRED` 时允许再次发起支付。
- 在 `GET /pay/:token/status` 的状态说明中，明确其状态来源于 `payment_orders.status`。
- 统一全文状态大小写，只保留 H5 五态，不再出现 `pending / paid / failed` 这类旧态。
- 校对 `offline-payment` 与 `verify-cash` 的闭环描述，确保现金链路最终落到 `PENDING_VERIFICATION -> PAID`。

[tenant-api-doc.md](/D:/Sinhe/api/docs/api/tenant-api-doc.md)
- 在 `TenantOrder` 类型定义和订单详情响应中，保留并强调 `qrCodeToken` 来自订单表。
- 在 Orders 模块补一句：订单创建、订单导入时生成 `qrCodeToken`。
- 在 `POST /orders/print-records` 中，将 `requestId` 从“预留后续幂等控制”改为“建议必填，用于批次级幂等”。
- 在 `POST /orders/print-records` 的业务规则中新增：
  - 同一租户下，相同 `requestId` 的重复提交必须幂等返回首次结果。
  - `totalCount` 按去重后的 `orderIds` 计算。
- 在 `/settings/general` 的 GET/PUT 说明中补充：
  - GET 返回“平台默认值与租户覆盖值合并后的最终结果”。
  - PUT 只更新租户覆盖层，不直接修改平台默认层。
- 在打印配置接口 `/settings/printing*` 的说明中，补一句服务端持久化维度为 `tenantId + importTemplateId`。
- 在资质模块中，把 `QualificationStatus` 改为 `待初审 / 待复核 / 待确认 / 已通过 / 已驳回`，删除 `pending / approved / rejected`。
- 在现金核销 `POST /orders/{id}/verify-cash` 的说明中补充：成功后同步写入 `payments` 流水，并更新 `orders.paid / orders.status`。

[admin-api-doc.md](/D:/Sinhe/api/docs/api/admin-api-doc.md)
- 在跨租户订单详情说明中，补充 `qrCodeToken` 为订单公开访问入口字段，Admin 仅查看不生成。
- 在资质审核队列与审核接口中，统一使用 `待初审 / 待复核 / 待确认 / 已通过 / 已驳回`。
- 在涉及支付/订单状态的说明中，与 H5/Tenant 保持同一套状态语义，不再混用旧态。
- 若有展示 `payment_orders` 或支付状态的地方，明确 `EXPIRED` 可重发起。

**数据模型文档修订清单**

[data-model-reference.md](/D:/Sinhe/api/docs/prisma/data-model-reference.md)
- `orders` 表增加：
  - `qrCodeToken: string`
- `orders` 表补充约束说明：
  - `qrCodeToken` 唯一索引
  - 创建订单或导入订单时生成
- `payment_orders` 表调整：
  - `orderNo` 改为 `orderId`
  - `status` 改为 `UNPAID | PAYING | PENDING_VERIFICATION | PAID | EXPIRED`
  - 保留 `paymentMethod / channel / statusMessage / gatewayTradeNo / paidAt`
  - 增加 `lastInitiatedAt: string | null`
- `payment_orders` 表说明中补一句：
  - 允许 `EXPIRED` 状态下重新发起支付
- `printer_templates` 表重定义为黑盒配置模型：
  - 增加 `importTemplateId: string`
  - 增加 `config: any`
  - 增加 `configVersion: number`
  - 增加 `remark: string | null`
  - 增加 `updatedBy: string | null`
  - 删除或废弃 `paperWidth / paperHeight / fields / isDefault / name`
- `printer_templates` 表补充约束：
  - `(tenantId, importTemplateId)` 唯一索引
- 新增 `tenant_general_settings` 表：
  - `tenantId: string`
  - `companyName?: string`
  - `contactPerson?: string`
  - `contactPhone?: string`
  - `address?: string`
  - `licenseNo?: string`
  - `qrCodeExpiry?: number`
  - `notifySeller?: boolean`
  - `notifyOwner?: boolean`
  - `notifyFinance?: boolean`
  - `creditRemindDays?: number`
  - `dailyReportPush?: boolean`
  - `createdAt`
  - `updatedAt`
- `system_configs` 表说明修改为：
  - 平台默认配置源，不直接承担租户覆盖配置
- 新增 `print_record_batches` 表：
  - `id: string`
  - `tenantId: string`
  - `requestId: string`
  - `operatorId: string | null`
  - `orderIds: any`
  - `totalCount: number`
  - `successCount: number`
  - `remark: string | null`
  - `createdAt: string`
- `print_record_batches` 表补充约束：
  - `(tenantId, requestId)` 唯一索引
- `tenant_certifications.status` 保持：
  - `待初审 | 待复核 | 待确认 | 已通过 | 已驳回`
- 删除文档里任何与 `pending / approved / rejected` 对应的资质状态旧描述。

**建议的修订顺序**

1. 先改 [data-model-reference.md](/D:/Sinhe/api/docs/prisma/data-model-reference.md)，把 `orders`、`payment_orders`、`printer_templates`、`tenant_general_settings`、`print_record_batches` 定清。
2. 再改 [tenant-api-doc.md](/D:/Sinhe/api/docs/api/tenant-api-doc.md)，因为它承载了订单、支付、打印、设置、资质五条主链路。
3. 再改 [h5-api-doc.md](/D:/Sinhe/api/docs/api/h5-api-doc.md)，统一支付状态机与重发规则。
4. 最后改 [api-architecture-overview.md](/D:/Sinhe/api/docs/api/api-architecture-overview.md) 和 [admin-api-doc.md](/D:/Sinhe/api/docs/api/admin-api-doc.md)，做全局对齐与收口。

如果你要，我下一步可以直接按这个清单开始改文档。