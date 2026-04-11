function parseBoolean(name: string, value: string): void {
  if (value !== 'true' && value !== 'false') {
    throw new Error(`${name} 必须为 true 或 false`);
  }
}

function parseInteger(name: string, value: string): void {
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} 必须为整数`);
  }
}

export function validateEnv(rawEnv: Record<string, unknown>): Record<string, unknown> {
  const env = { ...rawEnv };

  if (!env.DATABASE_URL || typeof env.DATABASE_URL !== 'string') {
    throw new Error('DATABASE_URL 环境变量必填');
  }

  if (!env.JWT_SECRET || typeof env.JWT_SECRET !== 'string') {
    throw new Error('JWT_SECRET 环境变量必填');
  }

  if (!env.REDIS_URL || typeof env.REDIS_URL !== 'string') {
    throw new Error('REDIS_URL 环境变量必填');
  }

  if (!env.CORS_ORIGINS || typeof env.CORS_ORIGINS !== 'string') {
    throw new Error('CORS_ORIGINS 环境变量必填');
  }

  if (!env.NODE_ENV || typeof env.NODE_ENV !== 'string') {
    env.NODE_ENV = 'development';
  }

  if (!env.PORT || typeof env.PORT !== 'string') {
    env.PORT = '3000';
  }
  parseInteger('PORT', env.PORT as string);

  if (!env.AUTH_COOKIE_SECURE || typeof env.AUTH_COOKIE_SECURE !== 'string') {
    env.AUTH_COOKIE_SECURE = 'false';
  }
  parseBoolean('AUTH_COOKIE_SECURE', env.AUTH_COOKIE_SECURE as string);

  if (!env.IMPORT_JOB_WORKER_ENABLED || typeof env.IMPORT_JOB_WORKER_ENABLED !== 'string') {
    env.IMPORT_JOB_WORKER_ENABLED = 'false';
  }
  parseBoolean('IMPORT_JOB_WORKER_ENABLED', env.IMPORT_JOB_WORKER_ENABLED as string);

  if (!env.LAKALA_CASHIER_URL_PREFIX || typeof env.LAKALA_CASHIER_URL_PREFIX !== 'string') {
    env.LAKALA_CASHIER_URL_PREFIX = 'https://cashier.lakala.com/pay?tradeNo=';
  }

  return env;
}
