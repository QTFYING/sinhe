import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PayController, PaymentWebhookController, ManualPaidController } from './payment.controller';

@Module({
  controllers: [PayController, PaymentWebhookController, ManualPaidController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
