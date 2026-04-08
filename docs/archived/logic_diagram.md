# 经销商订单收款平台 - 业务逻辑系统思维导图

## 思维导图长文本大纲格式（供前端联调时，作为提示词使用）

```text
经销商订单收款平台 System
	1. C端 买家扫码付款H5 (apps/pay-h5)
		1.1 物理触达链路
			打单员在Tenant端打印带付款码发货单，司机随车送货并将单据交给超市老板
			超市老板货到后扫描小票右上角付款码（无需注册账号，体验极简）
		1.2 五态页面状态机
			UNPAID 未付款：展示商品摘要+应付金额，点击立即支付 → 跳转收银页
			PAYING 支付中：Loading状态，code=1003 阻断并发多次点击
			PENDING_VERIFICATION 待核销：若选择线下现金付款则切入此状态，被动等待 Tenant 从后台进行财务查账与放行
			PAID 已付款：霸屏大绿标「已付款」，彻底阻断重复支付（code=1001 拦截）
			EXPIRED 已过期：code=1002 二维码超有效期提示，引导联系经销商重新获取
		1.3 金额防篡改设计
			支付金额由后端在跳转拉卡拉时服务端定格，前端无权传入金额参数
			后端读取订单 totalAmount - discountAmount 计算应付额，买家无法篡改
		1.4 二维码有效期管控
			qrExpireAt 由后端控制，默认自生单起90天，超期后端强制拦截
			qrCodeToken 唯一Hash短串（不含完整URL），不可猜测不可伪造
		1.5 支付结果双链路零掉单保障
			被动链路：拉卡拉 Webhook 回调 → 后端验签 → 写入支付流水 + 更新订单状态
			主动链路：H5重新获焦后轮询 GET /pay/:token/status → 后端同步向拉卡拉查询 → Webhook丢包时兜底
			channelTradeNo 唯一约束在数据库物理层防重复入账

	2. Tenant端 PC经销商工作台 (apps/tenant)
		2.1 身份认证与权限体系
			登录：POST /auth/login，必须传 tenantId 区分租户上下文
			JWT双令牌：Access Token 2小时，Refresh Token 7天 HttpOnly Cookie
			硬编码4个预设角色（Phase 1 不提供动态自建入口，不弹出菜单Tree选择器）
				TENANT_OWNER 老板：全部模块 + 员工管理权
				TENANT_OPERATOR 打单员：导入 + 订单管理 + 打印中心
				TENANT_FINANCE 出纳：财务报表只读 + 站内信
				TENANT_VIEWER 只读：订单列表 + 财务报表只读
		2.2 Excel智能导入模块
			前端 SheetJS 浏览器端解析 Excel，不上传原始文件（降低服务端压力）
			可视化拖拽列映射设计器：首次手动建立字段对应关系
			模板管理（GET/POST/PATCH/DELETE /import/templates）：mappingRules 标准字段映射持久化，customFieldDefs 自定义字段定义持久化，同格式表后续导入100%自动适配
			自定义字段定义（customFieldDefs）：租户可在模板中额外声明若干自定义列（如"备注1"、"区域"），浏览器解析时提取对应列数据，写入订单的 customFields JSON 字段，无需改动数据库表结构
			导入预检：POST /import/preview，服务端校验重复单号+金额合法性，返回报告供确认
			正式提交：POST /orders/import，BullMQ异步队列入库，返回jobId
			进度追踪：GET /orders/import/jobs/:jobId 轮询，PENDING→PROCESSING→COMPLETED
		2.3 订单管理
			订单列表 GET /orders：多维筛选（payStatus/deliveryStatus/关键词/日期）
			订单详情 GET /orders/:id：含商品明细 + 流水 + 日志 + voided防物理删除追踪字段标识
			获取付款码 GET /orders/:id/qrcode：返回 qrCodeToken 下发的专属防爆破链接用于印入小票
			订单作废 POST /orders/:id/void：用全审核链路可见的作废行为平替原本高危的 DELETE 物理删除
			现金核销 POST /orders/:id/verify-cash：出纳确认后处理 H5 现金支付停留在 PENDING_VERIFICATION 的单据流转至 PAID
			订单状态机约束：包含对应流转钩子，且退款与改价具有严格防并发检查
		2.4 打印中心
			批量选单 POST /print/jobs，后端生成含qrCodeUrl的打印数据（含商品明细items + 自定义扩展字段customFields）
			浏览器 @media print 方案，隐藏iframe，适配针式打印机纸张，用户点击一次确认即可完成打印
		2.5 财务报表
			回款概览 GET /report/summary：总订单额/总收款额/折扣额/未收额/实收率/按送货人维度/按导入模板维度
			订单明细报表 GET /report/orders：同订单列表筛选条件，支持 export=true 导出文件流
			支付流水报表 GET /report/payments：可按 ONLINE_PAYMENT / MANUAL_MARKUP 来源类型筛选
		2.6 站内信中心（Phase 2）
			未读角标 GET /notifications/unread-count：建议30秒间隔轮询
			消息列表 GET /notifications：支持已读/未读筛选，含账期到期提醒详情与关联订单ID
			标记已读 PATCH /notifications/:id/read / POST /notifications/read-all 全部已读
			触发来源：BullMQ每日凌晨定时扫描，多阶段推送（到期前7天 / 3天 / 到期当天），幂等锁防重复推送，收件人固定为 OWNER + FINANCE
		2.7 账期设置
			GET /tenant/settings 查看：maxCreditDays / creditReminderDays / expireAt / paymentConfig
			PATCH /tenant/settings 修改：仅可修改 maxCreditDays 和 creditReminderDays
			注意：修改账期天数仅影响新订单的 creditExpireAt 快照，历史订单不受影响
			进件参数 paymentConfig 和 SaaS期限 expireAt 仅OS端可修改，租户侧无权变更
		2.8 员工管理
			列表+新建：GET/POST /tenant/users
			编辑：PATCH /tenant/users/:id（realName / role / password）
			冻结/恢复：POST /tenant/users/:id/freeze | unfreeze，冻结后该员工登录返回403

	3. OS端 PC平台运营管理台 (apps/admin)
		3.1 OS账号管理
			硬编码2个角色：OS_SUPER_ADMIN（全权限）/ OS_OPERATOR（只读+查询）
			GET/POST /os/users 列表+新建，PATCH /os/users/:id 更新，POST /os/users/:id/disable 禁用
			仅由超管手动创建，无自助注册流程
		3.2 商户租户管理
			租户列表 GET /os/tenants：支持 keyword/status/agentId 多维筛选
			创建租户 POST /os/tenants：绑定代理商 + 拉卡拉进件参数 lakalaShopNo + SaaS到期时间
			更新租户 PATCH /os/tenants/:id：修改基本信息、进件参数、账期配置、SaaS期限（这些均是OS端独享权限）
			封禁/恢复 POST /os/tenants/:id/suspend | restore：封禁后该租户下所有员工登录返回403
		3.3 平台总报表
			GET /os/reports/platform（需传 startDate + endDate）
			返回：总收款额 / 总订单量 / 活跃商户数 / 每日趋势总数据

	4. 后端支撑层 (apps/api · NestJS + PostgreSQL + Redis)
		4.1 认证与多租户隔离
			JWT 双令牌：Access Token 2h，Refresh Token 7d（HttpOnly Cookie），Redis黑名单支持主动吊销
			行级租户隔离：所有查询 ORM 层自动注入 tenantId，禁止跨租户数据访问
			OS账号（tenantId=null）天然具备全局数据视野
		4.2 BullMQ 异步任务队列
			Excel批量导入队列：防大数据量冲垮数据库，前端轮询进度
			账期到期提醒定时任务：每日凌晨多阶段推送（7天前/3天前/到期当天），OrderCreditReminder唯一约束实现幂等

			支付状态主动轮询任务调度
		4.3 支付安全三重保障
			金额服务端定格：跳转拉卡拉时金额由后端计算，前端无权传入
			Redis分布式锁：防同一订单并发重复发起支付（PAYING状态拦截）
			数据库唯一约束：channelTradeNo @unique 物理层防重复入账
		4.4 全链路审计溯源
			OrderLifecycleLog 只增不改不删，覆盖 ORDER_CREATED / ORDER_PRINTED / PAYMENT_INITIATED / PAYMENT_SUCCESS_WEBHOOK / PAYMENT_SUCCESS_POLLING / PAYMENT_MANUAL_MARKUP / PRICE_ADJUSTED / DELIVERY_STATUS_UPDATED / ORDER_REFUNDED / QR_CODE_EXPIRED 等全部事件
			改价事件记录 before/after 快照，支付确认区分 Webhook 和主动轮询两种来源
		4.5 金额三元组恒等式
			totalAmount（只读基线） = paidAmount（已实收） + discountAmount（改价减免）
			totalAmount 生单后严禁 UPDATE，财务审计完全可追溯
```

---
