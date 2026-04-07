# H5 客户支付端 — API 接口契约文档

> 本文档为 H5 移动支付页面的前后端接口契约依据。
> 生成日期：2026-04-07

---

## 通用约定

### 基础信息

| 项目 | 说明 |
|------|------|
| Base URL | `VITE_API_BASE` 环境变量，默认 `/api` |
| 认证方式 | 无需登录，通过 `orderNo` 做资源级鉴权（订单链接即凭证） |
| 内容类型 | `application/json` |
| 超时时间 | 15000ms |
| 开发代理 | 请求头 `X-Proxy-Env: {env}` 路由到不同后端环境（仅 dev） |

### 响应信封

所有接口统一使用以下响应格式：

```json
{
  "code": 0,
  "message": "success",
  "data": { ... }
}
```

- `code = 0` 表示成功，`code != 0` 表示业务错误
- H5 端不做 401/403 自动跳转（无登录态），业务错误直接展示给用户

### 金额字段约定

- H5 接口面向页面展示的金额字段默认以“元”为单位返回，可使用 `number` 展示
- 支付、核销、对账等财务计算应由服务端基于精确存储值完成，前端不得以展示态金额做二次结算

### 通用错误码

| code | 含义 |
|------|------|
| 0 | 成功 |
| 40001 | 参数校验失败（如无效的支付方式） |
| 40002 | 业务校验失败（如现金支付备注为空） |
| 40401 | 订单不存在 |
| 40402 | 订单状态不允许当前操作 |
| 50001 | 支付网关调用失败 |
| 500 | 服务端内部错误 |

---

## 端点总览

| # | Method | Path | 说明 |
|---|--------|------|------|
| 1 | GET | `/pay/orders/{orderNo}` | 获取订单支付详情 |
| 2 | POST | `/pay/orders/{orderNo}/confirm` | 发起在线支付 |
| 3 | POST | `/pay/orders/{orderNo}/offline-payment` | 线下支付登记 |
| 4 | GET | `/pay/orders/{orderNo}/status` | 轮询支付状态 |
| 5 | POST | `/pay/orders/{orderNo}/wx-jsapi` | 获取微信 JSAPI 支付参数 |

共计 **5** 个端点。

---

## 1. 获取订单支付详情

- **GET** `/pay/orders/{orderNo}`
- **描述**：根据订单号获取支付页面所需的完整订单信息，包括商户、客户、商品明细、支付状态等
- **是否鉴权**：否（orderNo 即凭证）

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| orderNo | string | 订单号，如 `PLT-20260325-002` |

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
| 40401 | orderNo 对应的订单不存在 |

---

## 2. 发起在线支付

- **POST** `/pay/orders/{orderNo}/confirm`
- **描述**：发起在线支付，后端根据请求环境选择支付渠道，返回对应渠道的支付参数
- **是否鉴权**：否

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| orderNo | string | 订单号 |

### 请求参数（可选）

```typescript
{
  channel?: 'wx_jsapi' | 'ali_h5'  // 前端可指定渠道，不传则后端自动检测
}
```

### 响应 data

```typescript
{
  orderNo: string
  paymentId: string            // 支付单号（后端生成，用于后续轮询）
  channel: PaymentChannel      // 实际使用的支付渠道
  channelParams: {
    // ---- 微信 JSAPI 场景 ----
    appId?: string
    timeStamp?: string
    nonceStr?: string
    package?: string           // prepay_id=xxx
    signType?: string          // "RSA"
    paySign?: string

    // ---- 支付宝 H5 场景 ----
    tradePageUrl?: string      // 支付宝 H5 跳转链接

    // ---- 测试/Mock 场景 ----
    directResult?: 'paid'      // 直接完成（mock 环境专用）
  }
}
```

### 支付渠道类型

```typescript
type PaymentChannel = 'wx_jsapi' | 'ali_h5' | 'direct'
```

| 渠道 | 说明 | 前端行为 |
|------|------|---------|
| `wx_jsapi` | 微信内浏览器 JSAPI 支付 | 调用 `WeixinJSBridge.invoke('getBrandWCPayRequest', channelParams)` |
| `ali_h5` | 支付宝 H5 支付 | 跳转 `channelParams.tradePageUrl` |
| `direct` | 测试环境直接完成 | 无需唤起 SDK，直接轮询 status |

### 前端渠道检测逻辑

```javascript
if (/MicroMessenger/i.test(navigator.userAgent))  → channel = 'wx_jsapi'
if (/AlipayClient/i.test(navigator.userAgent))    → channel = 'ali_h5'
else                                               → 后端根据环境决定
```

### 错误场景

| code | 场景 |
|------|------|
| 40401 | 订单不存在 |
| 40402 | 订单状态不是 `pending`，不允许支付 |
| 50001 | 支付网关调用失败（微信/支付宝下单接口异常） |

### 业务规则

- 仅 `status = pending` 的订单可以发起在线支付
- 后端调用微信/支付宝统一下单接口，生成预支付单
- 返回的 `paymentId` 用于后续 status 轮询
- Mock 环境下返回 `channel: 'direct'`，前端跳过 SDK 唤起直接轮询

---

## 3. 线下支付登记

- **POST** `/pay/orders/{orderNo}/offline-payment`
- **描述**：登记线下支付信息（现金支付或其他方式已支付），不走支付网关
- **是否鉴权**：否

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| orderNo | string | 订单号 |

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
| 40402 | 订单状态不是 `pending`，不允许操作 |

### 业务规则

| 支付方式 | 状态流转 | 说明 |
|---------|---------|------|
| `cash` | pending → **pending_verification** | 提交后等待 Tenant 财务核销 |
| `other_paid` | pending → **paid** | 直接标记为已完成 |

