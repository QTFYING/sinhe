const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcrypt');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const {
  PrismaClient,
  TenantStatusEnum,
  UserRoleEnum,
  UserStatusEnum,
} = require('@prisma/client');
const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');

const { AppModule } = require('../dist/app.module');
const { ResponseInterceptor } = require('../dist/common/interceptors/response.interceptor');
const { GlobalExceptionFilter } = require('../dist/common/filters/business-exception.filter');

loadEnvFromFile(path.join(__dirname, '..', '.env'));
process.env.AUTH_COOKIE_SECURE = 'false';
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.IMPORT_JOB_WORKER_ENABLED = 'true';

const prisma = new PrismaClient();

const FIXTURES = {
  tenantId: '7f4d6bde-8e44-4f39-9c5d-4d5f8f90a001',
  ownerId: '7f4d6bde-8e44-4f39-9c5d-4d5f8f90a002',
  financeId: '7f4d6bde-8e44-4f39-9c5d-4d5f8f90a003',
  ownerAccount: 'reg_owner_20260411',
  financeAccount: 'reg_finance_20260411',
  password: 'Passw0rd!',
  templateName: '联调饮品导入模板',
  sourceOrderNo: 'REG-IMPORT-20260411-001',
};

const runtimeDir = path.join(__dirname, '..', '.runtime');
const resultPath = path.join(runtimeDir, 'backend-regression-result.json');

