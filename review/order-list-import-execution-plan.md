# 订单列表/导入联动改造执行方案

> 创建日期：2026-04-08
> 适用范围：`apps/tenant`
> 关联文档：
> - `./order-import-prompt.md`
> - `./order-self-prompt.md`
> - `../api-contract.md`

## 1. 目标

在现有 `http://localhost:5002/#/orders/list` 与 `orders/import` 基础上，完成一套可闭环的订单列表与导入联动方案，覆盖以下能力：

- 订单列表按 ERP 源订单维度聚合展示
- 列表与详情支持模板驱动字段文案映射
- 导入流程支持模板管理、预检、冲突处理、异步任务查询
- mock 覆盖主流程与边界场景
- 前后端职责清晰，避免前端承担不稳定的聚合与导入判定逻辑

## 2. 现状判断

当前前端实现仅覆盖原型能力，不足以直接承接本次需求：

- `orders/list` 仍是基础订单列表，缺少源订单号、聚合明细、自定义字段映射
- `orders/import` 仍是本地 state 驱动的原型流程，未接入模板管理、预检、异步任务
- shared 订单类型与 API 模块仍是平铺订单模型
- 当前 mock 仅覆盖 `GET /orders` 的基础返回，无法支撑模板、预检、任务、回款、提醒等场景

结论：

- 本次改造不能仅做页面层补丁
- 必须先补充一份执行方案，并以此为后续类型、mock、repository、hook、页面改造的统一基线
- 不直接修改 `apps/tenant/docs/api-contract.md`，仅在实现阶段按现有契约加补充设计落地

## 3. API 契约评估

现有契约中，以下端点可以继续沿用：

- `GET /orders`
- `GET /orders/{id}`
- `POST /orders/import`
- `GET /orders/import/jobs/{jobId}`
- `GET /import/templates`
- `POST /import/templates`
- `PUT /import/templates/{id}`
- `POST /orders/{id}/remind`
- `POST /orders/{id}/mark-received`

但现有契约的模型定义仍不足以支撑需求闭环，主要差距如下：

- `TenantOrder` 结构缺少 `sourceOrderNo`、聚合标识、商品明细、模板关联、自定义字段值
- `/import/templates` 只有端点，没有完整模板结构定义
- `/import/preview` 没有请求与响应结构，无法表达预检结果
- `/orders/import/jobs/{jobId}` 没有导入任务报告结构
- 列表接口未明确“按聚合订单分页”还是“按原始商品行分页”

## 4. 服务端配合清单

以下能力是本方案形成闭环的前提。

### 4.1 必须新增

#### A. 订单模型升级

服务端返回的订单模型至少补充以下字段：

- `sourceOrderNo`: ERP 源订单号
- `groupKey` 或等价聚合标识
- `lineItems[]`: 同一源订单下的商品明细
- `customFieldValues`: 模板驱动字段值，使用 canonical key 返回
- `mappingTemplateId` 或等价模板关联字段

建议附带：

- `sourcePlatform`
- `importBatchId`
- `importedAt`

#### B. 列表接口按聚合订单分页

`GET /orders` 必须按聚合订单返回，不应按原始商品平铺行返回。

最低要求：

- 按 `sourceOrderNo` 完成服务端聚合
- `total` 表示聚合订单总数
- `keyword` 同时支持检索系统订单号、源订单号、客户名称
- 过滤条件与聚合结果保持一致

#### C. 模板接口返回完整模板结构

`/import/templates` 至少需要包含：

- 模板基础信息：`id`、`name`、`isDefault`
- Excel 列定义
- 字段映射：`sourceColumn -> targetField`
- 字段展示配置：`label`、`visible`、`order`、`required`、`fieldType`
- 自定义字段定义

#### D. 预检接口返回结构化结果

`POST /import/preview` 至少需要返回：

- `previewId` 或等价一次性预检标识
- 自动匹配模板或匹配结果
- `summary`: 总行数、有效行数、聚合后订单数、重复数、错误数
- `aggregatedOrders[]`: 聚合后的预览订单
- `invalidRows[]`: 行级错误
- `duplicateOrders[]`: 重复订单识别结果
- `requiredFieldMissing[]`

#### E. 导入任务结果可追踪

