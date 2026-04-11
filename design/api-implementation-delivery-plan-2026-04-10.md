# API 文档驱动的后端落地计划

> 日期：2026-04-10
> 最近同步：2026-04-11
> 文档状态：当前生效
> 文档定位：总纲手册
> 适用范围：`docs/api`、`packages/types`、`docs/prisma/data-model-reference.md`、`apps/api`、`design`
> 目标：以当前标准 API 文档为起点，持续推进后端实现、联调产物与质量收口
> 配套手册：
> - `design/api-target-model-gap-analysis-2026-04-10.md`
> - `design/api-phase-1-execution-checklist-2026-04-10.md`
> - `design/api-interface-implementation-layer-checklist-2026-04-11.md`
> - `design/api-technical-debt-checklist-2026-04-11.md`

本手册用于定义事实源顺序、实施边界、阶段目标、当前进度、统一验收标准与下一阶段重点。
凡与实现顺序、模块优先级、旧链路清退范围和收口动作有关的判断，以本手册为准。

## 一、当前项目现状

截至 2026-04-11，项目已经从“文档先行、代码待重建”推进到“主链路已重建、进入联调与收口阶段”。

当前判断如下：

1. `docs/api/*.md`、`packages/types/src/enums`、`packages/types/src/contracts`、`docs/prisma/data-model-reference.md` 已形成当前事实源基线。
2. `apps/api` 已完成核心租户侧主链路重建，包含：
   - `Auth`
   - `settings/general`
   - `settings/printing`
   - Import Template / Import
   - Orders
   - H5 Payment
   - Print Records
3. `notification`、`report` 已完成最小可编译收口，不再维持旧 MVP 噪音状态。
4. 旧 `/print/jobs` 语义已退出主链路，打印域只保留打印配置与打印回执。
5. 金额库已统一到 `decimal.js`，`bignumber.js` 已退出代码依赖。
6. 当前 `pnpm -F api build` 与 `pnpm -F api test:smoke` 已通过，说明核心实现已具备继续联调和扩展的基础。
7. 当前剩余问题已不再是“主链路是否存在”，而是：
   - Swagger / OpenAPI 后续仍需随新增模块持续维护
   - 个别链路仍有阶段性技术债待收口
   - 下一批新增域仍需延续当前治理节奏

## 二、前置约束

本次后续实施继续遵守以下单向事实源关系：

1. `docs/api/*.md`
   业务语义事实源，定义接口、字段含义、流程与状态机。
2. `packages/types/src/enums`
   闭集枚举事实源，定义稳定英文值与中文注释。
3. `packages/types/src/contracts`
   只做请求、响应、资源结构投影，不得反向定义业务。
4. `docs/prisma/data-model-reference.md`
   只做服务端建模同步，不维护另一套冲突语义。
5. `apps/api`
   只负责按事实源落地实现，不得反向推动文档改义。
6. Swagger / OpenAPI
   只作为联调与可视化产物，不得升格为设计源。
7. `docs/archived/logic_diagram.md`
   仅作历史背景参考，不得覆盖当前 API 文档。

补充约束：

1. `design` 目录中的执行手册不是讨论稿，而是当前阶段的执行依据。
2. 若阶段边界、优先级、实现顺序发生变化，应直接更新原文件。
3. 不恢复旧 `/print/jobs`、旧 `payStatus`、旧 `erpOrderNo / templateId / customFields` 等已退出主链路的历史语义。

## 三、总体实施原则

当前阶段不再按“补主功能缺口”推进，而按“收口、联调、扩展平台侧能力”推进。

总体原则如下：

1. 已稳定的租户侧主链路，不再因为旧代码或历史命名回退语义。
2. 新增实现优先补齐平台侧能力、联调产物和工程化缺口，而不是重复重写已完成主链路。
3. 多租户隔离、金额正确性、状态机一致性继续高于局部交付速度。
4. 文档、枚举、contracts、数据模型参考、实现、Swagger 必须保持单向同步。
5. 技术债必须显式登记，不允许靠口头记忆留到后续。

## 四、阶段与进度总览

当前实施阶段已不再停留在原始计划的早期阶段，现按真实进度更新如下：

