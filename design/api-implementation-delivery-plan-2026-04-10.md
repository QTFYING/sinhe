# API 文档驱动的后端落地计划

> 日期：2026-04-10
> 适用范围：`docs/api`、`packages/types`、`docs/prisma/data-model-reference.md`、`apps/api`
> 目标：以当前标准 API 文档为起点，重建后端实现基线，使前端可直接联调、后端可据此持续编码

## 一、项目现状

当前项目已经具备较稳定的接口设计基线，但后端业务实现仍停留在项目早期 MVP 阶段，两者存在明显断层。

现状判断如下：

1. `docs/api/*.md`、`packages/types/src/enums`、`packages/types/src/contracts`、`docs/prisma/data-model-reference.md` 已基本形成当前事实源。
2. `apps/api` 中的 `order / import / payment / print / notification` 等模块仍保留大量旧字段、旧状态机、旧接口语义。
3. 当前 `pnpm build` 报错属于预期现象，主要原因不是单点代码错误，而是旧 MVP 实现与当前 API 契约整体不一致。
4. `Auth` 模块是当前唯一真正联通过前端的链路，采用 `JWT + Refresh Cookie`，与当前 API 设计耦合较低，具备复用价值。
5. 目前应当将 `apps/api` 视为“可复用框架骨架”，而不是可直接增量修补的业务事实源。

## 二、前置约束

本次后端落地必须遵守以下单向事实源关系：

1. `docs/api/*.md`
   业务语义事实源，定义接口、字段含义、流程与状态机。
2. `packages/types/src/enums`
   闭集枚举事实源，定义稳定英文值与中文注释。
3. `packages/types/src/contracts`
   只做请求、响应、资源结构投影，不得反向定义业务。
4. `docs/prisma/data-model-reference.md`
   只做服务端建模同步，不维护另一套冲突语义。
5. `Swagger / OpenAPI`
   只作为联调与可视化产物，不得升格为设计源。
6. `docs/archived/logic_diagram.md`
   仅作历史背景参考，不得覆盖当前 API 文档。

## 三、总体实施原则

本次实施不按“修 build 报错”推进，而按“重建可持续开发底座”推进。

总体原则如下：

1. 先固化数据模型和契约，再落业务代码。
2. 先打通主链路，再补外围域。
3. 先保证多租户边界和金额正确性，再追求功能铺开。
4. 尽量复用基础设施骨架，例如 `Auth`、Nest 模块结构、Prisma 接入、Redis 接入、异常处理。
5. 不为兼容旧 MVP 语义而保留已废弃的主链路字段和接口。

## 四、任务拆解

本次实施拆为 7 个阶段，按“依赖顺序 + 业务闭环”推进。

### 阶段 0：实施基线冻结

任务范围：

- 固化当前 API 文档、枚举、contracts、skills 为实施基线
- 明确旧链路、旧模块、历史归档文档的使用边界
- 确认 Swagger 的同步策略与定位

预期结果：

- 团队在编码前对事实源顺序达成一致
- 不再围绕旧 MVP 字段和归档方案做设计拉扯

里程碑：

- `M0 实施基线确认`

验收标准：

- 事实源顺序明确且无冲突
- 归档文档不再被当成当前设计依据
- 已创建的 skill 可作为后续执行约束

### 阶段 1：认证链路校准

任务范围：

- 复用并校准 `Auth` 模块
- 对齐 `/auth/login`、`/auth/refresh`、`/auth/logout`、`/auth/me`
- 校准 JWT claims、租户状态校验、角色类型约束
- 明确平台用户与租户用户边界

预期结果：

- 后台接口拥有稳定可复用的统一登录态
- 后续所有后台模块都能基于统一 JWT 上下文开发

里程碑：

- `M1 Auth 可复用并与文档对齐`

验收标准：

- Auth 4 个接口与 API 文档一致
- JWT payload 能支撑平台/租户隔离
- 不继续扩散旧 `Auth` 兼容分支

### 阶段 2：Prisma 核心模型重建

