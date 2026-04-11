# 第一批实施任务清单

> 日期：2026-04-10
> 最近同步：2026-04-11
> 文档状态：已完成，保留为归档参考
> 文档定位：第一批执行手册
> 范围：第一批以“打稳后续编码底座”为目标
> 对应总计划：`M1 Auth`、`M2 Prisma`、`M3 配置域`

## 一、当前定位

本文件对应的第一批实施任务已经完成核心目标，不再作为当前活动阶段的执行清单。

保留本文件的目的只有两个：

1. 记录第一批的实际完成情况
2. 作为后续阶段回溯“底座是如何建立起来的”参考

当前正在生效的后续顺序，应以：

1. [api-implementation-delivery-plan-2026-04-10.md](/D:/Sinhe/api/design/api-implementation-delivery-plan-2026-04-10.md)
2. [api-interface-implementation-layer-checklist-2026-04-11.md](/D:/Sinhe/api/design/api-interface-implementation-layer-checklist-2026-04-11.md)
3. [api-technical-debt-checklist-2026-04-11.md](/D:/Sinhe/api/design/api-technical-debt-checklist-2026-04-11.md)

为准。

## 二、第一批目标回顾

第一批原始目标如下：

1. 后台登录链路可稳定复用
2. Prisma 核心模型完成重建
3. `settings/general` 与 `settings/printing*` 可落地
4. 导入模板和打印配置模型准备就绪
5. 后续订单域与支付域能够在稳定底座上继续推进

当前结论：

1. 上述 5 项核心目标均已达成
2. 第一批不仅完成了原始底座建设，后续还已经继续推进到订单、支付、打印回执主链路
3. 原计划中的 Swagger 第一轮同步未在第一批内完成，已转入当前收口任务

## 三、第一批执行结果总览

| 子批次 | 原目标 | 当前结果 |
|---|---|---|
| `P1` | Auth 小校准 | 已完成 |
| `P2` | Prisma 核心模型重建 | 已完成 |
| `P3` | Settings / General 落地 | 已完成 |
| `P4` | Settings / Printing 落地 | 已完成 |
| `P5` | Import Template 对齐 | 已完成 |
| `P6` | Swagger 第一轮同步 | 未在第一批内完成，已转入当前收口任务 |

## 四、已完成事项明细

### 4.1 `P1` Auth 小校准

已完成：

1. 统一后台登录态
2. 认证接口与当前文档口径对齐
3. 为后续所有后台接口提供可复用认证底座

### 4.2 `P2` Prisma 核心模型重建

已完成：

1. 核心 schema 重建
2. 金额字段、JSON 字段、唯一键与组合唯一重建
3. 为订单、支付、打印、设置域建立数据底座

### 4.3 `P3` Settings / General 落地

已完成：

1. “平台默认 + 租户覆盖”模型落地
2. `GET /settings/general`
3. `PUT /settings/general`

### 4.4 `P4` Settings / Printing 落地

已完成：

1. `GET /settings/printing`
2. `GET /settings/printing/:importTemplateId`
3. `PUT /settings/printing/:importTemplateId`
4. 黑盒打印配置与模板绑定模型落地

### 4.5 `P5` Import Template 对齐

已完成：

1. 导入模板模型与打印配置绑定键对齐
2. 为后续订单导入链路提供稳定模板基础

## 五、第一批的实际产出价值

第一批完成后，项目获得了以下稳定底座：

1. 统一认证机制
2. 可持续扩展的 Prisma 核心模型
3. 配置域与打印配置域
4. 导入模板与打印模板绑定关系

这也是后续订单、支付、打印回执能够继续推进的前提。

## 六、第一批遗留项

第一批没有完全在原计划内完成的事项如下：

1. Swagger 第一轮同步
2. 更系统化的联调产物整理

这些遗留项已不再单独归属于第一批，而是并入当前总计划中的：

1. `M7` 平台侧与外围域收口
2. `M8` 联调产物与质量收口

## 七、归档结论

本文件当前的结论应当固定为：

1. 第一批底座建设已经完成
2. 当前项目已实际进入更后续的实施阶段
3. 后续不再回到“先做 Auth / Prisma / Settings 底座”的讨论阶段
4. 若出现新的阶段清单，应直接围绕当前总纲中的活动阶段继续补充，而不是改写第一批目标