| 阶段 | 主题 | 当前状态 | 说明 |
|---|---|---|---|
| `M0` | 实施基线确认 | 已完成 | 事实源顺序、技能与手册已固化 |
| `M1` | Auth 可复用并与文档对齐 | 已完成 | 后台登录态可继续复用 |
| `M2` | Prisma 核心模型定稿 | 已完成 | 核心 schema 已可支撑主链路 |
| `M3` | 配置域打通 | 已完成 | `settings/general`、`settings/printing*` 已落地 |
| `M4` | 订单域闭环完成 | 已完成 | Orders 与 Import 已按新契约重建 |
| `M5` | 支付闭环完成 | 已完成 | H5 支付、线下登记、核销、回调链路已落地 |
| `M6` | 打印闭环完成 | 已完成 | `POST /orders/print-records` 已落地，旧打印任务语义已清退 |
| `M7` | 平台侧与外围域收口 | 已完成 | Admin 主域、Tenant 外围域、对账与资质审核链路已补齐 |
| `M8` | 联调产物与质量收口 | 已完成 | Swagger 第二轮、主链路补强与 build + smoke 基线已完成 |

## 五、已完成的阶段结论

以下阶段已完成，不再作为后续编码争议点：

### 5.1 `M1-M3`

已完成：

1. `Auth` 机制校准并保留为统一认证底座。
2. Prisma 核心模型重建。
3. 通用设置与打印配置模型落地。

结论：

1. 当前代码底座已不再依赖早期 MVP 的设置与认证语义。
2. 后续新增模块应直接复用现有认证、租户上下文和 Prisma 模型。

### 5.2 `M4-M6`

已完成：

1. Orders 主域重建。
2. Import Template / Import 链路重建。
3. H5 Payment 与 Tenant 收款补充链路重建。
4. Print Records 重建与 `/print/jobs` 清退。

结论：

1. 租户侧主业务闭环已经形成。
2. 后续主要工作不再是“先让租户侧能跑”，而是“让平台侧、联调产物和工程化能力跟上”。

## 六、最近完成阶段收口

### 6.1 `M7` 平台侧与外围域收口

收口目标：

1. 补齐 Admin 侧与主链路强相关的只读、审核、对账能力。
2. 收口 Tenant 侧仍未完全落地的外围接口。
3. 确保 `notification`、`report` 等已重建模块与当前数据模型口径一致。

收口范围：

1. Admin 订单 / 支付 / 对账只读接口
2. 租户审核、资质审核等平台动作
3. Tenant 设置外围域
4. 必要的通知与报表口径复核

收口结论：

1. Admin 订单 / 支付 / 对账只读能力已落地
2. Tenant `settings/users / roles / permissions / audit-logs` 已落地
3. `tenants/certification` 与 Admin 资质审核链路已落地
4. 平台侧与租户侧边界已在实现层收口

### 6.2 `M8` 联调产物与质量收口

收口目标：

1. 把已完成接口同步到 Swagger / OpenAPI。
2. 为核心链路补齐最小联调验证与阶段性质量门禁。
3. 对技术债进行优先级排序并回补必要项。

收口结论：

1. Auth、Settings、Import、Orders、Payment、Notifications、Analytics、Finance、Tenant/Admin 主域已补第一轮 Swagger 注解
2. `POST /orders/{id}/reminders` 已完成持久化建模与实现收口
3. 已完成 `prisma generate`、`pnpm -F api build` 与 `pnpm -F api test:smoke` 最小验证
4. 导入可靠性已进一步收口：API 进程默认不再消费导入任务，独立 `import-worker` 入口已落地

阶段验收结果：

1. Swagger 已完成两轮同步，当前模块请求/响应 schema 已可直接联调
2. 主链路已具备 build + smoke 级验证依据
3. 必要技术债已显式下沉到后续排期，而不是继续隐含存在

当前推进重点：

1. 关键链路补更完整的自测、回归与联调记录
2. 导入预检结果长期持久化策略
3. 模板自动匹配规则优化
4. Swagger 随新增域继续同步，不再形成单独积压批次

## 七、统一验收标准

每个阶段继续按以下 6 类标准复核：

1. 文档一致性
   `docs/api`、`enums`、`contracts`、`data-model-reference`、实现必须一致。
