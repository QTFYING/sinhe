import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FreezeActionEnum,
  ReviewActionEnum,
  SortOrderEnum,
  TenantCertificationStatusEnum,
  TenantRenewPaymentMethodEnum,
  TenantSideEnum,
  TenantSortFieldEnum,
  TenantStatusEnum,
  UserStatusEnum,
} from '@shou/types/enums';

export class TenantBaseRecordSwagger {
  @ApiProperty({ description: '租户 ID' })
  id!: string;

  @ApiProperty({ description: '租户名称', example: '华南一区商户A' })
  name!: string;

  @ApiProperty({ description: '联系电话', example: '13800138000' })
  contactPhone!: string;

  @ApiPropertyOptional({ description: '套餐名称', example: '标准版' })
  packageName?: string | null;

  @ApiPropertyOptional({ description: '管理员名称', example: '张三' })
  adminName?: string | null;

  @ApiPropertyOptional({ description: '区域', example: '广东深圳' })
  region?: string | null;

  @ApiProperty({ description: '租户状态', enum: Object.values(TenantStatusEnum), example: TenantStatusEnum.ACTIVE })
  status!: string;

  @ApiPropertyOptional({ description: '驳回原因', example: '资料不完整' })
  rejectReason?: string | null;

  @ApiPropertyOptional({ description: '冻结原因', example: '到期未续费' })
  freezeReason?: string | null;

  @ApiPropertyOptional({ description: '到期时间', example: '2026-12-31T23:59:59.000Z' })
  expireAt?: string | null;

  @ApiProperty({ description: '最大账期天数', example: 30 })
  maxCreditDays!: number;

  @ApiProperty({ description: '账期提醒天数', example: 3 })
  creditReminderDays!: number;