任务范围：

- 重写 `apps/api/prisma/schema.prisma`
- 对齐核心模型与关系
- 对齐唯一键、组合唯一、索引、多租户字段

重点模型：

- `orders`
- `order_items`
- `payment_orders`
- `payments`
- `printer_templates`
- `tenant_general_settings`
- `print_record_batches`
- 导入模板相关表

预期结果：

- 建立与当前 API 文档一致的核心数据底座

里程碑：

- `M2 Prisma 核心模型定稿`

验收标准：

- Schema 与 `docs/prisma/data-model-reference.md` 一致
- Prisma Client 可正常生成
- 主查询、幂等、唯一约束有物理支撑

### 阶段 3：设置与配置基础域

任务范围：

- 落地 `/settings/general`
- 落地 `/settings/printing/list`
- 落地 `/settings/printing/:importTemplateId`
- 落地导入模板相关接口

预期结果：

- 平台默认 + 租户覆盖的配置模型可用
- 打印配置黑盒 JSON 读写可用
- 订单导入与打印闭环获得配置基础

里程碑：

- `M3 配置域打通`

验收标准：

- `/settings/general` 返回合并视图
- 打印配置按 `tenantId + importTemplateId` 持久化
- 未配置自定义打印模板时，前端可安全回退默认模板

### 阶段 4：订单主域

任务范围：

- 创建订单
- 导入订单
- 订单列表
- 订单详情
- 调价
- 作废
- `qrCodeToken` 生成与返回

预期结果：

- 订单成为后续 H5 支付和打印链路的统一主数据源

里程碑：

- `M4 订单域闭环完成`

验收标准：

- `orders` 字段与 API 文档一致
- 列表和详情不再使用旧字段
- 创建或导入订单时生成 `qrCodeToken`
- 旧 `erpOrderNo / templateId / customFields` 逻辑退出主链路

### 阶段 5：H5 支付域

任务范围：

- `GET /pay/:token`
- `POST /pay/:token/initiate`
- `POST /pay/:token/offline-payment`
- `GET /pay/:token/status`
- Tenant 侧现金核销
- 支付回调入账幂等

预期结果：

- H5 五态状态机真正落地
- `payment_orders + payments + orders.paidAmount` 三者联动成立

里程碑：

- `M5 支付闭环完成`

验收标准：

- H5 支付状态机与文档一致
- `EXPIRED` 后可重新发起支付
- 回调与人工核销口径一致
- 金额累计可解释、可追溯、可幂等

### 阶段 6：打印回执闭环

任务范围：

- 落地 `POST /orders/print-records`
- 实现批次级幂等
- 实现打印次数累加
- 清理旧 `/print/jobs` 语义

预期结果：

- 打印链路与当前业务重新对齐
- 后端只承担打印配置和打印回执职责

里程碑：

- `M6 打印闭环完成`

验收标准：

- 相同 `tenantId + requestId` 重复提交可幂等返回
- 打印次数只累计一次
- 不再输出旧的 `printJob / qrCodeUrl / paymentPageUrl` 聚合语义

### 阶段 7：Admin 与外围域收口

任务范围：

- Admin 订单/支付查看
- 资质审核
- 套餐/合同/发票
- 服务商/工单
- 审计日志
- 清理 `notification / report / 旧 print` 等遗留模块

预期结果：

- 平台侧能力在主链路稳定后逐步补齐
- 仓库整体进入可持续开发状态

里程碑：

- `M7 平台侧与外围域收口`

验收标准：

- Admin 与 Tenant 边界明确
- 主要旧字段、旧状态、旧路径已退出主链路
- 主域和外围域不再互相污染

## 五、阶段性里程碑总表

