``` PlantUML
@startuml
autonumber
skinparam maxMessageSize 150

actor "OS端\n(平台运营)" as OS
actor "Tenant端\n(经销商)" as Tenant
actor "送货司机" as Driver
actor "买家\n(超市老板)" as Buyer
participant "后端服务\n(api)" as API
participant "拉卡拉\n(支付通道)" as Lakala

group 第一阶段：商户进件与平台开通
    OS -> API : 创建租户账号
    OS -> API : 录入拉卡拉进件参数，绑定子商户账户
    API --> OS : 商户开通完成，子账户就绪
end

group 第二阶段：订单导入与发货打印
    Tenant -> API : 上传 Excel 送货单（拖拽完成标准字段映射；如模板含自定义字段定义，同步提取自定义列数据）
    API -> API : 解析 Excel，执行标准字段校验；提取 customFields 数据透传至订单
    API --> Tenant : 异步入库完成，生成订单列表（状态：未支付）
    Tenant -> API : 批量选单，触发打印
    API --> Tenant : 输出发货单（含订单专属支付二维码）
    Tenant -> Driver : 交付纸质发货单，安排出车配送
end

group 第三阶段：扫码支付与状态判定
    Driver -> Buyer : 送货到场，出示纸质发货单
    Buyer -> API : 手机扫描发货单二维码（进入 pay-h5 页面）
    API -> API : 校验二维码有效期（超过90天强制拦截）
    API -> API : 查询当前订单支付状态

    alt 订单状态 = 已支付
        API --> Buyer : 展示"已付款"霸屏页面，阻断重复支付
    else 订单状态 = 未支付
        API --> Buyer : 展示订单金额与商品摘要
        Buyer -> API : 点击支付按钮
        API -> Lakala : 服务端定格支付金额，发起收银请求
        Lakala --> Buyer : 展示原生收银页面
        Buyer -> Lakala : 完成支付（拉卡拉支付）
        Lakala -> API : 资金直达租户子账户 & Webhook 回调支付成功通知
        API -> API : 更新订单状态为"已支付"，写入操作流水日志
        API --> Tenant : 订单状态更新为"已支付"
    end
end

group 第四阶段：支付状态主动兜底（双链路保障）
    note over Buyer, API : 买家从支付 App 切回 H5 页面，页面重新获焦触发主动查询
    Buyer -> API : 前端主动发起订单支付状态查询
    API -> Lakala : 主动向拉卡拉查询支付结果
    Lakala --> API : 返回最终支付状态
    API --> Buyer : 同步展示最新订单状态（与 Webhook 链路互为兜底，任一成功即完成状态更新）
end

group 第五阶段：异常处理与报表清算
    opt 线下转账 / 特殊结算场景
        Tenant -> API : 手工标记订单为"已支付"
        API --> Tenant : 订单状态更新，操作日志写入流水记录
    end
    API --> Tenant : 财务报表刷新（回款总额、实收率、日/周/月核销看板）
    API --> OS : 平台总报表刷新（全平台流水走势、租户活跃度、代理商佣金统计）
end

@enduml
```
