import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IPaymentProvider,
  InitiatePaymentResult,
  VerifyPaymentResult,
} from '../interfaces/payment-provider.interface';
import * as crypto from 'crypto';

@Injectable()
export class PaystackPaymentProvider implements IPaymentProvider {
  readonly name = 'paystack';
  private readonly logger = new Logger(PaystackPaymentProvider.name);
  private readonly secretKey: string;
  private readonly baseUrl = 'https://api.paystack.co';

  constructor(private readonly configService: ConfigService) {
    this.secretKey = configService.get<string>('payment.paystack.secretKey');
  }

  async initiatePayment(
    reference: string,
    amount: number,
    email: string,
    callbackUrl?: string,
  ): Promise<InitiatePaymentResult> {
    try {
      const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reference,
          amount: Math.round(amount * 100), // Paystack expects Kobo
          email,
          callback_url: callbackUrl,
        }),
      });

      const data = await response.json();

      if (!data.status) {
        throw new Error(data.message || 'Failed to initialize Paystack payment');
      }

      return {
        reference,
        providerReference: data.data.reference,
        authorizationUrl: data.data.authorization_url,
        status: 'PENDING',
      };
    } catch (error) {
      this.logger.error('Paystack initialize error:', error);
      throw error;
    }
  }

  async verifyPayment(reference: string): Promise<VerifyPaymentResult> {
    try {
      const response = await fetch(`${this.baseUrl}/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
        },
      });

      const data = await response.json();

      return {
        isSuccessful: data.status && data.data?.status === 'success',
        reference,
        providerReference: data.data?.reference || reference,
        amount: data.data?.amount ? data.data.amount / 100 : 0,
        currency: data.data?.currency || 'NGN',
        rawResponse: data,
      };
    } catch (error) {
      this.logger.error('Paystack verify error:', error);
      throw error;
    }
  }

  verifyWebhookSignature(signature: string, payload: any): boolean {
    const webhookSecret = this.configService.get<string>('payment.paystack.webhookSecret') || this.secretKey;
    if (!webhookSecret || !signature) return false;

    const hash = crypto
      .createHmac('sha512', webhookSecret)
      .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  }
}