async function main() {
  fs.mkdirSync(runtimeDir, { recursive: true });

  const results = {
    startedAt: new Date().toISOString(),
    environment: {
      database: sanitizeDatabaseUrl(process.env.DATABASE_URL || ''),
      redis: process.env.REDIS_URL || '',
      importWorkerEnabled: process.env.IMPORT_JOB_WORKER_ENABLED,
    },
    fixtures: {
      tenantId: FIXTURES.tenantId,
      ownerAccount: FIXTURES.ownerAccount,
      financeAccount: FIXTURES.financeAccount,
      sourceOrderNo: FIXTURES.sourceOrderNo,
    },
    steps: [],
  };

  let app;
  try {
    await prepareFixtures();

    app = await NestFactory.create(AppModule, { logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.enableCors({
      origin: true,
      credentials: true,
    });

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Regression Runner')
      .setDescription('Local backend regression runner')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    SwaggerModule.createDocument(app, swaggerConfig);

    await app.listen(0, '127.0.0.1');
    const server = app.getHttpServer();
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    const baseUrl = `http://127.0.0.1:${port}/api`;

    results.baseUrl = baseUrl;

    const ownerSession = { token: null, cookie: null };
    const financeSession = { token: null, cookie: null };

    const ownerLogin = await apiRequest(results, 'Auth Owner Login', {
      method: 'POST',
      url: `${baseUrl}/auth/login`,
      body: {
        account: FIXTURES.ownerAccount,
        password: FIXTURES.password,
      },
    });
    ownerSession.token = ownerLogin.data.accessToken;
    ownerSession.cookie = ownerLogin.cookie;

    await apiRequest(results, 'Auth Me', {
      method: 'GET',
      url: `${baseUrl}/auth/me`,
      token: ownerSession.token,
    });

    const oldOwnerCookie = ownerSession.cookie;
    const refreshResult = await apiRequest(results, 'Auth Refresh', {
      method: 'POST',
      url: `${baseUrl}/auth/refresh`,
      cookie: ownerSession.cookie,
    });
    ownerSession.token = refreshResult.data.accessToken;
    ownerSession.cookie = refreshResult.cookie;

    await expectHttpFailure(results, 'Auth Refresh Old Cookie Invalid', {
      method: 'POST',
      url: `${baseUrl}/auth/refresh`,
      cookie: oldOwnerCookie,
    }, 401);

    await apiRequest(results, 'Settings General Get', {
      method: 'GET',
      url: `${baseUrl}/settings/general`,
      token: ownerSession.token,
    });

    await apiRequest(results, 'Settings General Update', {
      method: 'PUT',
      url: `${baseUrl}/settings/general`,
      token: ownerSession.token,
      body: {
        companyName: '联调回归租户有限公司',
        contactPerson: '测试负责人',
        contactPhone: '13800000009',
        address: '深圳市南山区联调路 1 号',
        licenseNo: 'LIC-20260411',
        qrCodeExpiry: 60,
        notifySeller: true,
        notifyOwner: true,
        notifyFinance: true,
        creditRemindDays: 5,
        dailyReportPush: true,
      },
    });

    const templateCreate = await apiRequest(results, 'Import Template Create', {
      method: 'POST',
      url: `${baseUrl}/import/templates`,
      token: ownerSession.token,
      body: buildImportTemplatePayload(),
    });
    const templateId = templateCreate.data.id;

    await apiRequest(results, 'Settings Printing List Before Config', {
      method: 'GET',
      url: `${baseUrl}/settings/printing`,
      token: ownerSession.token,
    });

    await apiRequest(results, 'Settings Printing Detail Before Config', {
      method: 'GET',
      url: `${baseUrl}/settings/printing/${templateId}`,
      token: ownerSession.token,
    });

    await apiRequest(results, 'Settings Printing Update', {
      method: 'PUT',
      url: `${baseUrl}/settings/printing/${templateId}`,
      token: ownerSession.token,
      body: {
        configVersion: 1,
        config: {
          page: { width: 210, height: 297 },
          fields: [
            { key: 'customer', x: 20, y: 20 },
            { key: 'summary', x: 20, y: 40 },
            { key: 'qrCodeToken', x: 150, y: 20 },
          ],
        },
        remark: '联调用打印模板',
      },
    });

    await apiRequest(results, 'Settings Printing Detail After Config', {
      method: 'GET',
      url: `${baseUrl}/settings/printing/${templateId}`,
      token: ownerSession.token,
    });

    const previewResult = await apiRequest(results, 'Import Preview', {
      method: 'POST',
      url: `${baseUrl}/import/preview`,
      token: ownerSession.token,
      body: {
        templateId,
        rows: buildImportRows(),
      },
    });
    const previewId = previewResult.data.previewId;

    const importSubmit = await apiRequest(results, 'Import Submit', {
      method: 'POST',
      url: `${baseUrl}/orders/import`,
      token: ownerSession.token,
      body: {
        previewId,
        conflictPolicy: 'overwrite',
      },
    });
    const jobId = importSubmit.data.jobId;

    const importJob = await waitImportJob(baseUrl, ownerSession.token, jobId, results);
    if (importJob.data.status !== 'completed') {
      throw new Error(`导入任务未完成，最终状态=${importJob.data.status}`);
    }

    const orderList = await apiRequest(results, 'Orders List', {
      method: 'GET',
      url: `${baseUrl}/orders?keyword=${encodeURIComponent(FIXTURES.sourceOrderNo)}`,
      token: ownerSession.token,
    });
    const order = orderList.data.list.find((item) => item.sourceOrderNo === FIXTURES.sourceOrderNo);
    if (!order) {
      throw new Error('未找到导入后的订单');
    }

    const orderId = order.id;
    const qrCodeToken = order.qrCodeToken;

    await apiRequest(results, 'Order Detail', {
      method: 'GET',
      url: `${baseUrl}/orders/${orderId}`,
      token: ownerSession.token,
    });

    await apiRequest(results, 'H5 Payment Detail', {
      method: 'GET',
      url: `${baseUrl}/pay/${qrCodeToken}`,
    });

    await apiRequest(results, 'H5 Submit Offline Cash', {
      method: 'POST',
      url: `${baseUrl}/pay/${qrCodeToken}/offline-payment`,
      body: {
        paymentMethod: 'cash',
        remark: '联调现金登记',
      },
    });

    await apiRequest(results, 'H5 Payment Status Pending Verification', {
      method: 'GET',
      url: `${baseUrl}/pay/${qrCodeToken}/status`,
    });

    const financeLogin = await apiRequest(results, 'Auth Finance Login', {
      method: 'POST',
      url: `${baseUrl}/auth/login`,
      body: {
        account: FIXTURES.financeAccount,
        password: FIXTURES.password,
      },
    });
    financeSession.token = financeLogin.data.accessToken;
    financeSession.cookie = financeLogin.cookie;

    await apiRequest(results, 'Cash Verification Create', {
      method: 'POST',
      url: `${baseUrl}/orders/${orderId}/cash-verifications`,
      token: financeSession.token,
    });

    await apiRequest(results, 'H5 Payment Status Paid', {
      method: 'GET',
      url: `${baseUrl}/pay/${qrCodeToken}/status`,
    });

    await apiRequest(results, 'Payments Summary', {
      method: 'GET',
      url: `${baseUrl}/payments/summary`,
      token: financeSession.token,
    });

    await apiRequest(results, 'Payments List', {
      method: 'GET',
      url: `${baseUrl}/payments`,
      token: financeSession.token,
    });

    const printRequestId = `print-regression-${Date.now()}`;
    await apiRequest(results, 'Print Record Create', {
      method: 'POST',
      url: `${baseUrl}/orders/print-records`,
      token: ownerSession.token,
      body: {
        orderIds: [orderId],
        requestId: printRequestId,
        remark: '联调打印成功',
      },
    });

    await apiRequest(results, 'Print Record Replay', {
      method: 'POST',
      url: `${baseUrl}/orders/print-records`,
      token: ownerSession.token,
      body: {
        orderIds: [orderId],
        requestId: printRequestId,
        remark: '联调打印成功',
      },
    });

    await apiRequest(results, 'Order Reminder Create', {
      method: 'POST',
      url: `${baseUrl}/orders/${orderId}/reminders`,
      token: ownerSession.token,
      body: {
        channels: ['sms', 'wechat'],
      },
    });

    await apiRequest(results, 'Order Detail After Print And Reminder', {
      method: 'GET',
      url: `${baseUrl}/orders/${orderId}`,
      token: ownerSession.token,
    });

    await apiRequest(results, 'Auth Logout', {
      method: 'POST',
      url: `${baseUrl}/auth/logout`,
      token: ownerSession.token,
      cookie: ownerSession.cookie,
    });

    await expectHttpFailure(results, 'Auth Refresh After Logout Invalid', {
      method: 'POST',
      url: `${baseUrl}/auth/refresh`,
      cookie: ownerSession.cookie,
    }, 401);

    results.finishedAt = new Date().toISOString();
    results.success = true;
  } catch (error) {
    results.finishedAt = new Date().toISOString();
    results.success = false;
    results.error = serializeError(error);
    throw error;
  } finally {
    fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));
    if (app) {
      await app.close().catch(() => undefined);
    }
    await prisma.$disconnect().catch(() => undefined);
  }
}

