const { PrismaClient, UserRoleEnum } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function parseOptionalInt(name, defaultValue) {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return defaultValue;

  const value = Number.parseInt(raw.trim(), 10);
  if (Number.isNaN(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

async function ensureOsAdmin() {
  const username = requireEnv('INIT_OS_ADMIN_USERNAME');
  const password = requireEnv('INIT_OS_ADMIN_PASSWORD');
  const realName = (process.env.INIT_OS_ADMIN_REAL_NAME || '系统管理员').trim();

  const existing = await prisma.user.findFirst({
    where: {
      tenantId: null,
      username,
      role: UserRoleEnum.OS_SUPER_ADMIN,
      deletedAt: null,
    },
  });

  if (existing) {
    console.log(`[skip] OS 管理员已存在: ${username}`);
    return existing;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const admin = await prisma.user.create({
    data: {
      username,
      passwordHash,
      realName,
      role: UserRoleEnum.OS_SUPER_ADMIN,
      status: 1,
    },
  });

  console.log(`[ok] 已创建 OS 管理员: ${username}`);
  return admin;
}

function hasTenantBootstrapConfig() {
  return [
    'INIT_TENANT_NAME',
    'INIT_TENANT_CONTACT_PHONE',
    'INIT_TENANT_OWNER_USERNAME',
    'INIT_TENANT_OWNER_PASSWORD',
  ].some((name) => {
    const value = process.env[name];
    return Boolean(value && value.trim());
  });
}

function validateTenantBootstrapConfig() {
  const required = [
    'INIT_TENANT_NAME',
    'INIT_TENANT_CONTACT_PHONE',
    'INIT_TENANT_OWNER_USERNAME',
    'INIT_TENANT_OWNER_PASSWORD',
  ];

  const missing = required.filter((name) => {
    const value = process.env[name];
    return !value || !value.trim();
  });

  if (missing.length > 0) {
    throw new Error(
      `Tenant bootstrap requires all of these variables: ${required.join(', ')}`
    );
  }
}

async function ensureTenantAndOwner() {
  if (!hasTenantBootstrapConfig()) {
    console.log('[skip] 未提供租户初始化参数，跳过租户与租户管理员创建');
    return;
  }

  validateTenantBootstrapConfig();

  const tenantName = requireEnv('INIT_TENANT_NAME');
  const tenantContactPhone = requireEnv('INIT_TENANT_CONTACT_PHONE');
  const ownerUsername = requireEnv('INIT_TENANT_OWNER_USERNAME');
  const ownerPassword = requireEnv('INIT_TENANT_OWNER_PASSWORD');
  const ownerRealName = (process.env.INIT_TENANT_OWNER_REAL_NAME || '租户管理员').trim();
  const maxCreditDays = parseOptionalInt('INIT_TENANT_MAX_CREDIT_DAYS', 30);
  const creditReminderDays = parseOptionalInt('INIT_TENANT_CREDIT_REMINDER_DAYS', 3);

  let tenant = await prisma.tenant.findFirst({
    where: {
      name: tenantName,
      deletedAt: null,
    },
  });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        name: tenantName,
        contactPhone: tenantContactPhone,
        maxCreditDays,
        creditReminderDays,
        status: 1,
      },
    });
    console.log(`[ok] 已创建租户: ${tenantName}`);
  } else {
    console.log(`[skip] 租户已存在: ${tenantName}`);
  }

  const existingOwner = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      username: ownerUsername,
      role: UserRoleEnum.TENANT_OWNER,
      deletedAt: null,
    },
  });

  if (existingOwner) {
    console.log(`[skip] 租户管理员已存在: ${ownerUsername}`);
    return;
  }

  const passwordHash = await bcrypt.hash(ownerPassword, 12);
  await prisma.user.create({
    data: {
      tenantId: tenant.id,
      username: ownerUsername,
      passwordHash,
      realName: ownerRealName,
      role: UserRoleEnum.TENANT_OWNER,
      status: 1,
    },
  });

  console.log(`[ok] 已创建租户管理员: ${ownerUsername}`);
}

async function main() {
  console.log('开始执行生产初始化...');
  await ensureOsAdmin();
  await ensureTenantAndOwner();
  console.log('生产初始化完成');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
