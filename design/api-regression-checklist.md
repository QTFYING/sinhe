# API 回归与联调清单

> 日期：2026-04-11
> 文档状态：当前生效
> 文档定位：关键链路回归与联调清单
> 适用范围：`apps/api`、`docs/api`、Swagger 联调、阶段性回归
> 目标：为当前已完成主链路提供统一的回归点与联调记录基线，避免每次联调都重新口头梳理

## 一、使用原则

本清单用于记录两类内容：

1. 已纳入自动回归的关键规则点
2. 尚需人工联调验证的关键流程点

执行顺序：

1. 先跑自动回归
2. 再按本清单做人工联调
3. 联调发现的问题，优先回写到实现与设计文档，不单独散落在聊天记录里

## 二、当前自动回归覆盖

当前自动回归命令：

1. `pnpm -F api build`
2. `pnpm -F api test:smoke`
3. `pnpm -F api test:backend-regression`

当前 smoke 已覆盖以下规则点：

1. 导入 Worker 开关行为
2. 导入任务最终状态归并规则
3. 导入模板列头匹配规则
4. 导入订单 `payType / status` 推导规则
5. 导入订单摘要生成规则
6. 订单状态推导规则
7. 账期状态推导规则
8. H5 支付状态推导规则
9. `PAYING -> EXPIRED` 超时过期判定
10. 独立 `import-worker`、导入 helper、订单 helper、支付 helper 构建产物存在性

## 三、当前人工联调重点

以下链路尚需继续做更完整的人工联调记录。

### 3.1 Auth 登录链路

接口序列：

1. `POST /auth/login`
2. `POST /auth/refresh`
3. `GET /auth/profile`
4. `POST /auth/logout`

核对点：

1. `account + password` 登录成功后返回 `accessToken / refreshToken / expiresIn / user`
2. 平台账号返回 `side=platform`，租户账号返回 `side=tenant`
3. 刷新后旧 `refreshToken` 不再可用
4. 退出登录后旧 `refreshToken` 不再可用

### 3.2 导入预检与正式导入链路

接口序列：

1. `GET /import/templates`
2. `POST /import/preview`
3. `POST /import/jobs`
4. `GET /import/jobs/{jobId}`

核对点：

1. 不显式传模板时，系统能按列头命中数选择模板
2. 必填字段缺失时，`requiredFieldMissing / invalidRows` 返回合理
3. 同一 `sourceOrderNo` 的多行会被聚合成一张订单
4. `conflictPolicy=skip / overwrite` 的结果与任务统计一致
5. 导入正式提交后，任务状态能从 `pending / processing` 收口到最终态

### 3.3 订单主链路

接口序列：

1. `POST /orders`
2. `GET /orders`
3. `GET /orders/{id}`
4. `PUT /orders/{id}`
5. `PATCH /orders/{id}`
6. `POST /orders/{id}/reminders`
7. `POST /orders/{id}/receipts`

核对点：

1. 创建订单时 `status` 与 `amount / paid / payType` 保持一致
2. 已进入支付或入账流程的订单不允许直接修改
3. 已进入支付或入账流程的订单不允许作废
4. 账期订单回款后，`paid / status` 联动正确
5. 催款提醒落库后，审计日志同步生成

### 3.4 H5 支付链路

接口序列：

1. `GET /payments/{token}`
2. `POST /payments/{token}/initiate`
3. `GET /payments/{token}/status`
4. `POST /payments/{token}/offline`
5. `POST /payments/{token}/callbacks/lakala`
6. `POST /tenant/payments/cash-verifications/{orderId}`

核对点：

1. 二维码入口只依赖 `qrCodeToken`
2. 已支付订单不允许重复发起在线支付
3. 现金登记后状态进入 `pending_verification`
4. 现金核销后支付单状态变为 `paid`，订单实收金额同步增加
5. 拉卡拉回调重复到达时，不重复入账
6. `PAYING` 超时后可收口为 `expired` 并允许重新发起

### 3.5 打印回执链路

接口序列：

1. `POST /orders/print-records`

核对点：

1. 单条与批量都通过 `orderIds[]` 提交
2. 同租户下全部订单成功时，`successCount === totalCount`
3. 带 `requestId` 重放时，返回同一批次结果，不重复累加
4. 跨租户订单或无效订单 ID 会被拒绝

### 3.6 设置链路

接口序列：

1. `GET /settings/general`
2. `PUT /settings/general`
3. `GET /settings/printing`
4. `GET /settings/printing/{importTemplateId}`
5. `PUT /settings/printing/{importTemplateId}`

核对点：

1. `general` 采用“平台默认 + 租户覆盖”模型
2. 未配置打印模板时，返回 `hasCustomConfig=false`
3. 已配置模板时，返回黑盒 `config` 与版本号
4. 打印配置不支持删除，只支持覆盖更新

### 3.7 平台 Dashboard 链路

接口序列：

1. `GET /platform/console`
2. `GET /platform/metrics`
3. `GET /platform/todos`
4. `GET /platform/tenant-health`
5. `GET /platform/risk-events`
6. `GET /platform/overview`

核对点：

1. 平台账号登录后，`/platform/console` 返回产品名、角色名和当前操作人
2. `metrics`、`todos`、`tenant-health`、`risk-events` 在真实库为空或数据较少时也能返回合法结构
3. `tenant-health` 中健康度、账号覆盖率和异常提示之间口径自洽
4. `/platform/overview` 中 `totalTenants / newTenantsThisMonth / growth.dailyTrend / renewalRisks` 与同一时点库内数据口径一致
5. 平台侧接口不能被租户登录态成功访问

## 四、联调记录建议模板

每次联调建议至少记录以下内容：

1. 日期
2. 环境
3. 联调接口
4. 请求样例
5. 实际响应
6. 是否符合文档
7. 问题归属
8. 是否已修复

建议记录格式：

```md
## 2026-04-11 第 1 轮联调

- 环境：dev-local
- 接口：POST /payments/{token}/offline
- 结果：通过
- 备注：现金登记后状态正确进入 pending_verification
```

## 五、当前结论

当前项目已经具备“规则级自动回归 + 流程级人工联调清单”的基础。

下一步重点不是再补零散说明，而是：

1. 继续补关键链路的人工联调记录
2. 把发现的问题及时回写到实现和设计文档
3. 逐步把稳定的流程点从人工联调转入自动回归
