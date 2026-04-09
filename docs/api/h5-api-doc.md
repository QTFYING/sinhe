# H5 客户支付端 — API 接口契约文档

> 本文档为 H5 移动支付页面的前后端接口契约依据。
> 生成日期：2026-04-07

---

## 通用约定

> [!NOTE]
> **全局规范指引**
> 关于统一下发的 `code/data/message` 响应体包装、全局 `Http Status` 说明、环境变量指引以及 UTC 时区要求，在此文档内不再赘述，请统一参阅大本营 **[api-architecture-overview.md]** 的第二章。

---

## 端点总览

| # | Method | Path | 说明 |
|---|--------|------|------|
| 1 | GET | `/pay/:token` | 获取订单支付详情 |
| 2 | POST | `/pay/:token/initiate` | 发起在线支付（跳转收银台） |
| 3 | POST | `/pay/:token/offline-payment` | 线下支付登记（现金/其他已付） |
| 4 | GET | `/pay/:token/status` | 轮询支付状态 |

共计 **4** 个端点。

---

## 1. 获取订单支付详情

- **GET** `/pay/:token`
- **描述**：根据令牌获取支付页面所需的完整订单信息，包括商户、客户、商品明细、支付状态等
- **是否鉴权**：否（token 即凭证）

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| token | string | URL 中的 qrCodeToken 短串 |

### 响应 data

```typescript
{
  orderNo: string              // 订单号
  merchant: string             // 商户名称，如 "某某酒水批发"
  customer: string             // 客户名称，如 "好再来餐饮"
  amount: number               // 订单总金额（元）
  paidAmount: number           // 已付金额（元），默认 0
  summary: string              // 商品摘要，如 "五粮液×2等3件"
  date: string                 // 下单时间，如 "2026-03-25 09:30"
  status: PaymentOrderStatus   // 支付状态（见下方类型定义）
  statusMessage?: string       // 状态说明文案（如失败原因）
  servicePhone?: string        // 客服电话（失败状态下展示）

  selectedPaymentMethod: PaymentMethodType | null
  offlinePayment: OfflinePaymentInfo | null

  items: Array<{
    itemId: string             // 行项目 ID
    skuId?: string | null      // 可选的商品主数据 ID，当前版本可为空
    skuName: string            // 商品名称，如 "五粮液"
    skuSpec?: string           // 规格，如 "52度 / 500ml"
    unit: string               // 单位，如 "箱"
    quantity: number            // 数量
    unitPrice: number           // 单价（元）
    lineAmount: number          // 行金额（元）= quantity × unitPrice
  }>
}
```

### 错误场景

| code | 场景 |
|------|------|
| 1002 | token 令牌过期 |
| 40401 | 令牌无效，对应的订单不存在 |

---

## 2. 发起在线支付

- **POST** `/pay/:token/initiate`
- **描述**：请求后端发起在线支付。后端将向第三方（如拉卡拉）统一下单，并返回原生收银台转跳链接。
- **是否鉴权**：否

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| token | string | URL 中的 qrCodeToken 短串 |

### 请求参数

*（无，实际支付金额由服务端订单状态算定，不允许前端指定）*

### 响应 data

```typescript
{
  cashierUrl: string           // 支付网关原生收银台链接，H5前端应直接执行 window.location.href 跳转
  orderId: string              // 业务系统订单 ID
  payableAmount: string        // 此次发起支付的金额元单位，如 "1480.00"
}
```

### 错误场景

| code | 场景 |
|------|------|
| 1001 | 订单已支付完毕（PAID），不允许重复发起 |
| 1003 | 正在支付中（PAYING），禁止产生并发单 |
| 40401 | 订单凭证不存在 |
| 50001 | 支付网关统一下单调度失败 |

### 业务规则

- 仅状态为 `UNPAID` 与 `EXPIRED` 的订单可以由本路由成功发起在线支付。
- 成功下发收银台 URL 的同时，后端将订单状态迁移为 `PAYING`。
- H5 前端获取到 `cashierUrl` 后直接跳转，在用户完成支付关掉页面后，利用 `/pay/:token/status` 的轮询检查最终核实。

