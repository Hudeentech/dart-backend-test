import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { WalletModule } from '../wallet/wallet.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PaystackPaymentProvider } from './providers/paystack-payment.provider';

@Module({
  imports: [WalletModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, MockPaymentProvider, PaystackPaymentProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
