import { ApiProperty } from '@nestjs/swagger';
import { AdminReconciliationStatusEnum, FinanceReconciliationStatusEnum } from '@shou/types/enums';

export class FinanceSummaryResponseSwagger {
  @ApiProperty({ description: '总应收（元）', example: 25600 })
  totalReceivable!: number;

  @ApiProperty({ description: '总实收（元）', example: 19200 })
  totalReceived!: number;

  @ApiProperty({ description: '总手续费（元）', example: 58.2 })
  totalFee!: number;

  @ApiProperty({ description: '总净额（元）', example: 19141.8 })
  totalNet!: number;

  @ApiProperty({ description: '回款率', example: 75 })
  collectionRate!: number;

  @ApiProperty({ description: '账期订单数', example: 12 })
  creditOrderCount!: number;

  @ApiProperty({ description: '订单总数', example: 86 })
  orderCount!: number;
}

export class FinanceReconciliationRecordItemSwagger {
  @ApiProperty({ description: '订单 ID' })
  orderId!: string;

  @ApiProperty({ description: '客户名称', example: '深圳华强贸易' })
  customer!: string;

  @ApiProperty({ description: '订单金额（元）', example: 198.5 })
  amount!: number;

  @ApiProperty({ description: '净额（元）', example: 197.9 })
  net!: number;

  @ApiProperty({ description: '手续费（元）', example: 0.6 })
  fee!: number;

  @ApiProperty({ description: '渠道', example: 'lakala' })
  channel!: string;

  @ApiProperty({ description: '支付时间', example: '2026-04-11T09:00:00.000Z' })
  paidAt!: string;

  @ApiProperty({ description: '对账状态', enum: Object.values(FinanceReconciliationStatusEnum), example: FinanceReconciliationStatusEnum.VERIFIED })
  status!: string;
}

export class FinanceReconciliationListResponseSwagger {
  @ApiProperty({ description: '对账明细列表', type: [FinanceReconciliationRecordItemSwagger] })
  list!: FinanceReconciliationRecordItemSwagger[];

  @ApiProperty({ description: '总数', example: 60 })
  total!: number;

  @ApiProperty({ description: '当前页', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页条数', example: 20 })
  pageSize!: number;
}

export class AdminReconciliationSummaryResponseSwagger {
  @ApiProperty({ description: '总应收（元）', example: 512000 })
  totalReceivable!: number;

  @ApiProperty({ description: '总实收（元）', example: 460000 })
  totalReceived!: number;

  @ApiProperty({ description: '待收总额（元）', example: 52000 })
  totalPending!: number;

  @ApiProperty({ description: '逾期总额（元）', example: 12000 })
  totalOverdue!: number;

  @ApiProperty({ description: '回款进度百分比', example: 89.84 })
  progressPercent!: number;
}

export class AdminReconciliationDailyRecordItemSwagger {
  @ApiProperty({ description: '日期', example: '2026-04-11' })
  date!: string;

  @ApiProperty({ description: '租户名称', example: '华南一区商户A' })
  tenant!: string;

  @ApiProperty({ description: '订单数', example: 12 })
  orders!: number;

  @ApiProperty({ description: '应收金额（元）', example: 12800 })
  amount!: number;

  @ApiProperty({ description: '已收金额（元）', example: 10000 })
  received!: number;

  @ApiProperty({ description: '待收金额（元）', example: 2800 })
  pending!: number;

  @ApiProperty({ description: '日报状态', enum: Object.values(AdminReconciliationStatusEnum), example: AdminReconciliationStatusEnum.RECONCILING })
  status!: string;
}

export class AdminReconciliationDailyListResponseSwagger {
  @ApiProperty({ description: '平台对账日报列表', type: [AdminReconciliationDailyRecordItemSwagger] })
  list!: AdminReconciliationDailyRecordItemSwagger[];

  @ApiProperty({ description: '总数', example: 30 })
  total!: number;

  @ApiProperty({ description: '当前页', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页条数', example: 20 })
  pageSize!: number;
}
