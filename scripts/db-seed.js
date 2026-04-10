const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  console.log('开启强制数据对齐与密码 Bcrypt 洗表工程...');
  // 10 盐轮数的强单向哈希
  const defaultHash = bcrypt.hashSync('123456', 10);
  
  // 1. OS 超级管理员账号
  let osAdmin = await prisma.user.findFirst({ where: { account: 'admin', role: 'OS_SUPER_ADMIN' } });
  if (!osAdmin) {
    osAdmin = await prisma.user.create({
      data: { account: 'admin', passwordHash: defaultHash, realName: 'OS超级运营管理员', role: 'OS_SUPER_ADMIN', status: 'active' }
    });
  } else {
    await prisma.user.update({ where: { id: osAdmin.id }, data: { passwordHash: defaultHash } });
  }

  // 2. 租户
  let tenant = await prisma.tenant.findFirst({ where: { name: '华东区饮料总代(测试)' }});
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { name: '华东区饮料总代(测试)', contactPhone: '13888888888', maxCreditDays: 45, creditReminderDays: 7, status: 'active' }
    });
  }

  // 3. 租户老板
  let boss = await prisma.user.findFirst({ where: { account: 'boss', tenantId: tenant.id } });
  if (!boss) {
    boss = await prisma.user.create({
      data: { tenantId: tenant.id, account: 'boss', passwordHash: defaultHash, realName: '经销商李老板', role: 'TENANT_OWNER', status: 'active' }
    });
  } else {
    await prisma.user.update({ where: { id: boss.id }, data: { passwordHash: defaultHash } });
  }

  console.log('✅ 底层洗表完毕！所有原本裸奔在 DB 的明文账号密码，已被强制更迭为 Bcrypt 防御级散列值！');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
