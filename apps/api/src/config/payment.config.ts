import { registerAs } from '@nestjs/config';

export const paymentConfig = registerAs('payment', () => ({
  lakalaCashierUrlPrefix:
    process.env.LAKALA_CASHIER_URL_PREFIX ?? 'https://cashier.lakala.com/pay?tradeNo=',
}));
