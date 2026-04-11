import { registerAs } from '@nestjs/config';

export const importConfig = registerAs('import', () => ({
  workerEnabled: process.env.IMPORT_JOB_WORKER_ENABLED === 'true',
}));
