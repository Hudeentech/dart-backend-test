import { Injectable, Logger } from '@nestjs/common';
import {
  IPaymentProvider,
  InitiatePaymentResult,
  VerifyPaymentResult,
} from '../interfaces/payment-provider.interface';
import { nanoid } from 'nanoid';

@Injectable()
export class MockPaymentProvider implements IPaymentProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockPaymentProvider.name);

  async initiatePayment(
    reference: string,
    amount: number,
    email: string,
    callbackUrl?: string,
  ): Promise<InitiatePaymentResult> {
    this.logger.log(
      `[MOCK PAYMENT INITIATED] Ref: ${reference}, Amount: ₦${amount}, Email: ${email}`,
    );

    return {
      reference,
      providerReference: `MOCK-PAY-${nanoid(8)}`,
      authorizationUrl: `https://checkout.dart.ng/mock-pay?ref=${reference}&amount=${amount}`,
      status: 'PENDING',
    };
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    this.logger.log(`[MOCK PAYMENT VERIFIED] Ref: ${reference}`);
    return {
      isSuccessful: true,
      reference,
      providerReference: `MOCK-PAY-CONFIRMED-${nanoid(6)}`,
      amount: 1000,
      currency: 'NGN',
    };
  }

  verifyWebhookSignature(signature: string, payload: any): boolean {
    return true; // Always valid in mock environment
  }
}