  @ApiProperty({ description: '创建时间', example: '2026-04-11T09:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ description: '更新时间', example: '2026-04-11T09:00:00.000Z' })
  updatedAt!: string;
}

export class TenantRecordItemSwagger {
  @ApiProperty({ description: '租户 ID' })
  id!: string;

  @ApiProperty({ description: '租户名称', example: '华南一区商户A' })
  name!: string;

  @ApiProperty({ description: '套餐名称', example: '标准版' })
  packageName!: string;

  @ApiProperty({ description: '管理员名称', example: '张三' })
  admin!: string;

  @ApiProperty({ description: '区域', example: '广东深圳' })
  region!: string;

  @ApiProperty({ description: '商户数', example: 1 })
  merchants!: number;

  @ApiProperty({ description: '用户数', example: 5 })
  users!: number;

  @ApiProperty({ description: '渠道列表', type: [String], example: ['lakala'] })
  channels!: string[];

  @ApiProperty({ description: '本月流水（元）', example: 12800 })
  monthlyFlow!: number;

  @ApiProperty({ description: '距到期天数', example: 28 })
  dueInDays!: number;

  @ApiProperty({ description: '最后活跃时间', example: '2026-04-11T09:00:00.000Z' })
  lastActiveAt!: string;

  @ApiProperty({ description: '租户状态', enum: Object.values(TenantStatusEnum), example: TenantStatusEnum.ACTIVE })
  status!: string;

  @ApiPropertyOptional({ description: '驳回原因' })
  rejectReason?: string | null;

  @ApiPropertyOptional({ description: '冻结原因' })
  freezeReason?: string | null;
}

export class TenantListResponseSwagger {
  @ApiProperty({ description: '租户列表', type: [TenantRecordItemSwagger] })
  list!: TenantRecordItemSwagger[];

  @ApiProperty({ description: '总数', example: 20 })
  total!: number;

  @ApiProperty({ description: '当前页', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页条数', example: 20 })
  pageSize!: number;
}

export class TenantBatchActionResponseSwagger {
  @ApiProperty({ description: '成功数量', example: 8 })
  successCount!: number;

  @ApiProperty({ description: '失败的 ID 列表', type: [String], example: ['T100001', 'T100002'] })
  failedIds!: string[];
}

export class TenantAuditDecisionResponseSwagger {
  @ApiProperty({ description: '租户 ID' })
  tenantId!: string;

  @ApiProperty({ description: '审核后的租户状态', enum: Object.values(TenantStatusEnum), example: TenantStatusEnum.ACTIVE })
  status!: string;

  @ApiPropertyOptional({ description: '驳回原因', example: '资料不完整' })
  rejectReason?: string | null;

  @ApiProperty({ description: '审核完成时间', example: '2026-04-16T10:00:00.000Z' })
  reviewedAt!: string;
}

export class TenantRenewalResponseSwagger {
  @ApiProperty({ description: '租户 ID' })
  tenantId!: string;

  @ApiProperty({ description: '续费后生效的套餐名称', example: '标准版' })
  packageName!: string;

  @ApiProperty({ description: '续费后的租户状态', enum: Object.values(TenantStatusEnum), example: TenantStatusEnum.ACTIVE })
  status!: string;

  @ApiProperty({ description: '新的到期时间', example: '2027-04-16T23:59:59.000Z' })
  expireAt!: string;

  @ApiProperty({ description: '续费完成时间', example: '2026-04-16T10:05:00.000Z' })
  renewedAt!: string;
}

export class TenantStatusMutationResponseSwagger {
  @ApiProperty({ description: '租户 ID' })
  tenantId!: string;

  @ApiProperty({ description: '变更后的租户状态', enum: Object.values(TenantStatusEnum), example: TenantStatusEnum.PAUSED })
  status!: string;

  @ApiPropertyOptional({ description: '冻结原因', example: '到期未续费' })
  freezeReason?: string | null;

  @ApiProperty({ description: '状态生效时间', example: '2026-04-16T10:10:00.000Z' })
  effectiveAt!: string;
}

export class TenantMemberItemSwagger {
  @ApiProperty({ description: '用户 ID' })
  id!: string;

  @ApiProperty({ description: '姓名', example: '李四' })
  name!: string;

  @ApiProperty({ description: '账号', example: '13800138000' })
  account!: string;

  @ApiProperty({ description: '所属租户', example: '华南一区商户A' })
  tenant!: string;

  @ApiProperty({ description: '所属侧', enum: Object.values(TenantSideEnum), example: TenantSideEnum.TENANT })
  tenantType!: string;

  @ApiProperty({ description: '角色', example: 'TENANT_OPERATOR' })
  role!: string;

  @ApiProperty({ description: '用户状态', enum: Object.values(UserStatusEnum), example: UserStatusEnum.ACTIVE })
  status!: string;

  @ApiProperty({ description: '作用域', example: 'tenant:orders' })
  scope!: string;
}

export class TenantMemberListResponseSwagger {
  @ApiProperty({ description: '成员列表', type: [TenantMemberItemSwagger] })
  list!: TenantMemberItemSwagger[];

  @ApiProperty({ description: '总数', example: 50 })
  total!: number;

  @ApiProperty({ description: '当前页', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页条数', example: 20 })
  pageSize!: number;
}

export class TenantCertificationRecordItemSwagger {
  @ApiProperty({ description: '资质记录 ID' })
  id!: string;

  @ApiProperty({ description: '租户名称', example: '华南一区商户A' })
  tenant!: string;

  @ApiProperty({ description: '资质类型', example: '企业实名认证' })
  type!: string;

  @ApiProperty({ description: '提交时间', example: '2026-04-11T09:00:00.000Z' })
  submitAt!: string;

  @ApiProperty({ description: '资质状态', enum: Object.values(TenantCertificationStatusEnum), example: TenantCertificationStatusEnum.PENDING_INITIAL_REVIEW })
  status!: string;

  @ApiPropertyOptional({ description: '审核备注', example: '待补营业执照副本' })
  comment?: string;
}

export class TenantCertificationSubmitResponseSwagger {
  @ApiProperty({ description: '资质记录 ID' })
  certId!: string;

  @ApiProperty({ description: '提交后的资质状态', enum: Object.values(TenantCertificationStatusEnum), example: TenantCertificationStatusEnum.PENDING_INITIAL_REVIEW })
  status!: string;

  @ApiProperty({ description: '提交时间', example: '2026-04-11T09:00:00.000Z' })
  submittedAt!: string;
}

export class TenantCertificationStatusResultSwagger {
  @ApiPropertyOptional({ description: '资质记录 ID', nullable: true })
  certId!: string | null;

  @ApiPropertyOptional({ description: '当前资质状态', enum: Object.values(TenantCertificationStatusEnum), nullable: true })
  status!: string | null;

  @ApiPropertyOptional({ description: '提交时间', nullable: true })
  submittedAt!: string | null;

  @ApiPropertyOptional({ description: '最近审核时间', nullable: true })
  reviewedAt!: string | null;

  @ApiPropertyOptional({ description: '审核备注', nullable: true })
  reviewComment?: string | null;

  @ApiPropertyOptional({ description: '驳回原因', nullable: true })
  rejectReason!: string | null;
}

export class TenantCertificationReviewDecisionResponseSwagger {
  @ApiProperty({ description: '资质记录 ID' })
  id!: string;

  @ApiProperty({ description: '租户名称', example: '华南一区商户A' })
  tenant!: string;

  @ApiProperty({ description: '资质类型', example: '企业实名认证' })
  type!: string;

  @ApiProperty({ description: '提交时间', example: '2026-04-11T09:00:00.000Z' })
  submitAt!: string;

  @ApiProperty({ description: '变更前状态', enum: Object.values(TenantCertificationStatusEnum), example: TenantCertificationStatusEnum.PENDING_INITIAL_REVIEW })
  previousStatus!: string;

  @ApiProperty({ description: '变更后状态', enum: Object.values(TenantCertificationStatusEnum), example: TenantCertificationStatusEnum.PENDING_SECONDARY_REVIEW })
  status!: string;

  @ApiPropertyOptional({ description: '审核备注', example: '进入复核阶段' })
  comment?: string;

  @ApiProperty({ description: '审核时间', example: '2026-04-11T10:00:00.000Z' })
  reviewedAt!: string;
}

export class UserRecordItemSwagger {
  @ApiProperty({ description: '用户 ID' })
  id!: string;

  @ApiProperty({ description: '账号', example: 'admin001' })
  account!: string;

  @ApiProperty({ description: '姓名', example: '平台管理员A' })
  name!: string;

  @ApiProperty({ description: '所属租户', example: '平台' })
  tenant!: string;

  @ApiProperty({ description: '所属侧', enum: Object.values(TenantSideEnum), example: TenantSideEnum.PLATFORM })
  tenantType!: string;

  @ApiProperty({ description: '角色', example: 'OS_SUPER_ADMIN' })
  role!: string;

  @ApiProperty({ description: '作用域', example: 'platform:all' })
  scope!: string;

  @ApiProperty({ description: '手机号', example: '13800138000' })
  phone!: string;

  @ApiProperty({ description: '状态', enum: Object.values(UserStatusEnum), example: UserStatusEnum.ACTIVE })
  status!: string;

  @ApiProperty({ description: '最后登录时间', example: '2026-04-11T09:00:00.000Z' })
  loginAt!: string;

  @ApiProperty({ description: '是否需要重置密码', example: true })
  requiresPasswordReset!: boolean;
}

export class UserListResponseSwagger {
  @ApiProperty({ description: '平台用户列表', type: [UserRecordItemSwagger] })
  list!: UserRecordItemSwagger[];

  @ApiProperty({ description: '总数', example: 30 })
  total!: number;

  @ApiProperty({ description: '当前页', example: 1 })
  page!: number;

  @ApiProperty({ description: '每页条数', example: 20 })
  pageSize!: number;
}

export class CreateUserPasswordResetResponseSwagger {
  @ApiProperty({ description: '是否要求下次登录强制修改密码', example: true })
  requiresPasswordReset!: true;
}