- `cash` 方式必须填写 remark（备注），不可为空
- `other_paid` 方式 remark 可选
- 提交成功后，响应中返回更新后的订单状态和 offlinePayment 信息

---

## 4. 轮询支付状态

- **GET** `/pay/orders/{orderNo}/status`
- **描述**：在线支付发起后，前端轮询此接口等待支付网关异步回调结果
- **是否鉴权**：否

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| orderNo | string | 订单号 |

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
终止条件：status 变为 paid 或 failed
超时处理：提示用户"支付结果确认中，请稍后刷新查看"
```

### 时序图

```
H5 前端                    后端                      支付网关
  │                        │                         │
  │  POST /confirm         │                         │
  │───────────────────────▶│  统一下单                │
  │                        │────────────────────────▶│
  │  { channel, params }   │  返回预支付信息          │
  │◀───────────────────────│◀────────────────────────│
  │                        │                         │
  │  唤起微信/支付宝 SDK ──────────────────────────▶│
  │                        │                         │
  │                        │  异步回调通知            │
  │                        │◀────────────────────────│
  │                        │  更新 payment_orders     │
  │                        │                         │
  │  GET /status (轮询)    │                         │
  │───────────────────────▶│                         │
  │  { status: 'pending' } │                         │
  │◀───────────────────────│                         │
  │  GET /status (轮询)    │                         │
  │───────────────────────▶│                         │
  │  { status: 'paid' }   │                         │
  │◀───────────────────────│                         │
  │  展示支付成功           │                         │
```

---

## 5. 获取微信 JSAPI 支付参数

- **POST** `/pay/orders/{orderNo}/wx-jsapi`
- **描述**：微信内浏览器专用，获取 JSAPI 支付所需的签名参数。当 confirm 接口已返回微信参数时，此端点为可选备用
- **是否鉴权**：否

### 路径参数

| 参数 | 类型 | 说明 |
|------|------|------|
| orderNo | string | 订单号 |

### 请求参数

```typescript
{
  openId: string  // 微信用户 openid（通过微信网页授权获取）
}
```

### 响应 data

```typescript
{
  appId: string
  timeStamp: string
  nonceStr: string
  package: string          // "prepay_id=wx20260325..."
  signType: 'RSA'
  paySign: string
}
```

### 错误场景

| code | 场景 |
|------|------|
| 40001 | openId 为空或无效 |
| 40401 | 订单不存在 |
| 40402 | 订单状态不允许支付 |
| 50001 | 微信统一下单失败 |

### 使用场景

此端点适用于以下情况：
1. confirm 接口采用通用渠道检测，未返回微信特定参数
2. 前端需要在获取 openId 后单独请求微信支付参数
3. 支付参数过期后需要重新获取

如果 confirm 接口已经根据 `channel: 'wx_jsapi'` 返回了完整参数，前端可直接使用 confirm 的返回值，无需调用此端点。

---

## 类型定义汇总

### PaymentOrderStatus（支付状态）

```typescript
type PaymentOrderStatus = 'pending' | 'pending_verification' | 'paid' | 'failed'
```

| 状态 | 中文 | 说明 | H5 页面展示 |
|------|------|------|------------|
| `pending` | 待支付 | 初始状态，等待用户选择支付方式 | 蓝色面板，"去支付"按钮可点 |
| `pending_verification` | 待核销 | 现金支付已提交，等待 Tenant 财务核销 | 橙色面板，"订单待核销"按钮禁用 |
| `paid` | 已完成 | 支付成功 | 绿色面板，"订单已完成"按钮禁用 |
| `failed` | 支付失败 | 支付异常 | 红色面板，展示客服电话 |

### 状态流转图

```
                    ┌─────────┐
                    │ pending │
                    └────┬────┘
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
     ┌────────────┐ ┌─────────┐ ┌──────────────────────┐
     │ confirm    │ │ offline │ │ offline              │
     │ (在线支付) │ │ (现金)  │ │ (其他方式已付)       │
     └─────┬──────┘ └────┬────┘ └──────────┬───────────┘
           │              │                 │
           ▼              ▼                 ▼
     ┌───────────┐ ┌─────────────────┐ ┌────────┐
     │ paid      │ │ pending_        │ │ paid   │
     │ 或 failed │ │ verification    │ └────────┘
     └───────────┘ └────────┬────────┘
                            │
                            ▼ (Tenant 财务核销)
                      ┌──────────┐
                      │  paid    │
                      └──────────┘
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

### PaymentChannel（支付渠道）

```typescript
type PaymentChannel = 'wx_jsapi' | 'ali_h5' | 'direct'
```

---

## 跨项目关联

### 与 Tenant 端的关联

| H5 操作 | 关联的 Tenant 端操作 |
|---------|---------------------|
| 线下支付（现金）→ 状态变为 `pending_verification` | Tenant 财务调用 `POST /orders/{id}/verify-cash` 核销 → 状态变为 `paid` |
| 在线支付成功 → 状态变为 `paid` | Tenant 收款流水 `GET /payments` 中新增一条记录 |
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
| 订单查询 | 1 | GET ×1 |
| 在线支付 | 2 | POST ×1, GET ×1 |
| 线下支付 | 1 | POST ×1 |
| 微信支付参数 | 1 | POST ×1 |
| **合计** | **5** | GET ×2, POST ×3 |

| 关联数据库表 | 说明 |
|-------------|------|
| payment_orders | H5 支付单（核心表） |
| orders | 业务订单（读取） |
| order_items | 订单行项目（读取） |