---

## 3. 线下支付登记

- **POST** `/pay/:token/offline-payment`
- **描述**：登记线下支付信息（现金支付或其他方式已支付），不走支付网关
- **是否鉴权**：否

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| token | string | URL 中的 qrCodeToken 短串 |

### 请求参数

```typescript
{
  paymentMethod: OfflinePaymentMethod  // 'cash' | 'other_paid'
  remark?: string                      // 备注（现金支付时必填）
}
```

### 响应 data

```typescript
{
  orderNo: string
  status: PaymentOrderStatus
  statusMessage?: string
  selectedPaymentMethod: PaymentMethodType | null
  offlinePayment: OfflinePaymentInfo | null
}
```

### 错误场景

| code | 场景 |
|------|------|
| 40001 | paymentMethod 不是合法值 |
| 40002 | 现金支付时 remark 为空 |
| 40401 | 订单不存在 |
| 40402 | 订单状态不是 `UNPAID`，不允许操作 |

### 业务规则

| 支付方式 | 状态流转 | 说明 |
|---------|---------|------|
| `cash` | UNPAID → **PENDING_VERIFICATION** | 提交后等待 Tenant 财务核销 |
| `other_paid` | UNPAID → **PAID** | 直接标记为已完成 |

- `cash` 方式必须填写 remark（备注），不可为空
- `other_paid` 方式 remark 可选
- 提交成功后，响应中返回更新后的订单状态和 offlinePayment 信息

---

## 4. 轮询支付状态

- **GET** `/pay/:token/status`
- **描述**：在线支付发起后，前端轮询此接口等待支付网关异步回调结果
- **是否鉴权**：否

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| token | string | URL 中的 qrCodeToken 短串 |

### 响应 data

```typescript
{
  orderNo: string
  status: PaymentOrderStatus
  statusMessage?: string
  paidAmount?: number          // 已付金额（支付完成时返回）
  paidAt?: string              // 支付完成时间（支付完成时返回）
  selectedPaymentMethod?: PaymentMethodType
}
```

### 前端轮询策略

```
间隔：2 秒
最大次数：60 次（共 2 分钟）
终止条件：status 变为 PAID 或 PENDING_VERIFICATION
超时处理：提示用户"支付结果确认中，请稍后刷新查看"
```

### 时序图

```text
H5 前端                      后端                        第三方收银台（拉卡拉等）
  │                          │                           │
  │  POST /initiate          │                           │
  │─────────────────────────▶│  统一下单拿到跳转url       │
  │                          │──────────────────────────▶│
  │  { cashierUrl }          │                           │
  │◀─────────────────────────│◀──────────────────────────│
  │                          │                           │
  │  执行 window.location = cashierUrl ─────────────────▶│
  │                          │                           │
  │          (用户支付完成或取消，前端重新返回当前页面)        │
  │                          │                           │
  │  GET /status (轮询)        │  网关异步 Webhook 回调    │
  │─────────────────────────▶│◀──────────────────────────│
  │  { status: 'PAYING' }    │  验证签名并落库            │
  │◀─────────────────────────│                           │
  │  GET /status (轮询)        │                           │
  │─────────────────────────▶│                           │
  │  { status: 'PAID' }      │                           │
  │◀─────────────────────────│                           │
  │  展示支付终态或待核销     │                           │
```

---



---

## 类型定义汇总

### PaymentOrderStatus（支付状态）

```typescript
type PaymentOrderStatus = 'UNPAID' | 'PAYING' | 'PENDING_VERIFICATION' | 'PAID' | 'EXPIRED'
```

