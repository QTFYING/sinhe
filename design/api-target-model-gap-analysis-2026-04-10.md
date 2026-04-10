# API 目标模型差异清单

> 日期：2026-04-10
> 目标：识别当前仓库实现与现行 API 文档/枚举/contracts/数据模型参考之间的主要断层，为后续重构提供明确落点

## 一、使用说明

本清单只回答 4 个问题：

1. 当前实现是什么状态
2. 目标模型要求是什么
3. 差异具体在哪里
4. 后续应当“复用 / 改造 / 重写 / 暂缓”哪一类实现

本清单不替代 [api-implementation-delivery-plan-2026-04-10.md](/D:/Sinhe/api/design/api-implementation-delivery-plan-2026-04-10.md)，而是作为其编码前的差异桥接文档。

## 二、总体判断

当前仓库的断层不是局部字段不一致，而是以下 4 类问题叠加：

1. 业务文档已经定稿，但 `apps/api` 仍停留在早期 MVP 语义。
2. Prisma schema 仍使用旧模型，无法直接承载当前 API 文档。
3. 部分模块具备可复用骨架，但业务 service 已不适合作为事实源继续演进。
4. 某些外围模块当前甚至没有可靠数据模型支撑，应暂缓进入主线。

## 三、差异总表

| 领域 | 当前实现状态 | 目标状态 | 差异等级 | 处理策略 |
|---|---|---|---|---|
| Auth | 已联调成功，机制可用 | 与当前文档保持一致 | 低 | 复用并小幅校准 |
| Prisma 核心模型 | 仍是 MVP 结构 | 以当前 `data-model-reference` 为准 | 高 | 重写核心 schema |
| Settings / Printing | 文档已定，服务端尚未按新模型实现 | 支持“平台默认 + 租户覆盖”与黑盒打印配置 | 高 | 按新模型重写 |
| Orders | 旧字段、旧查询、旧状态残留明显 | 成为主数据源 | 高 | 重写主链路 service/controller |
| Import | 仍引用旧唯一键和旧字段名 | 与订单模型、导入模板模型一致 | 高 | 重写 |
| H5 Payment | 仍是 MVP 支付链路 | 落地 H5 五态 + `payment_orders` | 高 | 重写 |
| Print Records | 仍有 `/print/jobs` 思维残留 | 只保留打印配置与打印回执 | 高 | 重写 |
| Notification | 当前 schema 不支持 | 非主线 | 高 | 暂缓 / 冻结 |
| Report | 依赖旧订单支付模型 | 非主线 | 中 | 暂缓 |
| Swagger | 当前不是有效事实源 | 作为阶段产物同步 | 中 | 分阶段补齐 |

## 四、分领域差异分析

### 4.1 Auth

当前状态：

- 已实现 `JWT + Refresh Token + HttpOnly Cookie`
- 已具备 `login / refresh / logout / me`
- 已接入 Redis 黑名单与 refresh rotation

目标状态：

- 认证机制继续沿用
- 返回结构、角色类型、租户边界与当前 API 文档一致

核心差异：

1. 登录入参是否保留 `tenantId` 仍需以当前账号模型为准，但不应再扩散旧约束。
2. `role` 类型当前仍偏松，后续要与固定角色枚举对齐。
3. 需补充“用户状态 + 租户状态”校验，避免被冻结租户继续登录。

结论：

- `Auth` 不重写
- 作为第一批可复用底座处理

### 4.2 Prisma 核心模型

当前状态：

- `apps/api/prisma/schema.prisma` 仍基于旧 MVP 模型
- 订单、支付、打印、配置等核心表结构与当前文档不一致

目标状态：

- 以 `docs/prisma/data-model-reference.md` 为准
- 支撑订单、支付、设置、打印回执的当前链路

核心差异：

1. 缺少或未正确表达 `payment_orders`
2. `orders` 仍保留旧状态语义与旧字段残留
3. 打印配置与通用设置没有按当前设计建模
4. 打印回执幂等表未形成稳定模型

结论：

- Prisma 核心模型不能增量修补，应按当前目标模型重建

### 4.3 Settings / General

当前状态：

- 文档已明确“平台默认 + 租户覆盖”的两层模型
- 实现层尚未围绕该模型组织接口与持久化

目标状态：

- `GET /settings/general` 返回合并视图
- `PUT /settings/general` 只更新租户覆盖层

核心差异：

1. 当前代码层没有围绕“平台默认层”和“租户覆盖层”做职责划分
2. 配置字段与接口结构未形成稳定 DTO 投影

结论：

- 需按新设计重做 settings 模块中的 general 配置链路

### 4.4 Settings / Printing

当前状态：

- 历史方案中存在“打印机设置”与 `/print/jobs` 思维
- 当前文档已改为黑盒打印配置 + 打印回执

