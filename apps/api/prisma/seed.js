const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('开始初始化种子数据 (Seeding database)...');
  
  // 1. 初始化 OS 超级管理员账号
  // tenantId_username is the unique index, but tenantId can be null. 
  // We'll search by username and role to ensure idempotency.
  let osAdmin = await prisma.user.findFirst({ where: { username: 'admin', role: 'OS_SUPER_ADMIN' } });
  
  if (!osAdmin) {
    osAdmin = await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: '123456', // 仅做测试，生产需 bcrypt
        realName: 'OS超级运营管理员',
        role: 'OS_SUPER_ADMIN',
        status: 1
      }
    });
    console.log('✅ 成功创建 OS 管理员账号: admin / 123456');
  } else {
    console.log('✅ OS 管理员已存在 (admin)');
  }

  // 2. 初始化一个测试用的经销商组 (Tenant)
  let tenant = await prisma.tenant.findFirst({ where: { name: '华东区饮料总代(测试)' }});
  
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: '华东区饮料总代(测试)',
        contactPhone: '13888888888',
        maxCreditDays: 45,
        creditReminderDays: 7,
        status: 1
      }
    });
    console.log(`✅ 成功创建测试经销商组: ${tenant.name} (租户ID: ${tenant.id})`);
  } else {
    console.log(`✅ 测试经销商组已存在 (租户ID: ${tenant.id})`);
  }

  // 3. 初始化该经销商内的老板账号
  let boss = await prisma.user.findFirst({ where: { username: 'boss', tenantId: tenant.id } });
  
  if (!boss) {
    boss = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        username: 'boss',
        passwordHash: '123456', // 仅做测试
        realName: '经销商李老板',
        role: 'TENANT_OWNER',
        status: 1
      }
    });
    console.log('✅ 成功创建该经销商老板账号: boss / 123456');
  } else {
    console.log('✅ 经销商老板账号已存在 (boss)');
  }

  console.log('\n🎉 所有测试数据初始化完毕！您可以直接使用上述账号密码进行全流程登录测试！');
}

main()
  .catch((e) => {
    console.error('❌ 初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