async function prepareFixtures() {
  const passwordHash = await bcrypt.hash(FIXTURES.password, 10);

  await prisma.printRecordBatch.deleteMany({ where: { tenantId: FIXTURES.tenantId } });
  await prisma.orderReminder.deleteMany({ where: { tenantId: FIXTURES.tenantId } });
  await prisma.payment.deleteMany({ where: { tenantId: FIXTURES.tenantId } });
  await prisma.paymentOrder.deleteMany({ where: { tenantId: FIXTURES.tenantId } });
  await prisma.importJob.deleteMany({ where: { tenantId: FIXTURES.tenantId } });
  await prisma.printerTemplate.deleteMany({ where: { tenantId: FIXTURES.tenantId } });
  await prisma.order.deleteMany({ where: { tenantId: FIXTURES.tenantId } });
  await prisma.importTemplate.deleteMany({ where: { tenantId: FIXTURES.tenantId } });
  await prisma.auditLog.deleteMany({ where: { tenantId: FIXTURES.tenantId } });
  await prisma.tenantGeneralSettings.deleteMany({ where: { tenantId: FIXTURES.tenantId } });

  await prisma.tenant.upsert({
    where: { id: FIXTURES.tenantId },
    create: {
      id: FIXTURES.tenantId,
      name: '联调回归租户',
      contactPhone: '13800000000',
      status: TenantStatusEnum.ACTIVE,
      maxCreditDays: 30,
      creditReminderDays: 3,
    },
    update: {
      name: '联调回归租户',
      contactPhone: '13800000000',
      status: TenantStatusEnum.ACTIVE,
      deletedAt: null,
      maxCreditDays: 30,
      creditReminderDays: 3,
    },
  });

  await prisma.user.upsert({
    where: { account: FIXTURES.ownerAccount },
    create: {
      id: FIXTURES.ownerId,
      tenantId: FIXTURES.tenantId,
      account: FIXTURES.ownerAccount,
      phone: '13800000001',
      passwordHash,
      realName: '联调老板',
      role: UserRoleEnum.TENANT_OWNER,
      status: UserStatusEnum.ACTIVE,
      requiresPasswordReset: false,
    },
    update: {
      id: FIXTURES.ownerId,
      tenantId: FIXTURES.tenantId,
      phone: '13800000001',
      passwordHash,
      realName: '联调老板',
      role: UserRoleEnum.TENANT_OWNER,
      status: UserStatusEnum.ACTIVE,
      deletedAt: null,
      requiresPasswordReset: false,
    },
  });

  await prisma.user.upsert({
    where: { account: FIXTURES.financeAccount },
    create: {
      id: FIXTURES.financeId,
      tenantId: FIXTURES.tenantId,
      account: FIXTURES.financeAccount,
      phone: '13800000002',
      passwordHash,
      realName: '联调财务',
      role: UserRoleEnum.TENANT_FINANCE,
      status: UserStatusEnum.ACTIVE,
      requiresPasswordReset: false,
    },
    update: {
      id: FIXTURES.financeId,
      tenantId: FIXTURES.tenantId,
      phone: '13800000002',
      passwordHash,
      realName: '联调财务',
      role: UserRoleEnum.TENANT_FINANCE,
      status: UserStatusEnum.ACTIVE,
      deletedAt: null,
      requiresPasswordReset: false,
    },
  });
}

