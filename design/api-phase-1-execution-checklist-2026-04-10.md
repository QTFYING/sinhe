# 第一批实施任务清单

> 日期：2026-04-10
> 范围：第一批落地以“可尽快进入编码并形成稳定主线”为目标
> 对应总计划：`M1 Auth`、`M2 Prisma`、`M3 配置域`

## 一、使用方式

本清单不是长期 roadmap，而是接下来真实编码时的执行顺序。

执行原则：

1. 一次只推进一个稳定闭环
2. 每完成一个子批次，就同步做最小验收
3. 未进入当前批次的模块，不主动扩散修改范围

## 二、第一批目标

第一批完成后，应达到以下状态：

1. 后台登录链路可稳定复用
2. Prisma 核心模型完成重建
3. `settings/general` 与 `settings/printing*` 可落地
4. 导入模板和打印配置模型准备就绪
5. 后续订单域与支付域能够在稳定底座上继续推进

## 三、执行顺序总览

| 子批次 | 目标 | 结果 |
|---|---|---|
| P1 | Auth 小校准 | 统一后台登录态 |
| P2 | Prisma 核心模型重建 | 可承载后续主链路 |
| P3 | Settings / General 落地 | 平台默认 + 租户覆盖可用 |
| P4 | Settings / Printing 落地 | 打印配置黑盒存储可用 |
| P5 | Import Template 对齐 | 导入模板与打印配置绑定基础可用 |
| P6 | Swagger 第一轮同步 | Auth + Settings 的联调产物可用 |

## 四、P1：Auth 小校准

### 目标

保留当前认证机制，但让其与当前 API 文档完全对齐。

### 任务

1. 校准登录入参与返回结构
2. 校准 `AuthMeResponse`
3. 校准角色类型引用，避免继续使用过宽的 `string`
4. 补充用户状态与租户状态校验
5. 复核 JWT claims 是否足以支撑平台/租户边界

### 涉及模块

- `apps/api/src/auth/*`
- `packages/types/src/contracts/auth.ts`
- 必要时联动 `packages/types/src/enums/*`

### 产出

- `/auth/login`
- `/auth/refresh`
- `/auth/logout`
- `/auth/me`

### 验收

- Auth 4 个接口与文档一致
- 登录后 JWT 中可区分平台用户与租户用户
- 租户被冻结或账号不可用时无法继续登录

## 五、P2：Prisma 核心模型重建

### 目标

建立一套可供后续订单、支付、打印配置、打印回执使用的核心 schema。

### 任务

1. 对齐 `orders`
2. 对齐 `order_items`
3. 新建或重构 `payment_orders`
4. 对齐 `payments`
5. 对齐 `tenant_general_settings`
6. 对齐 `printer_templates`
7. 对齐 `print_record_batches`
8. 对齐导入模板相关模型
9. 明确主键、唯一键、组合唯一、索引

### 重点约束

1. `orders.qrCodeToken` 必须唯一
2. 打印配置按 `tenantId + importTemplateId` 唯一
3. 打印回执批次按 `tenantId + requestId` 唯一
4. 金额字段统一 `Decimal`
5. 黑盒配置字段统一 `Json`

### 涉及模块

- `apps/api/prisma/schema.prisma`
- `docs/prisma/data-model-reference.md`

### 产出

- 可生成 Prisma Client 的新 schema
- 主链路可用的核心数据模型

### 验收

- Prisma Client 可生成
- schema 名称、字段与 `data-model-reference` 一致
- 不再保留无归属的旧主链路字段

## 六、P3：Settings / General 落地

### 目标

让通用配置链路先跑通，形成“平台默认 + 租户覆盖”的稳定配置模型。

### 任务

1. 落地 `GET /settings/general`
2. 落地 `PUT /settings/general`
3. 明确平台默认来源
4. 明确租户覆盖存储与读取逻辑
5. 对齐 contracts 与返回结构

### 业务规则

1. GET 返回合并后的最终结果
2. PUT 只更新租户覆盖层
3. 不允许租户直接改平台默认层

### 涉及模块

- `apps/api/src/tenant` 或新 settings 模块
- `packages/types/src/contracts/settings.ts`

### 验收

- 前端无需自行合并配置
- 返回字段与文档一致
- 平台默认和租户覆盖职责明确

## 七、P4：Settings / Printing 落地

### 目标

让打印配置按当前设计可读可写，且不再承载历史“服务端打印任务”语义。

### 任务

1. 落地 `GET /settings/printing/list`
2. 落地 `GET /settings/printing/:importTemplateId`
3. 落地 `PUT /settings/printing/:importTemplateId`
4. 按 `tenantId + importTemplateId` 维护配置
5. 保持 `config` 为黑盒 JSON

### 业务规则

1. 不支持删除
2. 未配置自定义模板时，由前端回退默认模板
3. 服务端不解析模板内部结构

### 涉及模块

- 新 `settings/printing` 相关 controller / service
- `packages/types/src/contracts/settings.ts`

### 验收

- 列表接口、详情接口、保存接口全部与文档一致
- 黑盒配置保存和读取成立
- 不再出现 `/print/jobs` 风格接口耦合

## 八、P5：Import Template 对齐

### 目标

让导入模板和打印配置形成稳定绑定基础。

### 任务

1. 对齐导入模板基础模型
2. 校准导入模板列表、详情、更新结构
3. 明确与打印配置的绑定键是 `importTemplateId`

### 业务规则

1. 每张映射模板可绑定一套打印配置
2. 若无自定义打印配置，则前端使用默认模板

### 涉及模块

- Import Template 相关 schema
- 对应 contracts

### 验收

- 导入模板主键和打印配置绑定关系清晰
- 后续订单导入和打印配置可以围绕同一标识继续开发

## 九、P6：Swagger 第一轮同步

### 目标

把第一批已完成的模块同步到 Swagger / OpenAPI，供前端和后端共同校验。

### 任务

1. 同步 Auth Swagger
2. 同步 Settings / General Swagger
3. 同步 Settings / Printing Swagger
4. 同步 Import Template Swagger

### 原则

1. 先文档、再 contracts、再实现、最后 Swagger
2. Swagger 只做产物，不反向定义接口

### 验收

- Swagger 中路径、请求体、响应体与文档一致
- 不出现旧字段和旧路径
- 枚举值与 `packages/types/src/enums` 一致

## 十、第一批不做的事项

第一批明确不进入以下开发范围：

1. 订单主域完整实现
2. H5 支付域完整实现
3. 打印回执完整实现
4. Report
5. Notification
6. Admin 外围域

## 十一、第一批完成判定

当以下条件全部满足时，第一批可以判定完成：

1. Auth 已稳定可复用
2. Prisma 核心 schema 已对齐当前设计
3. `settings/general` 已可联调
4. `settings/printing*` 已可联调
5. Import Template 绑定基础已对齐
6. 第一轮 Swagger 已同步

## 十二、第一批完成后的下一步

第一批完成后，立即进入第二批：

1. Orders 主域
2. Import 正式导入链路
3. H5 Payment
4. Print Records

届时应再补一份“第二批实施任务清单”，避免一次性把所有域混在一起推进。
