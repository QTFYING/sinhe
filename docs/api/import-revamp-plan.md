# 导入链路改造落地方案

## 1. 目标

本方案用于统一本仓库导入链路后续落地口径，覆盖以下两类改造：

- 租户级导入一致性控制
- 映射模板字段结构扩展

本方案书是实现前的事实存档，服务端实现、契约、枚举与文档应按本文同步。

## 2. 本轮确认决策

### 2.1 导入一致性

- 采用 `Tenant.importRevision` 单字段方案作为租户级导入代际号
- `importRevision` 为独立递增值，不基于时间，不基于订单数量
- `POST /import/preview` 生成的预检快照需绑定当前租户 `importRevision`
- `POST /orders/import` 成功创建 `jobId` 后，服务端原子推进 `Tenant.importRevision += 1`
- 同一租户同一时刻最多允许 1 个活动导入任务，即 `pending / processing`
- 旧 `previewId` 不做局部剔除；若其绑定的 `importRevision` 已落后于租户最新值，则整体判定为失效并要求重新预检

### 2.2 预检输入上限

- `/import/preview` 单次请求体最大 `20 MB`
- `/import/preview` 单次最多允许 `5000` 条订单
- `/import/preview` 单次最多允许 `50000` 条订单明细行

### 2.3 映射模板字段结构

- 映射模板字段新增 `type` 元数据
- `type` 为字段级属性，不是模板级属性
- `type` 闭集固定为：
  - `list`：字段来源于订单头/列表行
  - `line`：字段来源于订单明细行
- `type` 默认值为 `list`
- 本轮 `type` 仅用于模板持久化与回传，不参与服务端预检、导入、订单生成逻辑

## 3. 默认映射模板

### 3.1 订单头字段

以下字段属于订单头字段，`type=list`，且 `isRequired=true`：

- `sourceOrderNo`：源订单号
- `customer`：客户名称
- `customerPhone`：客户电话
- `customerAddress`：客户地址
- `totalAmount`：总金额
- `orderTime`：下单时间
- `payType`：结算方式

### 3.2 订单明细字段

以下字段属于订单明细字段，`type=line`，且 `isRequired=false`：

- `skuName`：商品名称
- `skuSpec`：商品规格
- `unit`：单位
- `quantity`：数量
- `unitPrice`：单价（元）
- `lineAmount`：行金额（元）

### 3.3 默认模板总规则

- `GET /import/default-template` 固定返回上述 13 个系统字段
- `POST /import/templates` 与 `PUT /import/templates/{id}` 中，`defaultFields` 必须完整包含上述 13 个系统字段
- 系统字段的 `key / label / isRequired / type` 由服务端基准定义，不允许由租户改写
- 租户只允许填写系统字段的 `mapStr`

## 4. 预检与正式导入

### 4.1 预检

- `POST /import/preview` 仍为同步接口
- 预检成功后返回 `previewId`
- 预检快照缓存在 Redis，并在快照结构中记录当前租户 `importRevision`

### 4.2 正式导入

`POST /orders/import` 应按以下顺序校验：

1. 当前租户是否已有活动导入任务
2. `previewId` 是否存在且未过期
3. `previewId` 绑定的 `importRevision` 是否仍等于租户当前 `importRevision`

校验通过后：

1. 创建 `import_job`
2. 推进 `Tenant.importRevision += 1`
3. 删除 Redis 中被消费的预检快照

### 4.3 失效语义

若两个用户基于同一租户同时完成预检并各自持有 `previewId`：

- 第一个成功提交正式导入的用户会推进租户 `importRevision`
- 之后其余旧 `previewId` 再提交时，服务端应判定为“预检结果已失效”
- 旧 `previewId` 不进行内容重写、局部剔除或自动覆盖

## 5. 需同步的事实源

本方案涉及以下事实源同步：

1. `docs/api/tenant-api-doc.md`
2. `docs/api/api-architecture-overview.md`
3. `packages/types/src/enums`
4. `packages/types/src/contracts`
5. `docs/enums/enum-manual.md`
6. `docs/prisma/data-model-reference.md`

## 6. 落地顺序

1. 先改 `docs/api`
2. 再改 `packages/types/src/enums`
3. 再改 `packages/types/src/contracts`
4. 再同步 `docs/enums/enum-manual.md`
5. 最后落服务端实现与 Prisma migration