目标状态：

- `GET /settings/printing/list`
- `GET /settings/printing/:importTemplateId`
- `PUT /settings/printing/:importTemplateId`
- 服务端只存黑盒 JSON，不解析模板内部结构

核心差异：

1. 当前实现不是按 `tenantId + importTemplateId` 持久化
2. 旧打印接口仍带有“服务端组装打印数据”的语义
3. 新设计中不支持删除打印配置，只支持覆盖保存

结论：

- 打印配置链路应重写
- 旧 `/print/jobs` 语义退出主线

### 4.5 Orders

当前状态：

- 订单 service 仍依赖旧字段和旧查询逻辑
- 列表和详情仍混有 MVP 时期语义

目标状态：

- 订单作为全系统主数据源
- 创建、导入、列表、详情、调价、作废都围绕当前订单模型运转

核心差异：

1. 旧实现仍使用 `erpOrderNo`、`templateId`、`customFields`
2. 当前文档使用 `sourceOrderNo`、映射模板关联、`customFieldValues`
3. H5 入口字段 `qrCodeToken` 虽已出现，但尚未完整纳入订单闭环

结论：

- Orders 模块要按新文档重写主链路

### 4.6 Import

当前状态：

- 导入 service 仍按旧唯一键与旧字段入库
- 仍使用 `tenantId_erpOrderNo` 等旧索引命名

目标状态：

- 导入直接对齐当前订单模型
- 导入模板与打印模板、订单字段命名保持一致

核心差异：

1. 旧实现仍写入 `templateId / erpOrderNo / customFields`
2. 当前目标模型要求围绕 `sourceOrderNo / importTemplateId / customFieldValues`
3. 导入成功时需同步生成 `qrCodeToken`

结论：

- Import 模块重写，不做旧模型兼容补丁

### 4.7 H5 Payment

当前状态：

- 仍用旧 `payStatus` 思路驱动支付
- 主要逻辑聚焦在 `orders` 与 `paymentRecord`

目标状态：

- 落地 H5 五态：`unpaid / paying / pending_verification / paid / expired`
- 以 `payment_orders` 记录支付尝试，以 `payments` 记录确认入账

核心差异：

1. 状态机与当前文档不一致
2. 支付尝试层与入账流水层没有清晰拆分
3. `EXPIRED` 后重新发起的规则尚未按目标模型实现
4. 现金提交与财务核销链路未与当前文档完全对齐

结论：

- Payment 模块应重写，不按旧 `payStatus` 继续演化

### 4.8 Print Records

当前状态：

- 当前打印 service 仍提供旧“打印任务”语义

目标状态：

- 后端只接收打印成功回执
- 批次级幂等维度为 `tenantId + requestId`

核心差异：

1. 旧接口试图为前端生成打印数据
2. 当前设计明确放弃 `/print/jobs`
3. 打印回执批次模型尚未在实现层落地

结论：

- Print service 当前实现不保留，按新回执模型重写

### 4.9 Notification

当前状态：

- 当前 service 依赖的 Prisma 模型在现有核心 schema 中并不稳定

目标状态：

- 不属于本轮主链路首批交付

核心差异：

1. 数据模型不稳定
2. 不影响首批订单-支付-打印闭环

结论：

- 暂缓
- 必要时先从主线 build 范围中隔离

### 4.10 Report

当前状态：

- 报表天然依赖订单和支付事实表

目标状态：

- 建立在稳定订单与支付模型之上

核心差异：

1. 若当前先做报表，只会绑定旧模型

结论：

- 暂缓到主链路稳定后再做

## 五、旧链路清退对象

以下对象应明确退出主链路，不再作为未来扩展基础：

1. `/print/jobs`
2. `erpOrderNo`
3. `templateId`
4. `customFields`
5. 基于旧 `payStatus` 的支付主流程
6. 由服务端直接组装 `qrCodeUrl / paymentPageUrl` 的打印任务思路

## 六、处理策略总原则

### 6.1 可复用

- `Auth`
- NestJS 模块骨架
- Prisma / Redis / 异常处理接入

### 6.2 改造

- `Auth` 的角色/状态校准
- Swagger / OpenAPI 注解补齐

### 6.3 重写

- Prisma 核心业务模型
- Orders
- Import
- H5 Payment
- Printing Config
- Print Records

### 6.4 暂缓

- Notification
- Report
- 其余依赖主链路稳定后的外围域

## 七、结论

接下来的编码不应围绕“修旧代码”推进，而应围绕以下原则推进：

1. 复用基础设施，重写核心业务域
2. 先数据模型，再配置域，再订单域，再支付域，再打印闭环
3. 不让任何旧 MVP 字段重新成为主链路事实源

本清单可作为下一份执行文档的输入。