`POST /orders/import` 与 `GET /orders/import/jobs/{jobId}` 需要共同支持：

- 任务状态：`PENDING | PROCESSING | COMPLETED | FAILED`
- `submittedCount`
- `processedCount`
- `successCount`
- `skippedCount`
- `overwrittenCount`
- `failedCount`
- `failedRows[]`
- `conflictDetails[]`

### 4.2 建议增强

- 支持默认模板或最近使用模板
- 支持按 `templateId` 过滤订单
- 导入结果保留 `importBatchId`
- 明确重复判定规则，例如 `tenantId + sourceOrderNo`
- 详情、提醒、标记回款统一以聚合订单为主对象，而不是明细行对象

## 5. 前端实施边界

前端负责：

- 浏览器端解析 Excel
- 模板选择、字段映射、字段文案展示
- 调用预检接口并渲染错误/重复/预览结果
- 调用正式导入接口并轮询任务状态
- 列表、详情、提醒、回款、打印等交互编排

前端不负责：

- 最终聚合口径定义
- 正式重复判定
- 分页后再聚合
- 导入任务结果落库与追踪

说明：

- 前端可以在上传阶段做轻量清洗与辅助聚合预览
- 但最终以服务端聚合结果和导入结果为准

## 6. 前端改造方案

### 6.1 订单列表页

改造目标：

- 新增源订单号展示
- 列表按聚合订单展示
- 自定义字段标题按模板映射显示
- 账期订单展示“发送提醒”“标记回款”
- 详情抽屉展示完整商品明细

页面行为：

- 顶部增加模板选择器
- 列表按当前模板渲染字段文案
- 详情中拆分为“基本信息 + 商品明细 + 自定义字段”

### 6.2 导入页

导入流程采用五步闭环：

1. 浏览器解析 Excel 原始文件
2. 获取模板列表并完成映射编辑
3. 调用 `/import/preview` 做预检
4. 用户确认冲突策略后调用 `/orders/import`
5. 轮询 `/orders/import/jobs/{jobId}` 直到完成

关键交互：

- 无模板时提示先创建模板
- 预检出现重复订单时允许选择“跳过”或“覆盖”
- 导入完成后展示成功/失败/跳过摘要，并回跳订单列表

### 6.3 数据分层

遵循仓储分层，不在页面层直接调 API：

- `page -> hook -> repository -> @sinhe/shared/api`

后续改造会覆盖以下层：

- `packages/shared/src/types/order.ts`
- `packages/shared/src/api/modules/order.ts`
- `apps/tenant/src/features/orders/types/*`
- `apps/tenant/src/features/orders/repositories/*`
- `apps/tenant/src/features/orders/hooks/*`
- `apps/tenant/src/features/orders/components/*`

## 7. Mock 方案

mock 统一收敛在订单域，优先扩展 `apps/tenant/mock/order.mock.ts`。

需覆盖场景：

- 聚合订单列表
- 订单详情含多条 `lineItems`
- 模板列表为空
- 模板列表存在多套模板
- 预检成功
- 预检部分失败
- 存在重复订单，要求选择覆盖或跳过
- 导入任务正常完成
- 导入任务部分成功
- 发送提醒成功
- 标记回款全额成功
- 标记回款部分成功

## 8. 执行顺序

后续实施按以下顺序推进：

1. 补 shared 订单类型与 API 模块
2. 扩展 tenant mock，先把接口与场景补齐
3. 改造 repository 与 hooks，统一数据流
4. 改造 `orders/list` 页面与详情展示
5. 改造 `orders/import` 页面流程
6. 联调提醒、回款、打印等附属操作
7. 做类型检查与 tenant 构建验证

## 9. 验收标准

- 订单列表能够按源订单聚合展示
- 列表与详情能够按模板显示字段文案
- 导入支持模板管理、预检、重复处理、异步任务查询
- mock 覆盖主流流程和边界情况
- 代码符合 tenant 现有分层规范
- 不在页面层直接调用 API
- 类型与构建校验通过

## 10. 当前结论

本方案可以形成闭环，但前提是服务端补齐“聚合订单模型、模板结构、预检结果、导入任务结果”这四类基础能力。

在此基础上，前端才适合进入下一阶段实施：

- 先补类型与 mock
- 再接 repository / hook
- 最后完成列表页与导入页改造
