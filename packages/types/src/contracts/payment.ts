export enum PaymentMethod {
  ONLINE = 'online', // 在线支付
  CASH = 'cash', // 现金支付
  OTHER_PAID = 'other_paid', // 其它方式已支付
}

export enum PaymentChannel {
  WX_JSAPI = 'wx_jsapi', // 微信 JSAPI
  ALI_H5 = 'ali_h5', // 支付宝 H5
  DIRECT = 'direct', // 直接支付网关
}

export enum H5PayOrderStatus {
  UNPAID = 'UNPAID', // 初始化未付
  PAYING = 'PAYING', // 取码支付中
  PENDING_VERIFICATION = 'PENDING_VERIFICATION', // 待财务核销
  PAID = 'PAID', // 彻底完结
  EXPIRED = 'EXPIRED', // 二维码过期或交易关闭
}
