# API 枚举与契约治理最终执行方案

> 适用范围：`packages/types`、`docs/api`、`docs/prisma`、`docs/enums`
> 目标：让前端直接看懂 API 文档，让后端可直接依据契约与枚举落代码，并固化后续维护规范
> 确认日期：2026-04-10

## 1. 本次调整的最终目标

本次不是做“兼容性修补”，而是一次性定稿 API 契约底座。

最终要达到：

1. `packages/types` 只保留 `enums`、`contracts`、`common` 三层
2. 删除 `packages/types/src/types`
3. `contracts` 不再承载枚举，只承载 API 入参、出参、资源契约
4. `enums` 成为唯一枚举事实源
5. 所有枚举契约值统一改为英文稳定值，彻底移除中文值
6. 三份 API 子文档正文自解释，前端不需要翻枚举手册才能联调
7. Prisma 文档只作为服务端建模参考，不再维护另一套冲突值
8. 新增 repo 内 skill，强制后续按该规范维护

## 2. 目录职责定版

### 2.1 `packages/types/src/enums`

唯一事实源，仅定义：

- 枚举对象 `XxxEnum`
- 枚举值类型 `Xxx`
- 中文注释

不定义：

- 请求结构
- 响应结构
- 页面 ViewModel

### 2.2 `packages/types/src/contracts`

仅定义 API 契约，包括：

- Request / Query / Path / Payload
- Response / Result
- 资源结构 DTO

要求：

- 直接引用 `../enums`
- 不再定义枚举
- 不再保留历史别名兼容层

### 2.3 `packages/types/src/common`

仅定义通用结构，例如：

- `ApiResponse<T>`
- `PaginatedResponse<T>`
- `ListParams`
- 其它真正跨模块复用的工具类型

### 2.4 删除 `packages/types/src/types`

原因：

- 现有 `types` 与 `contracts` 高度重复
- 会造成“契约层”和“页面类型层”混杂
- 在尚未大规模落代码前，删除这层最干净

## 3. 命名与值规范

### 3.1 命名规范

- 运行时枚举对象：`XxxEnum`
- 枚举值类型：`Xxx`
- API 契约类型：`XxxRequest` / `XxxResponse` / `XxxQuery` / `XxxItem`

禁止继续使用的旧名示例：

- `PayType`
- `H5PayOrderStatus`
- `PaymentMethodType`
- `PackageStatus`
- `QualificationStatus`

### 3.2 契约值规范

所有枚举值统一改为英文稳定值，不再使用中文值。

例如：

- `TenantSide = 'platform' | 'tenant'`
- `OrderStatus = 'pending' | 'partial' | 'paid' | 'expired' | 'credit'`
- `OrderPayType = 'cash' | 'credit'`
- `ReviewAction = 'approve' | 'reject'`
- `FreezeAction = 'freeze' | 'unfreeze'`
- `PaymentMethod = 'online' | 'cash' | 'other_paid'`
- `PaymentChannel = 'wx_jsapi' | 'ali_h5' | 'direct'`
- `TenantCertificationStatus = 'pending_initial_review' | 'pending_secondary_review' | 'pending_confirmation' | 'approved' | 'rejected'`
- `ContractType = 'electronic_signature' | 'archive_copy'`
- `ContractStatus = 'active' | 'pending_renewal' | 'pending_signing' | 'pending_archive' | 'terminated'`
- `InvoiceStatus = 'issued' | 'pending_issue' | 'reconciling' | 'voided'`
- `NoticeStatus = 'published' | 'draft' | 'offline'`
- `TicketStatus = 'pending' | 'processing' | 'resolved'`
- `ServiceProviderStatus = 'active' | 'trial'`

## 4. 注释要求

### 4.1 枚举代码注释

所有枚举必须补齐中文注释：

- 枚举对象前写中文说明
- 每个成员写中文说明

例如：

```ts
/**
 * 订单收款状态
 */
export const OrderStatusEnum = {
  /** 待收款 */
  PENDING: 'pending',
  /** 部分收款 */
  PARTIAL: 'partial',
  /** 已结清 */
  PAID: 'paid',
} as const
```

### 4.2 文档注释

API 文档正文必须直接给出：

- 字段含义
- 枚举真实值
- 中文语义
- 必要时补状态流转说明

目标是让前端不需要回头翻枚举字典。

## 5. 文档职责定版

### 5.1 `docs/api/tenant-api-doc.md`

前端主读文档。正文必须自解释：

- 首次出现关键枚举时直接展开真实值
- 后续字段可引用枚举名
- 不允许空代码块
- 不允许只引用类型名而正文无定义

### 5.2 `docs/api/admin-api-doc.md`

同上，作为 Admin 端主读文档。

### 5.3 `docs/api/h5-api-doc.md`

同上，作为 H5 端主读文档。

### 5.4 `docs/api/api-architecture-overview.md`

只做：

- 模块与端点总览
- 跨模块关系说明

不再承载详细类型定义。

### 5.5 `docs/prisma/data-model-reference.md`

只做服务端数据建模参考：

- 字段尽量引用最终枚举名
- 文档头部声明真实值以 `enums` 与 API 子文档为准
- 不再维护另一套冲突值

### 5.6 `docs/enums/enum-manual.md`

作为索引手册保留，但降级为辅助文档：

- 供统一查阅
- 不替代三份 API 子文档正文

## 6. `shared-enums.ts` 处理原则

如果前端不再需要单独拷贝 TS 文件，则删除。

如果仍需交付给前端，则只能保留为：

- 自动生成产物
- 或单纯转发导出

禁止继续手工维护。

本次优先按“删除手工维护文件”处理。

## 7. skill 固化要求

新增 repo 内 skill：

- 建议名称：`api-contract-governance`

skill 必须固化以下规则：

1. 先改 `packages/types/src/enums`
2. 再改 `packages/types/src/contracts`
3. 再改三份 API 子文档
4. 最后改 `overview` / `prisma` / `enum-manual`
5. 文档正文必须可独立阅读
6. 中文不得作为枚举契约值
7. 枚举必须带中文注释
8. 不允许新增 `src/types`
9. 不允许在 `contracts` 中定义枚举
10. 修改后必须做一致性扫描

## 8. 具体执行顺序

1. 新增本方案文档到 `review/`
2. 重构 `packages/types`
3. 删除 `src/types`
4. 新建/完善 `src/common`
5. 修正 `src/enums` 为最终英文契约值
6. 将 API 契约全部迁入 `src/contracts`
7. 修订三份 API 子文档
8. 修订 `overview` 与 `prisma`
9. 修订 `enum-manual`
10. 创建 skill 并固化流程
11. 进行最终一致性复核

## 9. 验收标准

满足以下条件才算完成：

1. `packages/types/src/types` 已删除
2. `packages/types/src/contracts` 不再定义枚举
3. 所有枚举值均为英文稳定值
4. 所有枚举都有中文注释
5. 三份 API 子文档无空代码块
6. 三份 API 子文档可独立阅读
7. 文档、枚举、契约不存在冲突值
8. repo 内 skill 已创建并可供后续沿用
