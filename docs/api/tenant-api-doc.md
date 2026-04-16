# Tenant 商户 SaaS 端 — API 接口契约文档

> 本文档为 Tenant（商户端）前后端接口契约依据，覆盖全部业务模块。
> 生成日期：2026-04-07

---

## 目录

1. [通用约定](#一通用约定)
2. [认证模块 Auth](#二认证模块-auth4-个端点)
3. [订单模块 Orders](#三订单模块-orders14-个端点)
4. [支付与核销 Payment](#四支付与核销-payment3-个端点)
5. [财务对账 Finance](#五财务对账-finance3-个端点)
6. [账期管理 Credit](#六账期管理-credit2-个端点)
7. [服务商模块 Agents](#七服务商模块-agents6-个端点)
8. [数据分析 Analytics](#八数据分析-analytics4-个端点)
9. [系统设置 Settings](#九系统设置-settings13-个端点)
10. [通知 Notifications](#十通知-notifications2-个端点)
11. [资质提交 Certification](#十一资质提交-certification2-个端点)
12. [数据流转架构](#十二数据流转架构)
13. [跨项目关联](#十三跨项目关联)

---

## 一、通用约定

> [!NOTE]
> **全局规范指引**
> 关于统一下发的 `code/data/message` 响应体包装、分页参数的请求与返回体指引、全局 `Http Status` 错误码机制以及环境拦截要求，本档内剔除重复声明，请直接翻阅架构大本营字典 **[api-architecture-overview.md]** 的第二章。
> 枚举命名与取值统一参见 **[../enums/enum-manual.md](../enums/enum-manual.md)**，本档仅保留与当前模块直接相关的最小定义。

### 1.6 角色定义

```typescript
type TenantRole = 'TENANT_OWNER' | 'TENANT_OPERATOR' | 'TENANT_FINANCE' | 'TENANT_VIEWER'
type AuthSourceTag = 'mock' | 'remote'
```

| 角色 | 中文名 | 说明 |
|------|--------|------|
| `TENANT_OWNER` | 老板 | 全部权限，包含员工配置与财务全览 |
| `TENANT_OPERATOR` | 打单员 | 处理订单导入、打印、发货及催款操作 |
| `TENANT_FINANCE` | 财务 | 负责现金线下核销、对账单审计处理 |
| `TENANT_VIEWER` | 访客 | 只读，用于审计与只读查看流水 |

---

## 二、认证模块 Auth（4 个端点）

> 源码：`features/auth/` + `@shou/shared/api/modules/auth`
> 三端（Admin / Tenant / H5）共用同一套 Auth，后端通过 `user.tenantId` 区分身份。

### 2.1 登录

- **POST** `/auth/login`
- **是否鉴权**：否（`skipAuth: true`）

**请求参数：**

```typescript
{
  account: string    // 登录账号
  password: string   // 密码
}
```

**响应 data：**

```typescript
{
  accessToken: string          // 访问令牌
  expiresIn: number          // 令牌有效期（秒）
  user: {
    id: string                // 用户 ID
    account: string           // 登录账号
    realName: string          // 用户姓名
    role: TenantRole          // 当前主角色
    tenantId: string | null  // 租户用户有值，平台用户为 null
  }
}
```

**Cookie：**

- 响应头通过 `Set-Cookie` 下发 `refreshToken`
- Cookie 属性：`HttpOnly`、`SameSite=Lax`
- HTTPS 场景优先使用 `__Host-refreshToken` + `Secure`

**前端标准化映射：**

```typescript
{
  token: string              // accessToken
  role: TenantRole           // 校验后的角色
  name: string               // realName || name || account
  source: AuthSourceTag      // 数据来源标记
}
```

### 2.2 刷新令牌

- **POST** `/auth/refresh`
- **是否鉴权**：否（`skipAuth: true`）
- **描述**：令牌过期前 5 分钟自动触发；401 时也会静默刷新一次并重放原请求

**请求参数：** 无 Body，服务端从 HttpOnly Refresh Cookie 读取 refreshToken

**响应 data：**

```typescript
{
  accessToken: string         // 新的访问令牌
  expiresIn: number           // 新令牌有效期（秒）
}
```

**Cookie：**

- 成功刷新后会轮换 refreshToken
- 响应头重新写入新的 HttpOnly Refresh Cookie

### 2.3 登出

- **POST** `/auth/logout`
- **是否鉴权**：否（跳过 401 处理）
- **描述**：服务端清理当前 refresh session，并清空 Refresh Cookie；若请求带有 accessToken，会一并加入黑名单

**请求参数：** 无 Body

**响应 data：** `null`

### 2.4 获取当前用户信息

- **GET** `/auth/me`
- **是否鉴权**：是

**响应 data：**

```typescript
{
  id: string                  // 当前用户 ID
  account: string             // 登录账号
  realName: string            // 用户姓名
  role: TenantRole            // 当前主角色
  tenantId: string | null     // 所属租户 ID；平台用户为 null
}
```

---

## 三、订单模块 Orders（14 个端点）

> 源码：`features/orders/` + `@shou/shared/api/modules/order`
> 后端自动按当前用户的 tenantId 过滤，仅返回本租户数据。
> 订单创建与正式导入成功时，服务端同步生成 `orders.qrCodeToken`，供前端在送货单上渲染 `/pay/:token` 二维码。
> 本轮文档以“默认模板 -> 租户模板 -> 预检 -> 正式导入 -> 导入任务 -> 订单查询”的新闭环为准；预检同步执行，正式导入异步执行。

### 类型定义

```typescript
type OrderStatus = 'pending' | 'partial' | 'paid' | 'expired' | 'credit'
type OrderPayType = 'cash' | 'credit'
type OrderImportConflictPolicy = 'skip' | 'overwrite'
type OrderImportJobStatus = 'pending' | 'processing' | 'completed' | 'failed'
type OrderTemplateFieldType = 'text' | 'number' | 'money' | 'date' | 'enum'
type PaymentRecordStatus = 'success' | 'partial' | 'pending' | 'failed'
type CreditOrderStatus = 'normal' | 'soon' | 'today' | 'overdue'

interface TenantOrderLineItem {
  itemId?: string              // 行项目 ID
  skuId?: string | null        // 商品主数据 ID
  skuName: string              // 商品名称
  skuSpec?: string             // 商品规格
  unit: string                 // 单位
  quantity: number             // 数量
  unitPrice: number            // 单价（元）
  lineAmount: number           // 行金额（元）
}

interface OrderImportTemplateField {
  label: string                // 字段展示名
  key: string                  // 字段 key
  mapStr: string               // ERP 列头映射值
  isRequired: boolean          // 是否系统必填
}

interface OrderImportTemplate {
  id: string                   // 模板 ID
  name: string                 // 模板名称
  isDefault: boolean           // 是否默认模板
  updatedAt: string            // 最近更新时间
  defaultFields: OrderImportTemplateField[]  // 系统默认字段，固定 7 项
  customerFields: OrderImportTemplateField[] // 租户自定义字段
}

interface TenantOrderListItem {
  id: string                   // 订单 ID
  sourceOrderNo: string        // 源订单号
  groupKey?: string            // 辅助分组/防重键；未显式提供时通常回退为 sourceOrderNo
  customer: string             // 客户名称
  customerPhone: string        // 客户电话
  customerAddress: string      // 客户地址
  totalAmount: number          // 订单总金额（元）
  orderTime: string            // 下单时间
  customerFieldValues: Record<string, string> // 模板自定义字段值
  paid: number                 // 已收金额（元）
  status: OrderStatus          // 收款状态
  payType: OrderPayType        // 结算方式
  prints: number               // 打印次数
  mappingTemplateId?: string   // 关联映射模板 ID
  qrCodeToken?: string         // 订单级 H5 支付跳转令牌，前端据此生成 `/pay/:token`
  voided: boolean              // 是否已作废
  voidReason?: string          // 作废原因
  voidedAt?: string            // 作废时间
}

interface TenantOrderDetail extends TenantOrderListItem {
  lineItems: TenantOrderLineItem[] // 订单商品明细
}
```

### 3.1 获取订单列表

- **GET** `/orders`
- **角色**：all

**请求参数（Query）：**

```typescript
{
  page?: number                // 默认 1
  pageSize?: number            // 默认 200
  keyword?: string             // 搜索订单号、源订单号、客户名称、客户电话、客户地址
  status?: OrderStatus         // 状态筛选
  payType?: OrderPayType       // 结算方式筛选
  templateId?: string          // 按导入模板过滤
  dateFrom?: string            // 按 orderTime 范围过滤，开始日期 YYYY-MM-DD
  dateTo?: string              // 按 orderTime 范围过滤，结束日期 YYYY-MM-DD
}
```

**响应 data：**

```typescript
{
  list: Array<{
    id: string                 // 订单 ID
    sourceOrderNo: string      // 源订单号
    groupKey?: string          // 辅助分组/防重键
    customer: string           // 客户名称
    customerPhone: string      // 客户电话
    customerAddress: string    // 客户地址
    totalAmount: number        // 订单总金额（元）
    orderTime: string          // 下单时间
    customerFieldValues: Record<string, string> // 模板自定义字段值
    paid: number               // 已收金额（元）
    status: OrderStatus        // 收款状态
    payType: OrderPayType      // 结算方式
    prints: number             // 打印次数
    mappingTemplateId?: string // 关联映射模板 ID
    qrCodeToken?: string       // 订单级 H5 支付跳转令牌
    voided: boolean            // 是否已作废
    voidReason?: string        // 作废原因
    voidedAt?: string          // 作废时间
  }>
  total: number                // 订单总数
  page: number                 // 当前页码
  pageSize: number             // 每页条数
}
```

### 3.2 获取单个订单

- **GET** `/orders/{id}`
- **角色**：all
- **说明**：响应中应显式包含 `qrCodeToken`，用于前端生成送货单二维码并打开对应订单 H5 页面。

**响应 data：**

```typescript
{
  id: string                   // 订单 ID
  sourceOrderNo: string        // 源订单号
  groupKey?: string            // 辅助分组/防重键
  customer: string             // 客户名称
  customerPhone: string        // 客户电话
  customerAddress: string      // 客户地址
  totalAmount: number          // 订单总金额（元）
  orderTime: string            // 下单时间
  customerFieldValues: Record<string, string> // 模板自定义字段值
  paid: number                 // 已收金额（元）
  status: OrderStatus          // 收款状态
  payType: OrderPayType        // 结算方式
  prints: number               // 累计打印次数
  mappingTemplateId?: string   // 关联映射模板 ID
  qrCodeToken?: string         // 订单级 H5 支付跳转令牌，前端据此生成 `/pay/:token`
  lineItems: Array<{
    itemId?: string            // 行项目 ID
    skuId?: string | null      // 可选的商品主数据 ID
    skuName: string            // 商品名称
    skuSpec?: string           // 商品规格
    unit: string               // 单位
    quantity: number           // 数量
    unitPrice: number          // 单价（元）
    lineAmount: number         // 行金额（元）
  }>
  voided: boolean              // 是否已作废
  voidReason?: string          // 作废原因
  voidedAt?: string            // 作废时间
}
```

### 3.3 创建订单

- **POST** `/orders`
- **角色**：TENANT_OWNER, TENANT_OPERATOR
- **说明**：当前手工建单接口暂未纳入本轮订单导入字段换模，仍沿用既有建单结构；本轮重点调整导入链路与订单读取接口，手工建单契约待后续统一。

### 3.4 更新订单

- **PUT** `/orders/{id}`
- **角色**：TENANT_OWNER, TENANT_OPERATOR
- **说明**：当前手工改单接口暂未纳入本轮订单导入字段换模，仍沿用既有改单结构；本轮重点调整导入链路与订单读取接口，手工改单契约待后续统一。

### 3.5 更新订单作废状态

- **PATCH** `/orders/{id}`
- **角色**：TENANT_OWNER, TENANT_OPERATOR
- **描述**：通过部分更新订单资源的作废字段，安全终结订单生命周期。一旦作废全链路生效不可逆。

**请求参数：**

```typescript
{
  voidReason: string // 作废理由（必填）
}
```

**响应 data：**

```typescript
{
  id: string                   // 订单 ID
  sourceOrderNo: string        // 源订单号
  groupKey?: string            // 辅助分组/防重键
  customer: string             // 客户名称
  customerPhone: string        // 客户电话
  customerAddress: string      // 客户地址
  totalAmount: number          // 订单总金额（元）
  orderTime: string            // 下单时间
  customerFieldValues: Record<string, string> // 模板自定义字段值
  paid: number                 // 已收金额（元）
  status: OrderStatus          // 收款状态
  payType: OrderPayType        // 结算方式
  prints: number               // 打印次数
  mappingTemplateId?: string   // 关联映射模板 ID
  qrCodeToken?: string         // 订单级 H5 支付跳转令牌
  lineItems: Array<{
    itemId?: string            // 行项目 ID
    skuId?: string | null      // 商品主数据 ID
    skuName: string            // 商品名称
    skuSpec?: string           // 商品规格
    unit: string               // 单位
    quantity: number           // 数量
    unitPrice: number          // 单价（元）
    lineAmount: number         // 行金额（元）
  }>
  voided: boolean              // 是否已作废
  voidReason?: string          // 作废原因
  voidedAt?: string            // 作废时间
}
```

### 3.6 获取系统默认映射模板

- **GET** `/import/default-template`
- **角色**：TENANT_OWNER
- **描述**：获取系统默认映射模板。租户创建或编辑自定义模板时，必须先以该默认模板为基底填写 `mapStr`，再补充自定义字段。

**响应 data：**

```typescript
Array<{
  label: string               // 字段展示名
  key: string                 // 系统字段 key
  mapStr: string              // ERP 列头映射值；默认返回空字符串
  isRequired: boolean         // 是否系统必填
}>
```

**固定返回内容：**

```json
[
  { "label": "源订单号", "key": "sourceOrderNo", "mapStr": "", "isRequired": true },
  { "label": "客户名称", "key": "customer", "mapStr": "", "isRequired": true },
  { "label": "客户电话", "key": "customerPhone", "mapStr": "", "isRequired": true },
  { "label": "客户地址", "key": "customerAddress", "mapStr": "", "isRequired": true },
  { "label": "总金额", "key": "totalAmount", "mapStr": "", "isRequired": true },
  { "label": "下单时间", "key": "orderTime", "mapStr": "", "isRequired": true },
  { "label": "结算方式", "key": "payType", "mapStr": "", "isRequired": true },
]
```

### 3.7 导入-获取模板列表

- **GET** `/import/templates`
- **角色**：TENANT_OWNER, TENANT_OPERATOR
- **描述**：获取当前租户可用的订单导入模板。该接口用于导入页面的模板选择与模板内容读取；模板的创建与维护仍仅限 `TENANT_OWNER`。
- **关联表**：import_templates

**响应 data：**

```typescript
Array<{
  id: string                  // 模板 ID
  name: string                // 模板名称
  isDefault: boolean          // 是否默认模板
  updatedAt: string           // 最近更新时间
  defaultFields: Array<{
    label: string             // 字段展示名
    key: string               // 系统字段 key
    mapStr: string            // ERP 列头映射值
    isRequired: boolean       // 默认字段固定为 true
  }>
  customerFields: Array<{
    label: string             // 自定义字段展示名
    key: string               // 服务端生成的 customerKeyN
    mapStr: string            // ERP 列头映射值
    isRequired: boolean       // 自定义字段固定为 false
  }>
}>
```

**业务规则：**

- `defaultFields` 固定 7 项，字段 key 与 `GET /import/default-template` 保持一致
- `customerFields` 为租户自定义字段，结构与默认字段一致
- 当前模板列表只返回新结构，不再返回旧三段式 `sourceColumns / fields / mappings`

### 3.8 导入-创建模板

- **POST** `/import/templates`
- **角色**：TENANT_OWNER
- **关联表**：import_templates

**请求参数：**

```typescript
{
  name: string                // 模板名称
  isDefault: boolean          // 是否默认模板
  defaultFields: Array<{
    label: string             // 字段展示名
    key: string               // 系统字段 key
    mapStr: string            // ERP 列头映射值
    isRequired: boolean       // 必须为 true
  }>
  customerFields: Array<{
    label: string             // 自定义字段展示名
    mapStr: string            // ERP 列头映射值
  }>
}
```

**响应 data：**

```typescript
{
  id: string                  // 模板 ID
  name: string                // 模板名称
  isDefault: boolean          // 是否默认模板
  updatedAt: string           // 最近更新时间
}
```

**服务端规则：**

- `defaultFields` 必须完整包含 7 个系统字段，且 `key / label / isRequired` 不能改写
- `defaultFields[].mapStr` 由租户填写对应 ERP 列头
- `customerFields` 由前端提交 `label + mapStr`，服务端统一补 `key=customerKey1...N`
- 所有 `customerFields[].isRequired` 均由服务端固定为 `false`
- 创建接口仅返回最小结果摘要；若前端需要完整模板结构，请重新调用 `GET /import/templates`
- 同租户下模板名称唯一；服务端按去首尾空格后比较，大小写不敏感
- 同一模板内 `defaultFields + customerFields` 的 `mapStr` 不允许重复
- `customerFields[].label` 在同一模板内不允许重复

**错误语义：**

- `400`：请求结构不合法，例如缺失系统字段、字段映射为空、固定字段被篡改、模板内映射重复
- `409`：同租户下模板名称冲突

### 3.9 导入-更新模板

- **PUT** `/import/templates/{id}`
- **角色**：TENANT_OWNER
- **关联表**：import_templates

**请求参数：**

```typescript
{
  name?: string               // 模板名称
  isDefault?: boolean         // 是否默认模板
  defaultFields: Array<{
    label: string
    key: string
    mapStr: string
    isRequired: boolean
  }>
  customerFields: Array<{
    label: string
    mapStr: string
  }>
}
```

**响应 data：**

```typescript
{
  id: string
  name: string
  isDefault: boolean
  updatedAt: string
}
```

**服务端规则：**

- 更新时仍按整包模板校验，不支持局部跳过系统字段
- `defaultFields` 必须完整包含 7 个系统字段，且 `key / label / isRequired` 不能改写
- 更新接口仅返回最小结果摘要；若前端需要完整模板结构，请重新调用 `GET /import/templates`
- 同租户下模板名称唯一；更新时排除当前模板自身
- 同一模板内 `defaultFields + customerFields` 的 `mapStr` 不允许重复
- `customerFields[].label` 在同一模板内不允许重复

**错误语义：**

- `400`：请求结构不合法，例如缺失系统字段、字段映射为空、固定字段被篡改、模板内映射重复
- `404`：模板不存在，或模板不属于当前租户
- `409`：同租户下模板名称冲突

- 更新模板时按当前提交内容整体替换模板结构
- `customerFields` 每次按当前提交数组重新编号
- 相同租户下若本次更新设置 `isDefault=true`，则其他模板自动取消默认

### 3.10 导入-数据预检校验

- **POST** `/import/preview`
- **角色**：TENANT_OWNER, TENANT_OPERATOR
- **描述**：前端完成 Excel 解析并按模板映射回填后，提交标准订单数组做订单级预检。预检同步返回结果，不进入 `import-worker`。
- **关联表**：无

**请求参数：**

```typescript
{
  templateId: string                     // 选定的模板 ID
  orders: Array<{
    sourceOrderNo: string                // 源订单号
    customer: string                     // 客户名称
    customerPhone: string                // 客户电话
    customerAddress: string              // 客户地址
    totalAmount: number | string         // 订单总金额
    orderTime: string                    // 下单时间
    payType: OrderPayType                // 结算方式：cash | credit
    customerFieldValues: Record<string, string> // 模板自定义字段值
    lineItems: Array<{
      itemId?: string                    // 行项目 ID
      skuId?: string | null              // 商品主数据 ID
      skuName: string                    // 商品名称
      skuSpec?: string                   // 商品规格
      unit: string                       // 单位
      quantity: number                   // 数量
      unitPrice: number                  // 单价（元）
      lineAmount: number                 // 行金额（元）
    }>                                   // 可为空数组
  }>
}
```

**完整请求示例：**

```json
{
  "templateId": "tpl_order_001",
  "orders": [
    {
      "sourceOrderNo": "SO-20260415-001",
      "customer": "深圳华强贸易",
      "customerPhone": "13800138000",
      "customerAddress": "深圳市福田区深南大道1001号",
      "totalAmount": 48,
      "orderTime": "2026-04-15 09:30:00",
      "payType": "cash",
      "customerFieldValues": {
        "customerKey1": "MD001",
        "customerKey2": "张三"
      },
      "lineItems": [
        {
          "skuName": "农夫山泉550ml",
          "skuSpec": "24瓶/箱",
          "unit": "箱",
          "quantity": 2,
          "unitPrice": 24,
          "lineAmount": 48
        }
      ]
    }
  ]
}
```

**响应 data：**

```typescript
{
  previewId: string            // 预检批次标识，用于后续正式导入
  templateId: string           // 本次预检使用的模板 ID
  summary: {
    totalOrders: number             // 参与预检的订单总数
    validOrders: number             // 通过预检的订单数
    invalidOrders: number           // 预检失败的订单数
    duplicateOrderCount: number     // 与库内已存在订单重复的数量
    errorCount: number              // 错误明细总数
  }
  orders: Array<{
    sourceOrderNo: string      // 源订单号
    groupKey?: string          // 辅助分组/防重键
    customer: string           // 客户名称
    customerPhone: string      // 客户电话
    customerAddress: string    // 客户地址
    totalAmount: number        // 订单总金额（元）
    orderTime: string          // 下单时间
    payType: OrderPayType      // 结算方式
    customerFieldValues: Record<string, string> // 模板自定义字段值
    mappingTemplateId?: string // 关联映射模板 ID
    lineItems: Array<{
      itemId?: string          // 行项目 ID
      skuId?: string | null    // 商品主数据 ID
      skuName: string          // 商品名称
      skuSpec?: string         // 商品规格
      unit: string             // 单位
      quantity: number         // 数量
      unitPrice: number        // 单价（元）
      lineAmount: number       // 行金额（元）
    }>
  }>                           // 服务端规范化后的订单预览
  duplicateOrders: {
    sourceOrderNo: string       // 检测到重复的源订单号
    existingOrderId?: string    // 系统内已存在的订单 ID
    customer?: string           // 重复订单对应的客户名称
    totalAmount?: number        // 重复订单对应的金额
    existingStatus?: OrderStatus // 已存在订单当前状态
    incomingCount: number       // 当前导入批次中命中的订单数
  }[]
  invalidOrders: {
    index: number               // 当前批次中的订单序号，从 1 开始
    sourceOrderNo?: string      // 若已提供源订单号，则返回该值方便定位
    field?: string              // 出错字段 key
    reason: string              // 中文错误原因
  }[]
}
```

**预检规则：**

- `orders` 必须为非空数组
- 每张订单必须包含 7 个默认字段值：`sourceOrderNo / customer / customerPhone / customerAddress / totalAmount / orderTime / payType`
- `customerFieldValues` 中的 key 必须全部命中该模板的 `customerFields[].key`
- `payType` 当前只允许 `cash / credit`
- `lineItems` 可为空数组；非空时继续沿用当前行项目结构校验
- `invalidOrders.length === 0` 时，前端才应继续触发正式导入

### 3.11 异步正式导入

- **POST** `/orders/import`
- **角色**：TENANT_OWNER, TENANT_OPERATOR
- **描述**：消费预检成功的 `previewId`，创建正式导入任务。该接口本身不再接收原始订单数组。
- **关联表**：orders

**请求参数：**

```typescript
{
  previewId: string                       // 预检成功后返回的批次 ID
  conflictPolicy?: OrderImportConflictPolicy // 命中重复订单时的处理策略，默认 'skip'
}
```

**响应 data：**

```typescript
{
  jobId: string               // 异步导入任务 ID
  previewId: string           // 本次消费的预检批次 ID
  submittedCount: number      // 本次进入队列处理的订单数
  status: OrderImportJobStatus // 任务初始状态
}
```

**业务规则：**

- `/orders/import` 只能消费 `previewId`，不再支持直传 `orders / rows / templateId`
- 一个 `previewId` 成功创建导入任务后立即视为已消费，不允许重复提交
- 正式导入才进入 `import-worker`；预检始终同步执行

### 3.12 轮询导入进度

- **GET** `/orders/import/jobs/{jobId}`
- **角色**：TENANT_OWNER, TENANT_OPERATOR
- **描述**：用于轮询长耗时任务的执行成功率与返回报告
- **关联表**：import_jobs

**响应 data：**

```typescript
{
  jobId: string                  // 异步导入任务 ID
  previewId: string              // 对应的预检批次 ID
  status: OrderImportJobStatus   // 当前任务状态
  submittedCount: number         // 提交入队的订单总数
  processedCount: number         // 当前已处理完成的订单数
  successCount: number           // 成功新增入库的订单数
  skippedCount: number           // 因冲突策略被跳过的订单数
  overwrittenCount: number       // 覆盖已有订单成功的数量
  failedCount: number            // 最终导入失败的订单数
  failedOrders: {
    index?: number               // 失败订单在预检批次中的序号
    sourceOrderNo?: string       // 失败订单对应的源订单号
    reason: string               // 失败原因
  }[]
  conflictDetails: {
    sourceOrderNo: string         // 触发冲突的源订单号
    existingOrderId?: string      // 系统内已存在的订单 ID
    action: OrderImportConflictPolicy // 本次采取的处理动作
    reason: string                // 处理原因或结果说明
  }[]
  completedAt?: string            // 任务完成时间；未完成时可为空
}
```


### 3.13 提交打印记录

- **POST** `/orders/print-records`
- **角色**：TENANT_OWNER, TENANT_OPERATOR
- **描述**：前端在本机实际打印成功后，提交本次打印成功的订单 ID 列表；服务端据此累计订单 `prints` 次数，并按批次记录幂等结果。

**请求参数：**

```typescript
{
  orderIds: string[]           // 本次实际打印成功的订单 ID 列表；单张打印时数组长度为 1，必须非空
  requestId?: string           // 建议必填；同租户下用于批次级幂等。未传时仍可处理，但不保证重复提交幂等
  remark?: string              // 备注信息，预留扩展
}
```

**响应 data：**

```typescript
{
  requestId?: string           // 实际参与幂等识别的批次号；未传则为空
  totalCount: number           // 本次请求中参与处理的订单总数（服务端去重后）
  successCount: number         // 成功累计打印次数的订单数
  confirmedAt: string          // 服务端确认时间
  remark?: string              // 原样回传的备注信息，预留扩展
}
```

**业务规则：**

- 该接口是打印成功回执接口，不承担实际打印动作
- `orderIds` 必须非空
- `orderIds` 必须来自本次实际打印成功的订单，不应直接提交“用户选中的全部订单”
- 服务端应按当前租户作用域校验订单归属，并对 `orderIds` 做去重处理
- `totalCount` 以服务端去重后的 `orderIds` 数量为准
- 同一租户下，相同 `requestId` 的重复提交必须幂等返回首次结果

### 3.14 创建催款提醒记录

- **POST** `/orders/{id}/reminders`
- **角色**：TENANT_OWNER, TENANT_FINANCE
- **描述**：在指定订单下创建一条催款提醒记录，并触发对应通知渠道

**请求参数：**

```typescript
{
  channels?: string[]          // 通知渠道：["sms", "wechat"]，默认 ["sms"]
}
```

**响应 data：**

```typescript
{
  sent: boolean
  channels: string[]           // 实际发送的渠道
}
```

---

## 四、支付与核销 Payment（3 个端点）

> 此模块是 Tenant 与 H5 的核心关联点。客户在 H5 支付后，Tenant 端查看流水并核销。

### 类型定义

```typescript
type PaymentOrderStatus = 'unpaid' | 'paying' | 'pending_verification' | 'paid' | 'expired'
type PaymentRecordStatus = 'success' | 'partial' | 'pending' | 'failed'

interface PaymentRecord {
  id: string                   // 流水号，如 "PAY-20260330-001"
  orderId: string              // 关联订单号
  customer: string             // 客户名称
  amount: number               // 收款金额（元）
  channel: string              // 支付通道：拉卡拉 | 现金 | 其他
  fee: number                  // 手续费（元）
  net: number                  // 到账金额（元）= amount - fee
  status: PaymentRecordStatus
  paidAt: string               // 收款时间
}
```

### 4.1 获取收款流水列表

- **GET** `/payments`
- **角色**：TENANT_OWNER, TENANT_FINANCE

**请求参数（Query）：**

```typescript
{
  page?: number
  pageSize?: number
  keyword?: string             // 搜索订单号、客户
  channel?: string             // 支付通道筛选
}
```

**响应 data：**

```typescript
{
  list: Array<{
    id: string                 // 流水 ID
    orderId: string            // 关联订单号
    customer: string           // 客户名称
    amount: number             // 收款金额（元）
    channel: string            // 支付通道
    fee: number                // 手续费（元）
    net: number                // 到账金额（元）
    status: PaymentRecordStatus      // 流水状态
    paidAt: string             // 收款时间
  }>
  total: number                // 流水总数
  page: number                 // 当前页码
  pageSize: number             // 每页条数
}
```

### 4.2 获取收款汇总统计

- **GET** `/payments/summary`
- **角色**：TENANT_OWNER, TENANT_FINANCE

**响应 data：**

```typescript
{
  totalAmount: number          // 今日收款总额（元）
  totalFee: number             // 手续费合计（元）
  totalNet: number             // 实际到账（元）
  totalCount: number           // 流水总笔数
  abnormalCount: number        // 异常流水笔数
}
```

### 4.3 创建现金核销记录

- **POST** `/orders/{id}/cash-verifications`
- **角色**：TENANT_FINANCE
- **描述**：在指定订单下创建一条现金核销记录；`payment_orders.status` 从 `pending_verification` 变为 `paid`

**请求参数：** 无

**响应 data：**

```typescript
{
  orderId: string
  orderStatus: OrderStatus      // 订单收款状态；通常更新为 'paid'
  paymentStatus: 'paid'         // H5 支付单状态
  verifiedAt: string            // 核销时间
}
```

**业务规则：**
- 仅 `pending_verification` 状态的支付单可以核销
- 核销后，H5 端再次打开该订单页面将看到"订单已完成"
- 同时在 `payments` 表生成一条 `channel=cash` 的收款记录
- 同步更新 `orders.paid` 与 `orders.status`

**数据流：**

```
H5 客户选择"现金支付" → payment_orders.status = pending_verification
                                    ↓
Tenant 财务 POST /orders/{id}/cash-verifications
                                    ↓
              payment_orders.status = paid + payments 新增一条记录 + orders 收款状态更新
                                    ↓
              H5 客户再次打开页面 → 看到"订单已完成"
```

---

## 五、财务对账 Finance（3 个端点）

> 源码：`features/finance/`
> 提供本租户维度的财务汇总和对账明细。

### 类型定义

```typescript
type FinanceReconciliationStatus = 'verified' | 'pending' | 'exception'
```

### 5.1 获取财务汇总

- **GET** `/finance/summary`
- **角色**：TENANT_OWNER, TENANT_FINANCE

**响应 data：**

```typescript
{
  totalReceivable: number      // 本期应收总额（元）
  totalReceived: number        // 已收金额（元）
  totalFee: number             // 手续费合计（元），费率约 0.25%
  totalNet: number             // 净到账（元）= totalReceived - totalFee
  collectionRate: number       // 回款率（%）= totalReceived / totalReceivable × 100
  creditOrderCount: number     // 账期订单数
  orderCount: number           // 订单总数
}
```

### 5.2 获取对账明细

- **GET** `/finance/reconciliation`
- **角色**：TENANT_OWNER, TENANT_FINANCE

**请求参数（Query）：**

```typescript
{
  page?: number
  pageSize?: number
}
```

**响应 data：**

```typescript
{
  list: Array<{
    orderId: string            // 订单号
    customer: string           // 客户名称
    amount: number             // 订单金额（元）
    net: number                // 到账金额（元）
    fee: number                // 手续费（元）
    channel: string            // 支付通道，如 "拉卡拉"
    paidAt: string             // 到账时间
    status: FinanceReconciliationStatus // 对账状态
  }>
  total: number                // 明细总数
  page: number                 // 当前页码
  pageSize: number             // 每页条数
}
```

### 5.3 导出对账单

- **GET** `/finance/reconciliation/export`
- **角色**：TENANT_OWNER, TENANT_FINANCE
- **Content-Type**：`application/octet-stream`

**响应**：Excel 文件流

---

## 六、账期管理 Credit（2 个端点）

> 源码：`features/finance/`（信用管理子页面）
> 管理 payType=账期 的订单，跟踪到期和逾期情况。

### 6.1 获取账期订单列表

- **GET** `/orders/credit`
- **角色**：TENANT_OWNER, TENANT_FINANCE

**请求参数（Query）：**

```typescript
{
  page?: number                // 页码
  pageSize?: number            // 每页条数
}
```

**响应 data：**

```typescript
{
  list: Array<{
    id: string                 // 订单号
    customer: string           // 客户名称
    amount: number             // 订单金额（元）
    date: string               // 下单日期
    creditDays: number         // 账期天数，如 30
    dueDate: string            // 到期日期
    creditStatus: CreditOrderStatus  // 账期状态
  }>
  total: number                // 订单总数
  page: number                 // 当前页码
  pageSize: number             // 每页条数
}
```

**状态说明：**

| creditStatus | 中文 | 颜色 | 规则 |
|-------------|------|------|------|
| `overdue` | 逾期 | 红 | 超过 dueDate |
| `today` | 今日到期 | 橙 | dueDate = 今天 |
| `soon` | 即将到期 | 蓝 | dueDate 在未来 7 天内 |
| `normal` | 正常 | 灰 | dueDate 在 7 天之后 |

### 6.2 创建回款记录

- **POST** `/orders/{id}/receipts`
- **角色**：TENANT_OWNER, TENANT_FINANCE
- **描述**：在账期订单下创建一条回款记录，并同步回写订单已收金额与收款状态

**请求参数：**

```typescript
{
  amount?: number              // 回款金额（可选，不传则全额回款）
  remark?: string              // 备注
}
```

**响应 data：**

```typescript
{
  orderId: string
  status: OrderStatus          // 全额回款→'paid'，部分回款→'partial'
  paid: number                 // 更新后的已收金额
}
```

---



---

## 七、数据分析 Analytics（4 个端点）

> 源码：`features/analytics/` + `@shou/shared/api/modules/analytics`
> 全部数据自动按当前租户过滤。

### 类型定义

```typescript
interface DailyTrend {
  day: string                  // 格式 'MM-DD'
  应收: number                 // 应收金额（元）
  实收: number                 // 实收金额（元）
}

interface MonthlyTrend {
  month: string                // 格式 'M月'
  应收: number
  实收: number
}

interface LiveFeedEntry {
  time: string                 // 格式 'HH:mm'
  customer: string             // 客户名称
  amount: number               // 支付金额（元）
  status: string               // 支付状态：paid | partial | pending
}
```

### 8.1 获取日趋势

- **GET** `/analytics/daily-trend`
- **角色**：all
- **描述**：近 7 天的日维度应收/实收趋势

**响应 data：**

```typescript
Array<{
  day: string                  // 格式 'MM-DD'
  应收: number                 // 应收金额（元）
  实收: number                 // 实收金额（元）
}>
```

### 8.2 获取月趋势

- **GET** `/analytics/monthly-trend`
- **角色**：all
- **描述**：近 N 个月的月维度应收/实收趋势

**响应 data：**

```typescript
Array<{
  month: string                // 格式 'M月'
  应收: number                 // 应收金额（元）
  实收: number                 // 实收金额（元）
}>
```

### 8.3 获取实时收款动态

- **GET** `/analytics/payments/live`
- **角色**：all
- **描述**：今日实时收款流水列表

**响应 data：**

```typescript
Array<{
  time: string                 // 格式 'HH:mm'
  customer: string             // 客户名称
  amount: number               // 支付金额（元）
  status: string               // 支付状态：paid | partial | pending
}>
```

### 8.4 获取仪表盘聚合数据

- **GET** `/analytics/dashboard`
- **角色**：all
- **描述**：首页仪表盘所需的聚合数据，一次请求返回，减少多接口拼装

**响应 data：**

```typescript
{
  // 今日收款概览
  todayReceivable: number      // 今日应收（元）
  todayReceived: number        // 今日已收（元）
  todayPending: number         // 今日待收（元）
  collectionRate: number       // 回款率（%）

  // 待办数量
  pendingPrintCount: number    // 待打印订单数
  creditDueSoonCount: number   // 本周到期账期数
  partialPaymentCount: number  // 待确认部分付款数

  // 角色定制标题
  roleTitle: string            // 根据角色返回不同标题
  // TENANT_OWNER → "今日收款总览"
  // TENANT_OPERATOR → "今日打单任务"
  // TENANT_FINANCE → "财务对账中心"
  // TENANT_VIEWER → "审计只读视图"
}
```

---

## 八、系统设置 Settings（13 个端点）

> 源码：`features/settings/` + `@shou/shared/api/modules/settings`
> 仅 TENANT_OWNER 角色可访问（系统设置页面整体受角色控制）。

### 类型定义

```typescript
type TenantUserStatus = 'active' | 'disabled'

interface TenantSettingsUser {
  id: string                   // 用户 ID
  name: string                 // 姓名
  account: string              // 登录账号
  role: TenantRole             // 可多角色时为主角色
  phone: string                // 手机号
  status: TenantUserStatus     // 用户状态
  lastLogin: string            // 最后登录时间，如 "2026-03-25 11:30"
}

interface TenantRoleAccount {
  id: string                   // 角色 ID
  name: string                 // 角色名称
  description?: string         // 角色描述
  permissions: string[]        // 权限 ID 列表
  isSystem: boolean            // 是否系统内置角色
  userCount: number            // 关联用户数
}

interface PermissionNode {
  id: string                   // 权限节点 ID
  label: string                // 权限名称
  children?: PermissionNode[]  // 子权限
}

interface TenantGeneralSettings {
  companyName: string          // 企业名称
  contactPerson: string        // 联系人
  contactPhone: string         // 联系电话
  address: string              // 企业地址
  licenseNo: string            // 营业执照号
  qrCodeExpiry: number         // 收款码有效期（天）
  notifySeller: boolean        // 收款成功通知业务员
  notifyOwner: boolean         // 收款成功通知老板
  notifyFinance: boolean       // 收款成功通知财务
  creditRemindDays: number     // 账期到期提醒提前天数
  dailyReportPush: boolean     // 每日收款日报推送
}

interface PrintingConfigListItem {
  importTemplateId: string     // 绑定的导入映射模板 ID
  importTemplateName: string   // 映射模板名称
  hasCustomConfig: boolean     // 是否存在自定义打印配置
  configVersion?: number       // 配置版本号；未配置时可为空
  updatedAt?: string           // 最近更新时间
  updatedBy?: string           // 最近更新人
  remark?: string              // 备注信息
}
```

### 8.1 获取角色列表

- **GET** `/settings/roles`
- **角色**：TENANT_OWNER
- **描述**：一期使用固化角色，本接口仅提供供UI展示的基础配置字典。

**响应 data：**

```typescript
Array<{
  id: string                   // 角色 ID
  name: string                 // 角色名称
  description?: string         // 角色描述
  permissions: string[]        // 权限 ID 列表
  isSystem: boolean            // 是否系统内置角色
  userCount: number            // 关联用户数
}>
```

### 8.2 获取权限树

- **GET** `/settings/permissions`
- **角色**：TENANT_OWNER
- **描述**：返回完整硬编码的权限树结构，仅供展示使用，一期无动态分配权。

**响应 data：**

```typescript
Array<{
  id: string                   // 权限节点 ID
  label: string                // 权限名称
  children?: Array<{
    id: string                 // 子权限节点 ID
    label: string              // 子权限名称
    children?: Array<{
      id: string               // 孙级权限节点 ID
      label: string            // 孙级权限名称
    }>                         // 允许继续按相同结构递归展开
  }>                           // 子权限节点
}>
```

**权限树结构示例：**

```
- 首页（查看收款总览、实时收款动态）
- 订单管理（查看订单列表、导入订单、打印订单）
- 打印设置（查看打印配置、维护映射模板对应的打印模板）
- 财务报表（查看收款报表、对账明细、账期管理、导出报表）
- 系统设置（基础设置、打印配置、角色管理、用户管理）
```

### 8.3 获取用户列表

- **GET** `/settings/users`
- **角色**：TENANT_OWNER

**响应 data：**

```typescript
Array<{
  id: string                   // 用户 ID
  name: string                 // 姓名
  account: string              // 登录账号
  role: TenantRole             // 主角色
  phone: string                // 手机号
  status: TenantUserStatus     // 用户状态
  lastLogin: string            // 最后登录时间
}>
```

### 8.4 创建用户

- **POST** `/settings/users`
- **角色**：TENANT_OWNER

**请求参数：**

```typescript
{
  name: string                 // 姓名（必填）
  phone: string                // 手机号 / 登录账号（必填）
  role: TenantRole             // 角色（必填）
  password?: string            // 密码，默认 "123456"
}
```

**响应 data：**

```typescript
{
  id: string                   // 用户 ID
  name: string                 // 姓名
  account: string              // 登录账号
  role: TenantRole             // 主角色
  phone: string                // 手机号
  status: TenantUserStatus     // 用户状态
  lastLogin: string            // 最后登录时间
}
```

**校验规则：**
- `phone` 在本租户内唯一（作为登录账号）
- 新建用户初始状态为 `active`

### 8.5 更新用户

- **PUT** `/settings/users/{id}`
- **角色**：TENANT_OWNER

**请求参数：**

```typescript
{
  name?: string                // 姓名
  account?: string             // 登录账号
  role?: TenantRole            // 主角色
  phone?: string               // 手机号
  status?: TenantUserStatus    // 用户状态
}
```

**响应 data：**

```typescript
{
  id: string                   // 用户 ID
  name: string                 // 姓名
  account: string              // 登录账号
  role: TenantRole             // 主角色
  phone: string                // 手机号
  status: TenantUserStatus     // 用户状态
  lastLogin: string            // 最后登录时间
}
```

### 8.6 删除用户

- **DELETE** `/settings/users/{id}`
- **角色**：TENANT_OWNER

**响应 data：** `null`

**校验规则：**
- TENANT_OWNER 角色用户不可删除自己
- 实际为软删除

### 8.7 更新用户状态

- **PATCH** `/settings/users/{id}`
- **角色**：TENANT_OWNER
- **描述**：切换用户的启用/禁用状态

**请求参数：**

```typescript
{
  status: TenantUserStatus
}
```

**响应 data：**

```typescript
{
  id: string                   // 用户 ID
  name: string                 // 姓名
  account: string              // 登录账号
  role: TenantRole             // 主角色
  phone: string                // 手机号
  status: TenantUserStatus     // 用户状态
  lastLogin: string            // 最后登录时间
}
```

### 8.8 获取通用配置

- **GET** `/settings/general`
- **角色**：TENANT_OWNER
- **描述**：获取企业信息 + 通知设置的最终生效值
- **说明**：服务端返回“平台默认值 + 租户覆盖值”的合并结果；`system_configs` 负责平台默认层，`tenant_general_settings` 负责租户覆盖层。

**响应 data：**

```typescript
{
  companyName: string          // 企业名称
  contactPerson: string        // 联系人
  contactPhone: string         // 联系电话
  address: string              // 企业地址
  licenseNo: string            // 营业执照号
  qrCodeExpiry: number         // 收款码有效期（天）
  notifySeller: boolean        // 收款成功通知业务员
  notifyOwner: boolean         // 收款成功通知老板
  notifyFinance: boolean       // 收款成功通知财务
  creditRemindDays: number     // 账期到期提醒提前天数
  dailyReportPush: boolean     // 每日收款日报推送
}
```

### 8.9 保存通用配置

- **PUT** `/settings/general`
- **角色**：TENANT_OWNER
- **说明**：仅更新当前租户的覆盖层，不直接修改平台默认配置。

**请求参数：**

```typescript
{
  companyName?: string         // 企业名称
  contactPerson?: string       // 联系人
  contactPhone?: string        // 联系电话
  address?: string             // 企业地址
  licenseNo?: string           // 营业执照号
  qrCodeExpiry?: number        // 收款码有效期（天）
  notifySeller?: boolean       // 收款成功通知业务员
  notifyOwner?: boolean        // 收款成功通知老板
  notifyFinance?: boolean      // 收款成功通知财务
  creditRemindDays?: number    // 账期到期提醒提前天数
  dailyReportPush?: boolean    // 每日收款日报推送
}
```

**响应 data：**

```typescript
{
  companyName: string          // 企业名称
  contactPerson: string        // 联系人
  contactPhone: string         // 联系电话
  address: string              // 企业地址
  licenseNo: string            // 营业执照号
  qrCodeExpiry: number         // 收款码有效期（天）
  notifySeller: boolean        // 收款成功通知业务员
  notifyOwner: boolean         // 收款成功通知老板
  notifyFinance: boolean       // 收款成功通知财务
  creditRemindDays: number     // 账期到期提醒提前天数
  dailyReportPush: boolean     // 每日收款日报推送
}
```

### 8.10 获取打印配置列表

- **GET** `/settings/printing`
- **角色**：TENANT_OWNER
- **描述**：返回当前租户下所有导入映射模板对应的打印配置摘要视图。若某张映射模板尚未配置，则 `hasCustomConfig=false`，前端回退本地默认模板。

**响应 data：**

```typescript
{
  items: Array<{
    importTemplateId: string     // 绑定的导入映射模板 ID
    importTemplateName: string   // 映射模板名称，供前端列表展示
    hasCustomConfig: boolean     // 是否存在自定义打印配置；false 时前端回退本地默认模板
    configVersion?: number       // 配置版本号；仅在 hasCustomConfig=true 时返回
    updatedAt?: string           // 最近更新时间；仅在 hasCustomConfig=true 时返回
    updatedBy?: string           // 最近更新人，预留审计能力
    remark?: string              // 备注信息，预留扩展
  }>
}
```

**关键说明：**

- 服务端只返回打印配置外围元信息，不解析 `config` 内部模板结构
- 列表页用于告诉前端“哪些映射模板已有自定义配置，哪些仍使用默认模板”
- 服务端持久化维度为 `tenantId + importTemplateId`

### 8.11 获取单张映射模板的打印配置

- **GET** `/settings/printing/{importTemplateId}`
- **角色**：TENANT_OWNER
- **描述**：获取指定导入映射模板对应的完整打印配置。若未配置，则返回 `hasCustomConfig=false`，前端自行回退本地默认模板。

**路径参数：**

```typescript
{
  importTemplateId: string      // 导入映射模板 ID
}
```

**响应 data：**

```typescript
{
  importTemplateId: string       // 绑定的导入映射模板 ID
  importTemplateName?: string    // 映射模板名称
  hasCustomConfig: boolean       // 是否存在自定义打印配置；false 时前端回退本地默认模板
  configVersion?: number         // 配置版本号；未配置时可为空
  config?: Record<string, unknown> // 打印配置 JSON；仅在 hasCustomConfig=true 时返回
  updatedAt?: string             // 最近更新时间
  updatedBy?: string             // 最近更新人，预留审计能力
  remark?: string                // 备注信息，预留扩展
}
```

**关键说明：**

- `config` 为前端维护的完整打印配置快照
- 服务端只负责按租户和 `importTemplateId` 维度持久化与回传
- 服务端持久化维度为 `tenantId + importTemplateId`

### 8.12 保存单张映射模板的打印配置

- **PUT** `/settings/printing/{importTemplateId}`
- **角色**：TENANT_OWNER
- **描述**：按 `importTemplateId` 保存单张映射模板的打印配置；若此前未配置，则本次保存即创建该模板的覆盖配置。

**路径参数：**

```typescript
{
  importTemplateId: string      // 导入映射模板 ID
}
```

**请求参数：**

```typescript
{
  configVersion?: number         // 前端提交时携带的配置版本号，预留并发保护
  config: Record<string, unknown> // 打印配置 JSON；服务端按黑盒配置整包保存
  remark?: string                // 备注信息，预留扩展
}
```

**响应 data：**

```typescript
{
  importTemplateId: string       // 绑定的导入映射模板 ID
  hasCustomConfig: boolean       // 保存成功后固定为 true
  configVersion: number          // 保存成功后的最新配置版本号
  updatedAt: string              // 保存时间
  updatedBy?: string             // 保存人，预留审计能力
  remark?: string                // 备注信息，预留扩展
}
```

**关键说明：**

- 服务端按 `tenantId + importTemplateId` 维度保存黑盒打印配置
- 若该映射模板此前没有自定义配置，则本次保存后 `hasCustomConfig=true`
- 保存接口仅返回最小结果摘要；若前端需要最新完整配置，请重新调用 `GET /settings/printing/{importTemplateId}`
- 不支持删除打印配置；未配置时由前端回退默认模板
- 服务端不承担模板字段级语义校验，也不负责实际打印动作

### 8.13 获取操作日志

- **GET** `/settings/audit-logs`
- **角色**：TENANT_OWNER
- **描述**：查看本租户操作日志（tenantId 自动隔离）

**请求参数（Query）：**

```typescript
{
  page: number                 // 页码
  pageSize: number             // 每页条数
  startDate?: string           // 筛选起始日期 YYYY-MM-DD
  endDate?: string             // 筛选结束日期 YYYY-MM-DD
  operator?: string            // 操作人姓名（模糊搜索）
}
```

```typescript
interface AuditLogRecord {
  id: string                   // 日志 ID
  action: string               // 操作描述，如 "导入订单"、"修改角色权限"
  operator: string             // 操作人
  ip: string                   // 操作 IP
  createdAt: string            // 操作时间
}
```

**响应 data：**

```typescript
{
  list: Array<{
    id: string                 // 日志 ID
    action: string             // 操作描述，如 "导入订单"
    operator: string           // 操作人
    ip: string                 // 操作 IP
    createdAt: string          // 操作时间
  }>
  total: number                // 日志总数
}
```

---

## 九、通知 Notifications（2 个端点）

> Tenant 是公告的**接收方**，Admin 是发布方。

### 类型定义

```typescript
interface NotificationRecord {
  id: string                   // 公告 ID
  title: string                // 公告标题
  content: string              // 公告正文
  publishAt: string            // 发布时间
  isRead: boolean              // 是否已读
}
```

### 9.1 获取平台公告列表

- **GET** `/notifications`
- **角色**：all
- **描述**：获取平台发布的、当前租户可见的公告列表

**请求参数（Query）：**

```typescript
{
  page?: number                // 页码
  pageSize?: number            // 每页条数
}
```

**响应 data：**

```typescript
{
  list: Array<{
    id: string                 // 公告 ID
    title: string              // 公告标题
    content: string            // 公告正文
    publishAt: string          // 发布时间
    isRead: boolean            // 是否已读
  }>
  total: number                // 公告总数
  page: number                 // 当前页码
  pageSize: number             // 每页条数
}
```

### 9.2 标记公告已读

- **POST** `/notifications/{id}/read-records`
- **角色**：all

**请求参数：** 无

**响应 data：** `null`

---

## 十、资质提交 Certification（2 个端点）

> Tenant 提交资质材料，Admin 在 `/tenants/certifications/{id}/review-decisions` 创建审核决议。

### 类型定义

```typescript
type TenantCertificationStatus =
  | 'pending_initial_review'
  | 'pending_secondary_review'
  | 'pending_confirmation'
  | 'approved'
  | 'rejected'

interface TenantCertificationSubmitRequest {
  licenseUrl: string           // 营业执照或资质文件地址
  legalPerson: string          // 法人姓名
  legalIdCard: string          // 法人身份证号
  contactPhone: string         // 联系电话
  remark?: string              // 补充说明
}

interface TenantCertificationStatusResult {
  certId: string | null        // 资质记录 ID
  status: TenantCertificationStatus | null // 当前资质状态
  submittedAt: string | null   // 提交时间
  reviewedAt: string | null    // 最近审核时间
  reviewComment?: string | null // 审核备注
  rejectReason: string | null  // 驳回原因
}
```

### 10.1 提交资质材料

- **POST** `/tenants/certification`
- **描述**：提交当前租户的资质认证材料
- **关联表**：tenant_certifications

**请求参数：**

```typescript
{
  licenseUrl: string           // 营业执照或资质文件地址
  legalPerson: string          // 法人姓名
  legalIdCard: string          // 法人身份证号
  contactPhone: string         // 联系电话
  remark?: string              // 补充说明
}
```

**响应 data：**

```typescript
{
  certId: string               // 认证记录 ID
  status: 'pending_initial_review' // 提交后进入待初审
  submittedAt: string          // 提交时间
}
```

### 10.2 查询资质状态

- **GET** `/tenants/certification`
- **描述**：查询当前租户的资质认证状态
- **关联表**：tenant_certifications

**响应 data：**

```typescript
{
  certId: string | null        // 资质记录 ID
  status: TenantCertificationStatus | null // 当前资质状态
  submittedAt: string | null   // 提交时间
  reviewedAt: string | null    // 最近审核时间
  reviewComment?: string | null // 审核备注
  rejectReason: string | null  // 驳回原因
}
```

---

## 十一、数据流转架构

```
┌─────────────┐
│  UI 组件    │  pages/ + features/*/components/
└──────┬──────┘
       │
┌──────▼──────┐
│  Hook       │  use-auth / use-orders / use-agents / use-analytics ...
│  (ahooks)   │  useRequest 封装，自动管理 loading/error/data
└──────┬──────┘
       │
┌──────▼──────┐
│  Repository │  auth.repository / order.repository / agent.repository ...
│             │  统一返回 { data: T, source: 'MOCK' | 'REMOTE' }
└──────┬──────┘
       │
┌──────▼──────┐
│  Mapper     │  auth.mapper / order.mapper / agent.mapper ...
│             │  API 响应 → 前端类型标准化
└──────┬──────┘
       │
┌──────▼──────┐
│  API Module │  @shou/shared/api/modules/*
│             │  axios 请求封装，统一拦截器
└──────┬──────┘
       │
┌──────▼──────┐
│  Request    │  @shou/shared/api/request
│  拦截器     │  ├─ 请求：注入 Authorization / X-Proxy-Env
│             │  └─ 响应：校验 code === 0，处理 401/403
└─────────────┘
```

### Token 生命周期

1. **登录成功** → 响应体返回 `accessToken`，前端仅保存在内存；响应头通过 `Set-Cookie` 写入 HttpOnly Refresh Cookie
2. **每次业务请求** → 请求拦截器从内存读取 accessToken，并注入 `Authorization` 头
3. **页面刷新后恢复会话** → 启动期调用 `POST /auth/refresh`，依赖 Cookie 换取新的 accessToken
4. **Token 刷新** → 过期前 5 分钟自动调用 `POST /auth/refresh`，成功后重排下一次刷新
5. **401/403** → 先静默刷新一次并重试；仍失败时触发 `auth:unauthorized`，清理本地会话并跳转登录

### 数据来源检测

- **环境键**: `localStorage['sinhe-proxy-env']`
  - `'me'` → Mock 数据（默认）
  - 其他值 → 远程接口
- 每个 Hook 返回值均包含 `source: 'MOCK' | 'REMOTE'` 字段，用于 UI 显示数据来源

---

## 十二、跨项目关联

### 与 H5 端的关联

| Tenant 操作 | 关联的 H5 端行为 |
|-------------|-----------------|
| 创建订单 / 导入订单 → 生成订单二维码 | H5 通过 `qrCodeToken` 打开对应订单页面，是否展示支付按钮由订单状态决定 |
| 财务核销 `POST /orders/{id}/cash-verifications` | H5 端现金支付订单状态从 `pending_verification` → `paid` |
| 收款流水 `GET /payments` | 包含 H5 在线支付成功后生成的记录 |

### 与 Admin 端的关联

| Tenant 数据 | Admin 端可见性 |
|-------------|---------------|
| 本租户订单 | Admin `GET /orders` 跨租户汇总中可见 |
| 本租户收款 | Admin `GET /payments` 跨租户流水中可见 |
| 本租户服务商 | Admin `GET /service-providers` 监管视角中可见 |
| 本租户用户 | Admin `GET /users` 跨租户用户列表中可见 |
| 接收 Admin 发布的公告 | Admin `POST /notices` 创建的公告推送到 Tenant |

---

## 接口汇总

| 模块 | 接口数 | 方法分布 |
|------|--------|---------|
| 认证 Auth | 4 | POST ×3, GET ×1 |
| 订单 Orders | 14 | GET ×5, POST ×6, PUT ×2, PATCH ×1 |
| 支付与核销 Payment | 3 | GET ×2, POST ×1 |
| 财务对账 Finance | 3 | GET ×3 |
| 账期管理 Credit | 2 | GET ×1, POST ×1 |
| 数据分析 Analytics | 4 | GET ×4 |
| 系统设置 Settings | 13 | GET ×7, POST ×1, PUT ×4, DELETE ×1 |
| 通知 Notifications | 2 | GET ×1, POST ×1 |
| 资质提交 Certification | 2 | GET ×1, POST ×1 |
| **合计** | **47** | GET ×25, POST ×14, PUT ×6, PATCH ×1, DELETE ×1 |

| 关联数据库表 | 说明 |
|-------------|------|
| users | 用户管理（本租户） |
| roles | 角色管理（本租户） |
| permissions | 权限树 |
| orders | 订单（本租户） |
| order_items | 订单行项目 |
| payments | 收款流水（本租户） |
| payment_orders | H5 支付单（核销关联） |
| print_record_batches | 打印回执批次幂等 |
| tenant_general_settings | 通用配置租户覆盖层 |
| system_configs | 通用配置平台默认层 |
| printer_templates | 打印配置 |
| notices | 平台公告（读取） |
| tenant_certifications | 资质认证记录 |
