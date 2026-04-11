import { OrderImportJobStatusEnum as PrismaImportJobStatusEnum } from '@prisma/client';

export interface ImportJobProgressSnapshot {
  successCount: number;
  skippedCount: number;
  overwrittenCount: number;
  failedCount: number;
}

export interface ImportWorkerEnvLike {
  IMPORT_JOB_WORKER_ENABLED?: string;
}

export function isImportWorkerEnabled(env: ImportWorkerEnvLike): boolean {
  return env.IMPORT_JOB_WORKER_ENABLED === 'true';
}

export function resolveImportJobFinalStatus(
  progress: ImportJobProgressSnapshot,
): PrismaImportJobStatusEnum {
  return progress.failedCount > 0 &&
    progress.successCount === 0 &&
    progress.overwrittenCount === 0 &&
    progress.skippedCount === 0
    ? PrismaImportJobStatusEnum.FAILED
    : PrismaImportJobStatusEnum.COMPLETED;
}

export function shouldStartImportJobImmediately(env: ImportWorkerEnvLike): boolean {
  return isImportWorkerEnabled(env);
}