function buildImportTemplatePayload() {
  return {
    name: FIXTURES.templateName,
    isDefault: true,
    sourceColumns: [
      { key: 'source_order_no', title: '订单号', index: 0 },
      { key: 'customer_name', title: '客户名称', index: 1 },
      { key: 'sku_name', title: '商品名称', index: 2 },
      { key: 'quantity', title: '数量', index: 3 },
      { key: 'unit_price', title: '单价', index: 4 },
      { key: 'line_amount', title: '金额', index: 5 },
    ],
    fields: [
      { key: 'sourceOrderNo', label: '订单号', fieldType: 'text', required: true, visible: true, order: 1, builtin: true },
      { key: 'customer', label: '客户名称', fieldType: 'text', required: true, visible: true, order: 2, builtin: true },
      { key: 'skuName', label: '商品名称', fieldType: 'text', required: true, visible: true, order: 3, builtin: true },
      { key: 'quantity', label: '数量', fieldType: 'number', required: true, visible: true, order: 4, builtin: true },
      { key: 'unitPrice', label: '单价', fieldType: 'money', required: true, visible: true, order: 5, builtin: true },
      { key: 'lineAmount', label: '金额', fieldType: 'money', required: true, visible: true, order: 6, builtin: true },
    ],
    mappings: [
      { sourceColumn: '订单号', targetField: 'sourceOrderNo', sampleValue: FIXTURES.sourceOrderNo },
      { sourceColumn: '客户名称', targetField: 'customer', sampleValue: '深圳联调客户' },
      { sourceColumn: '商品名称', targetField: 'skuName', sampleValue: '农夫山泉 550ml' },
      { sourceColumn: '数量', targetField: 'quantity', sampleValue: '2' },
      { sourceColumn: '单价', targetField: 'unitPrice', sampleValue: '6.00' },
      { sourceColumn: '金额', targetField: 'lineAmount', sampleValue: '12.00' },
    ],
  };
}

