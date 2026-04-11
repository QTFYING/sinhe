const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  isImportWorkerEnabled,
  resolveImportJobFinalStatus,
  shouldStartImportJobImmediately,
} = require('../dist/import/import-job.worker.helpers');

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