2. 编译通过性
   当前阶段涉及模块必须通过类型检查与构建。
3. 多租户隔离
   Tenant 接口默认按 `tenantId` 过滤，Admin 边界清晰。
4. 状态机自洽
   文档、实现、数据层存储值使用同一套语义。
5. 金额正确性
   涉及财务的阶段，金额累计、支付状态、订单实收必须自洽。
6. 历史残留清理
   当前阶段涉及的旧字段、旧状态、旧接口不应回流主链路。

每个阶段至少同步交付以下内容：

1. 受影响事实源的校对结果
2. 代码实现
3. 最小验证记录
4. 遗留项记录

## 八、Swagger / OpenAPI 同步策略

Swagger 继续需要同步，但定位保持不变：它是联调产物，不是设计源。

当前同步策略改为：

1. 先同步已完成的租户侧主链路：
   - Auth
   - Settings / General
   - Settings / Printing
   - Import Template / Import
   - Orders
   - H5 Payment / Payments
   - Print Records
2. 再同步平台侧已落地接口。
3. 每完成一个域的 Swagger，同步做一次文档、contracts、实现三方复核。

当前阶段的 Swagger 验收标准：

1. 路径与 `docs/api` 一致
2. 请求体与响应体与 contracts 一致
3. 不出现旧字段名和旧接口路径
4. 枚举值与 `packages/types/src/enums` 一致

## 九、当前主要风险

当前阶段的主要风险已经从“主链路无法实现”转为以下几类：

1. Swagger 第二轮已完成主链路与当前外围域细化；若后续新增模块不同步响应 schema，仍会再次产生漂移。
2. 导入预检结果长期持久化与模板自动匹配策略仍可能在测试环境暴露边界问题。
3. 若后续新增外围域未继续同步 contracts / Swagger，治理成果会再次回退。

## 十、旧模块处置策略

旧 MVP 模块当前采用以下策略：

1. `auth`
   已复用并完成校准，继续作为统一认证底座。
2. `order / import / payment`
   已按新契约完成重建，不再允许回退到旧字段主流程。
3. `print`
   旧实现已退出主线；不恢复 `/print/jobs`。
4. `notification / report`
   已完成最小可编译收口，后续仅按当前文档继续补齐，不再作为旧逻辑缓冲区。

## 十一、非目标与暂不处理范围

当前阶段明确不以以下事项为首要目标：

1. 不为兼容旧 MVP 数据而反向改义当前文档。
2. 不恢复任何已废弃接口与字段。
3. 不在未完成 Swagger 同步前就让 Swagger 反向影响 contracts 或文档。
4. 不在 Admin 主域未明确前，盲目铺开套餐、合同、工单、Ops 等外围实现。

## 十二、当前建议执行顺序

在完成本次 `design` 文档同步后，建议按以下顺序继续推进：

1. 关键链路补更完整的自测、回归与联调记录
2. 导入预检结果长期持久化策略
3. 模板自动匹配规则优化
4. Swagger 随新增域继续同步，不再形成单独积压批次

## 十三、最近回归记录

最近一次收口已完成以下验证：

1. `pnpm -F api build`
2. `pnpm -F api test:smoke`

当前 smoke 范围包括：

1. `IMPORT_JOB_WORKER_ENABLED` 开关行为
2. 导入任务最终状态归并规则
3. 独立 `import-worker` 构建产物存在性
4. 订单状态推导规则
5. 账期状态推导规则
6. H5 支付状态推导规则
7. `PAYING -> EXPIRED` 超时过期判定

当前运行约定补充如下：

1. Web API 进程继续使用 `pnpm -F api start:prod`
2. 导入任务 Worker 使用 `pnpm -F api start:import-worker`

## 十四、预期最终结果

当上述计划推进完成后，项目应达到以下状态：

1. 前端可直接依据 `docs/api + Swagger` 联调。
2. 后端可依据 `docs/api + enums + contracts + data-model-reference` 持续编码。
3. 租户侧主链路、平台侧主域、外围域边界清晰。
4. 技术债、联调产物和质量门禁都被纳入稳定节奏，而不是继续靠临时记忆推进。
