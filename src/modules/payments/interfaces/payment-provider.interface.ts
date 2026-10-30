export interface InitiatePaymentResult {
  reference: string;
  authorizationUrl?: string;
  providerReference?: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  meta?: any;
}

export interface VerifyPaymentResult {
  isSuccessful: boolean;
  reference: string;
  providerReference: string;
  amount: number;
  currency: string;
  rawResponse?: any;
}

export interface IPaymentProvider {
  readonly name: string;

  initiatePayment(
    reference: string,
    amount: number,
    email: string,
    callbackUrl?: string,
  ): Promise<InitiatePaymentResult>;

  verifyPayment(reference: string): Promise<VerifyPaymentResult>;

  verifyWebhookSignature(signature: string, payload: any): boolean;
}
