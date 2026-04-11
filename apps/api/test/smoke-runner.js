const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  isImportWorkerEnabled,
  resolveImportJobFinalStatus,
  shouldStartImportJobImmediately,
} = require('../dist/import/import-job.worker.helpers');
const {
  deriveOrderStatus,
  resolveCreditOrderStatus,
} = require('../dist/order/order.domain');
const {
  PAYMENT_PAYING_EXPIRE_MINUTES,
  resolvePaymentOrderStatus,
  shouldExpirePayingPaymentOrder,
} = require('../dist/payment/payment.domain');
const {
  OrderStatusEnum: PrismaOrderStatusEnum,
  PaymentOrderStatusEnum: PrismaPaymentOrderStatusEnum,
} = require('@prisma/client');

const OrderPayTypeEnum = {
  CASH: 'cash',
  CREDIT: 'credit',
};

const OrderStatusEnum = {
  PENDING: 'pending',
  PARTIAL: 'partial',
  PAID: 'paid',
  EXPIRED: 'expired',
  CREDIT: 'credit',
};

const CreditOrderStatusEnum = {
  NORMAL: 'normal',
  SOON: 'soon',
  TODAY: 'today',
  OVERDUE: 'overdue',
};

const PaymentOrderStatusEnum = {
  UNPAID: 'unpaid',
  PAYING: 'paying',
  PENDING_VERIFICATION: 'pending_verification',
  PAID: 'paid',
  EXPIRED: 'expired',
};

function run(name, fn) {
  try {
    fn();
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    process.stderr.write(`FAIL ${name}\n`);
    throw error;
  }
}

run('IMPORT_JOB_WORKER_ENABLED=true 时启用独立 Worker', () => {
  assert.equal(isImportWorkerEnabled({ IMPORT_JOB_WORKER_ENABLED: 'true' }), true);
  assert.equal(shouldStartImportJobImmediately({ IMPORT_JOB_WORKER_ENABLED: 'true' }), true);
});

run('未开启 IMPORT_JOB_WORKER_ENABLED 时 API 进程不直接消费导入任务', () => {
  assert.equal(isImportWorkerEnabled({}), false);
  assert.equal(shouldStartImportJobImmediately({}), false);
});

run('全部失败且无成功/跳过/覆盖时任务状态为 FAILED', () => {
  assert.equal(
    resolveImportJobFinalStatus({
      successCount: 0,
      skippedCount: 0,
      overwrittenCount: 0,
      failedCount: 3,
    }),
    'FAILED',
  );
});

run('存在成功、跳过或覆盖结果时任务最终状态为 COMPLETED', () => {
  assert.equal(
    resolveImportJobFinalStatus({
      successCount: 1,
      skippedCount: 0,
      overwrittenCount: 0,
      failedCount: 1,
    }),
    'COMPLETED',
  );
  assert.equal(
    resolveImportJobFinalStatus({
      successCount: 0,
      skippedCount: 1,
      overwrittenCount: 0,
      failedCount: 2,
    }),
    'COMPLETED',
  );
  assert.equal(
    resolveImportJobFinalStatus({
      successCount: 0,
      skippedCount: 0,
      overwrittenCount: 1,
      failedCount: 2,
    }),
    'COMPLETED',
  );
});

run('构建产物包含独立导入 Worker 入口', () => {
  const workerEntry = path.join(__dirname, '..', 'dist', 'import-worker.main.js');
  assert.equal(fs.existsSync(workerEntry), true);
});

run('构建产物包含导入 Worker 调度 helper', () => {
  const helperEntry = path.join(__dirname, '..', 'dist', 'import', 'import-job.worker.helpers.js');
  assert.equal(fs.existsSync(helperEntry), true);
});

run('订单状态推导覆盖现金、账期、部分支付、全额支付与作废场景', () => {
  assert.equal(deriveOrderStatus(OrderPayTypeEnum.CASH, '100', '0', false), OrderStatusEnum.PENDING);
  assert.equal(deriveOrderStatus(OrderPayTypeEnum.CREDIT, '100', '0', false), OrderStatusEnum.CREDIT);
  assert.equal(deriveOrderStatus(OrderPayTypeEnum.CASH, '100', '20', false), OrderStatusEnum.PARTIAL);
  assert.equal(deriveOrderStatus(OrderPayTypeEnum.CASH, '100', '100', false), OrderStatusEnum.PAID);
  assert.equal(deriveOrderStatus(OrderPayTypeEnum.CASH, '100', '0', true), OrderStatusEnum.EXPIRED);
});

run('账期状态推导覆盖逾期、当天、临近与正常场景', () => {
  const now = new Date('2026-04-11T09:00:00');
  assert.equal(resolveCreditOrderStatus(new Date('2026-04-10T12:00:00'), now), CreditOrderStatusEnum.OVERDUE);
  assert.equal(resolveCreditOrderStatus(new Date('2026-04-11T18:00:00'), now), CreditOrderStatusEnum.TODAY);
  assert.equal(resolveCreditOrderStatus(new Date('2026-04-15T12:00:00'), now), CreditOrderStatusEnum.SOON);
  assert.equal(resolveCreditOrderStatus(new Date('2026-04-25T12:00:00'), now), CreditOrderStatusEnum.NORMAL);
});

run('支付状态推导覆盖已作废、已支付、待支付与待核销场景', () => {
  assert.equal(
    resolvePaymentOrderStatus(
      { status: PrismaOrderStatusEnum.EXPIRED, voided: false, amount: '100', paid: '0' },
      null,
    ),
    PaymentOrderStatusEnum.EXPIRED,
  );
  assert.equal(
    resolvePaymentOrderStatus(
      { status: PrismaOrderStatusEnum.PAID, voided: false, amount: '100', paid: '100' },
      null,
    ),
    PaymentOrderStatusEnum.PAID,
  );
  assert.equal(
    resolvePaymentOrderStatus(
      { status: PrismaOrderStatusEnum.PENDING, voided: false, amount: '100', paid: '0' },
      null,
    ),
    PaymentOrderStatusEnum.UNPAID,
  );
  assert.equal(
    resolvePaymentOrderStatus(
      { status: PrismaOrderStatusEnum.PENDING, voided: false, amount: '100', paid: '0' },
      { status: PrismaPaymentOrderStatusEnum.PENDING_VERIFICATION },
    ),
    PaymentOrderStatusEnum.PENDING_VERIFICATION,
  );
});

run('PAYING 支付单超过超时时间后应转入过期判定', () => {
  assert.equal(
    shouldExpirePayingPaymentOrder(
      {
        status: PrismaPaymentOrderStatusEnum.PAYING,
        lastInitiatedAt: new Date(
          Date.now() - (PAYMENT_PAYING_EXPIRE_MINUTES + 1) * 60 * 1000,
        ),
      },
      new Date(),
    ),
    true,
  );
  assert.equal(
    shouldExpirePayingPaymentOrder(
      {
        status: PrismaPaymentOrderStatusEnum.PAYING,
        lastInitiatedAt: new Date(),
      },
      new Date(),
    ),
    false,
  );
});

run('构建产物包含订单领域规则 helper', () => {
  const helperEntry = path.join(__dirname, '..', 'dist', 'order', 'order.domain.js');
  assert.equal(fs.existsSync(helperEntry), true);
});

run('构建产物包含支付领域规则 helper', () => {
  const helperEntry = path.join(__dirname, '..', 'dist', 'payment', 'payment.domain.js');
  assert.equal(fs.existsSync(helperEntry), true);
});