| 状态 | 中文 | 说明 | H5 页面展示 |
|------|------|------|------------|
| `UNPAID` | 待支付 | 初始状态，等待用户去支付 | 蓝色面板，"去支付"按钮可点 |
| `PAYING` | 支付中 | 已通过 `/initiate` 发起跳转，等待网关异步回调 | 黄色面板，展示"支付确认中" |
| `PENDING_VERIFICATION` | 待核销 | 线下现金支付已登记，等待 Tenant 财务核销 | 橙色面板，"订单待核销" |
| `PAID` | 已完成 | 支付成功或已通过其他方式确认全款 | 绿色面板，"订单已完成" |
| `EXPIRED` | 已作废/过期 | 超时未付或商户作废订单产生此状态 | 灰色面板，无法进行交互动作 |

### 状态流转图

```text
                    ┌─────────┐
                    │ UNPAID  │
                    └────┬────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
     ┌────────────┐ ┌─────────┐ ┌──────────────────────┐
     │ initiate   │ │ offline │ │ offline              │
     │ (在线转跳)  │ │ (现金)  │ │ (其他方式已付)        │
     └─────┬──────┘ └────┬────┘ └──────────┬───────────┘
           │              │                 │
           ▼              ▼                 ▼
     ┌───────────┐ ┌─────────────────┐ ┌────────┐
     │ PAYING    │ │ PENDING_        │ │ PAID   │
     │           │ │ VERIFICATION    │ └────────┘
     └─────┬─────┘ └────────┬────────┘
           │                │
           ▼(Webhook回调)   ▼ (Tenant 财务核实)
     ┌───────────┐    ┌──────────┐
     │   PAID    │    │  PAID    │
     └───────────┘    └──────────┘
```

### PaymentMethodType（支付方式）

```typescript
type PaymentMethodType = 'online' | 'cash' | 'other_paid'
```

| 值 | 中文 | 说明 |
|----|------|------|
| `online` | 在线支付 | 微信/支付宝在线支付 |
| `cash` | 现金支付 | 需填写备注，Tenant 财务核销后完成 |
| `other_paid` | 其他方式已支付 | 仅记录，直接标记完成 |

### OfflinePaymentMethod（线下支付方式）

```typescript
type OfflinePaymentMethod = 'cash' | 'other_paid'
```

### OfflinePaymentInfo（线下支付详情）

```typescript
interface OfflinePaymentInfo {
  method: OfflinePaymentMethod     // 线下支付方式
  remark: string                   // 备注
  cashVerifyStatus: 'pending' | 'verified' | null  // 核销状态（仅现金支付）
  cashVerifyStatusText: string     // 核销状态文案
  submittedAt: string              // 提交时间
  verifiedAt?: string | null       // 核销时间（财务核销后填入）
}
```



## 跨项目关联

### 与 Tenant 端的关联

| H5 操作 | 关联的 Tenant 端操作 |
|---------|---------------------|
| 线下支付（现金）→ 状态变为 `PENDING_VERIFICATION` | Tenant 财务调用 `POST /orders/:id/verify-cash` 核销 → 状态变为 `PAID` |
| 在线支付成功 → 状态变为 `PAID` | Tenant 收款流水 `GET /payments` 中新增一条记录 |
| 订单详情展示商品明细 | Tenant 端创建订单时录入的 order_items |

### 与 Admin 端的关联

| H5 操作 | 关联的 Admin 端数据 |
|---------|---------------------|
| 支付成功 | Admin `GET /payments` 跨租户收款流水中可见 |
| 支付成功 | Admin `GET /reconciliation/daily` 对账明细中计入 |

---

## 接口汇总

| 模块 | 接口数 | 方法分布 |
|------|--------|---------|
| 订单详情查询 | 1 | GET ×1 |
| 发起在线支付 | 1 | POST ×1 |
| 线下支付登记 | 1 | POST ×1 |
| 轮询支付状态 | 1 | GET ×1 |
| **合计** | **4** | GET ×2, POST ×2 |

| 关联数据库表 | 说明 |
|-------------|------|
| payment_orders | H5 支付单（核心表） |
| orders | 业务订单（读取） |
| order_items | 订单行项目（读取） |