| 里程碑 | 含义 | 结果 |
|---|---|---|
| `M0` | 实施基线确认 | 文档、枚举、contracts、skills 固化为事实源 |
| `M1` | Auth 可复用并对齐 | 登录态成为统一底座 |
| `M2` | Prisma 核心模型定稿 | 核心 schema 可支撑主业务链路 |
| `M3` | 配置域打通 | 设置、导入模板、打印配置可用 |
| `M4` | 订单域闭环完成 | 订单成为统一主数据源 |
| `M5` | 支付闭环完成 | H5 五态和支付账务联动成立 |
| `M6` | 打印闭环完成 | 打印回执与幂等模型落地 |
| `M7` | 平台侧与外围域收口 | 系统进入稳定扩展阶段 |

## 六、统一验收标准

每个阶段都需要按以下 6 类标准复核：

1. 文档一致性
   `docs/api`、`enums`、`contracts`、`data-model-reference`、实现必须一致。
2. 编译通过性
   至少当前阶段涉及模块应能通过类型检查与构建。
3. 多租户隔离
   Tenant 接口默认按 `tenantId` 过滤，Admin 边界清晰。
4. 状态机自洽
   文档、实现、数据层存储值使用同一套语义。
5. 金额正确性
   涉及财务的阶段，金额累计、支付状态、订单实收必须自洽。
6. 历史残留清理
   当前阶段涉及的旧字段、旧状态、旧接口不应继续留在主链路。

## 七、Swagger / OpenAPI 同步策略

Swagger 需要同步，但定位必须明确：它是联调与可视化产物，不是设计事实源。

同步原则：

1. 先定 `docs/api` 和 `contracts`，再生成或补齐 Swagger。
2. Swagger 中的路径、请求体、响应体、枚举值必须服从文档。
3. Swagger 不得反向推动 API 文档改义。

建议同步时机：

1. `M1` 后同步 Auth
2. `M3` 后同步 Settings / Printing / ImportTemplate
3. `M4` 后同步 Orders / Import
4. `M5` 后同步 H5 Payment / Verify Cash
5. `M6` 后同步 Print Records
6. `M7` 后做一次全量 OpenAPI 复核

Swagger 验收标准：

- 路径与 API 文档一致
- 请求体与响应体与 contracts 一致
- 不出现旧字段名和旧接口路径
- 枚举值与 `packages/types/src/enums` 一致

## 八、风险清单

当前实施存在以下关键风险：

1. 旧 MVP 代码继续混入新主链路，导致字段与状态机再次漂移。
2. Prisma schema 与文档先后修改不一致，造成实现层误读。
3. 支付状态机与订单状态耦合过深，出现重复入账或状态覆盖。
4. 多租户边界校验不严，导致平台侧与租户侧串数据。
5. Swagger 若被过早维护，可能再次变成事实源竞争者。
6. `notification / report` 等旧模块若强行并入本次主链路，可能拖慢主线推进。

## 九、非目标与暂不处理范围

本轮实施明确不以以下目标为优先：

1. 不以兼容旧 MVP 数据结构为第一目标。
2. 不以“一次性让全仓库 build 全绿”为第一目标。
3. `docs/prisma/prisma.md` 暂不纳入本轮主线修订。
4. `notification`、`report` 等外围模块不作为第一批交付范围。
5. 不恢复已放弃的 `/print/jobs` 语义。

## 十、建议的执行顺序

建议按以下顺序正式实施：

1. 阶段 1：Auth 校准
2. 阶段 2：Prisma 核心模型重建
3. 阶段 3：设置与配置基础域
4. 阶段 4：订单主域
5. 阶段 5：H5 支付域
6. 阶段 6：打印回执闭环
7. 阶段 7：Admin 与外围域收口

## 十一、预期最终结果

当上述计划完成后，项目应达到以下状态：

1. 前端可直接依据 4 份 API 文档和 Swagger 联调。
2. 后端可依据 `docs/api + enums + contracts + data-model-reference` 持续编码。
3. 主业务链路不再受旧 MVP 命名和旧状态机牵制。
4. 多租户隔离、支付状态机、打印幂等、配置模型都具备稳定实现基线。
5. 项目进入“可持续开发”阶段，而不是继续停留在“边设计边救火”的状态。