function buildImportRows() {
  return [
    {
      订单号: FIXTURES.sourceOrderNo,
      客户名称: '深圳联调客户',
      商品名称: '农夫山泉 550ml',
      数量: 2,
      单价: 6,
      金额: 12,
    },
    {
      订单号: FIXTURES.sourceOrderNo,
      客户名称: '深圳联调客户',
      商品名称: '康师傅冰红茶',
      数量: 3,
      单价: 4,
      金额: 12,
    },
  ];
}

async function waitImportJob(baseUrl, token, jobId, results) {
  for (let i = 0; i < 30; i += 1) {
    const response = await apiRequest(results, `Import Job Poll #${i + 1}`, {
      method: 'GET',
      url: `${baseUrl}/orders/import/jobs/${jobId}`,
      token,
    });

    if (response.data.status === 'completed' || response.data.status === 'failed') {
      return response;
    }

    await sleep(500);
  }

  throw new Error(`导入任务轮询超时: ${jobId}`);
}

async function apiRequest(results, name, input) {
  const headers = { 'Content-Type': 'application/json' };
  if (input.token) {
    headers.Authorization = `Bearer ${input.token}`;
  }
  if (input.cookie) {
    headers.Cookie = input.cookie;
  }

  const response = await fetch(input.url, {
    method: input.method,
    headers,
    body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
  });

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  const cookie = mergeCookies(input.cookie, getSetCookieHeaders(response));

  if (!response.ok || !parsed || parsed.code !== 0) {
    const error = new Error(`${name} 失败: HTTP ${response.status}`);
    error.response = parsed;
    error.status = response.status;
    throw error;
  }

  results.steps.push({
    name,
    ok: true,
    status: response.status,
    request: {
      method: input.method,
      url: stripBaseUrl(input.url),
      body: input.body ?? null,
    },
    response: summarizeData(parsed.data),
  });

  return {
    status: response.status,
    data: parsed.data,
    cookie,
  };
}

async function expectHttpFailure(results, name, input, expectedStatus) {
  const headers = { 'Content-Type': 'application/json' };
  if (input.token) {
    headers.Authorization = `Bearer ${input.token}`;
  }
  if (input.cookie) {
    headers.Cookie = input.cookie;
  }

  const response = await fetch(input.url, {
    method: input.method,
    headers,
    body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
  });

  const text = await response.text();
  const parsed = text ? JSON.parse(text) : null;
  if (response.status !== expectedStatus) {
    throw new Error(`${name} 期望 HTTP ${expectedStatus}，实际 ${response.status}`);
  }

  results.steps.push({
    name,
    ok: true,
    status: response.status,
    request: {
      method: input.method,
      url: stripBaseUrl(input.url),
      body: input.body ?? null,
    },
    response: summarizeData(parsed),
  });
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }
  const single = response.headers.get('set-cookie');
  return single ? [single] : [];
}

function mergeCookies(existingCookie, setCookieHeaders) {
  const jar = new Map();

  if (existingCookie) {
    for (const cookie of existingCookie.split(';')) {
      const [key, ...rest] = cookie.trim().split('=');
      if (!key || rest.length === 0) continue;
      jar.set(key, rest.join('='));
    }
  }

  for (const item of setCookieHeaders) {
    const [pair] = item.split(';');
    const [key, ...rest] = pair.split('=');
    if (!key || rest.length === 0) continue;
    jar.set(key.trim(), rest.join('=').trim());
  }

  return Array.from(jar.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join('; ');
}

function summarizeData(data) {
  if (Array.isArray(data)) {
    return {
      type: 'array',
      length: data.length,
      firstItem: data[0] ?? null,
    };
  }
  if (data && typeof data === 'object') {
    return data;
  }
  return data;
}

function stripBaseUrl(url) {
  const match = url.match(/\/api\/.*/);
  return match ? match[0] : url;
}

function sanitizeDatabaseUrl(url) {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

function serializeError(error) {
  return {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    status: error && typeof error === 'object' ? error.status : undefined,
    response: error && typeof error === 'object' ? error.response : undefined,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadEnvFromFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (!match) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
