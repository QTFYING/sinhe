import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import {
  H5PaymentController,
  PaymentWebhookController,
  TenantPaymentController,
} from './payment.controller';

@Module({
  controllers: [H5PaymentController, PaymentWebhookController, TenantPaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
