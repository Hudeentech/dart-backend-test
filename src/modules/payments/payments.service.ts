import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PaystackPaymentProvider } from './providers/paystack-payment.provider';
import { IPaymentProvider } from './interfaces/payment-provider.interface';
import { ProcessOrderPaymentDto } from './dto/payment.dto';
import { SaveCardDto } from './dto/card.dto';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { nanoid } from 'nanoid';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly provider: IPaymentProvider;

  constructor(
    private readonly prisma: PrismaService,
    private readonly walletService: WalletService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
    private readonly mockProvider: MockPaymentProvider,
    private readonly paystackProvider: PaystackPaymentProvider,
  ) {
    const selected = configService.get<string>('payment.provider');
    this.provider = selected === 'paystack' ? paystackProvider : mockProvider;
    this.logger.log(`Initialized PaymentsService with provider: ${this.provider.name}`);
  }

  /**
   * Process payment for an order based on selected method
   */
  async processOrderPayment(
    userId: string,
    orderId: string,
    dto: ProcessOrderPaymentDto,
  ) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        package: true,
        pickupAddress: true,
        destinationAddress: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.customerId !== userId) {
      throw new BadRequestException('Unauthorized order access');
    }

    if (
      order.status !== OrderStatus.RIDER_SELECTED &&
      order.status !== OrderStatus.PAYMENT_PENDING &&
      order.status !== OrderStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Order cannot be paid in current state: ${order.status}`,
      );
    }

    const nextStatus = order.riderId ? OrderStatus.RIDER_ASSIGNED : OrderStatus.PAYMENT_CONFIRMED;
    const custName = [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ') || 'Customer';

    // 1. Process WALLET payment (Escrow hold)
    if (dto.paymentMethod === PaymentMethod.WALLET) {
      const res = await this.prisma.$transaction(async (tx) => {
        const wallet = await tx.walletAccount.findUnique({
          where: { userId },
        });

        if (!wallet) {
          throw new NotFoundException('Wallet account not found');
        }

        // Place escrow hold
        await this.walletService.placeEscrowHold(
          tx,
          wallet.id,
          order.id,
          order.totalPrice,
        );

        // Advance order state
        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: {
            paymentMethod: PaymentMethod.WALLET,
            status: nextStatus,
          },
        });

        // Record Delivery Event
        await tx.deliveryEvent.create({
          data: {
            orderId: order.id,
            status: nextStatus,
            description: `Payment confirmed via Wallet Escrow Hold (₦${order.totalPrice}).${order.riderId ? ' Rider assigned.' : ''}`,
            actorId: userId,
          },
        });

        return {
          success: true,
          paymentMethod: PaymentMethod.WALLET,
          status: nextStatus,
          order: updatedOrder,
        };
      });

      // Notify rider if assigned
      if (order.riderId) {
        this.notificationsService
          .createNotification({
            userId: order.riderId,
            title: 'New Delivery Request!',
            message: `New pickup request for ${order.package?.name || 'Package'} from ${custName}.`,
            type: 'DELIVERY',
            data: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              trackingId: order.trackingId,
              totalPrice: Number(order.totalPrice),
            },
          })
          .catch(() => {});
      }

      // Notify customer
      this.notificationsService
        .createNotification({
          userId: order.customerId,
          title: 'Payment Confirmed',
          message: `Your payment of ₦${Number(order.totalPrice).toLocaleString()} has been confirmed.${order.riderId ? ' Rider assigned!' : ''}`,
          type: 'PAYMENT',
          data: { orderId: order.id, trackingId: order.trackingId },
        })
        .catch(() => {});

      return res;
    }

    // 2. Process CASH ON DELIVERY (COD)
    if (dto.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
      if (Number(order.totalPrice) > 50000) {
        throw new BadRequestException(
          'Orders exceeding ₦50,000 are not eligible for Cash on Delivery',
        );
      }

      const res = await this.prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: {
            paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
            isCodEligible: true,
            status: nextStatus,
          },
        });

        await tx.deliveryEvent.create({
          data: {
            orderId: order.id,
            status: nextStatus,
            description: `Order confirmed for Cash On Delivery (Expected cash: ₦${order.totalPrice}).${order.riderId ? ' Rider assigned.' : ''}`,
            actorId: userId,
          },
        });

        return {
          success: true,
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          status: nextStatus,
          order: updatedOrder,
        };
      });

      if (order.riderId) {
        this.notificationsService
          .createNotification({
            userId: order.riderId,
            title: 'New Delivery Request!',
            message: `New pickup request for ${order.package?.name || 'Package'} from ${custName}.`,
            type: 'DELIVERY',
            data: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              trackingId: order.trackingId,
              totalPrice: Number(order.totalPrice),
            },
          })
          .catch(() => {});
      }

      this.notificationsService
        .createNotification({
          userId: order.customerId,
          title: 'Order Confirmed (Cash On Delivery)',
          message: `Your delivery order has been booked for Cash on Delivery.${order.riderId ? ' Rider assigned!' : ''}`,
          type: 'PAYMENT',
          data: { orderId: order.id, trackingId: order.trackingId },
        })
        .catch(() => {});

      return res;
    }

    // 3. Process ONLINE / CARD payment
    const paymentRef = `PAY-ORD-${nanoid(10).toUpperCase()}`;

    const initiateResult = await this.provider.initiatePayment(
      paymentRef,
      Number(order.totalPrice),
      order.customer.email,
      dto.callbackUrl,
    );

    await this.prisma.paymentIntent.create({
      data: {
        orderId: order.id,
        reference: paymentRef,
        provider: this.provider.name,
        providerReference: initiateResult.providerReference || paymentRef,
        amount: order.totalPrice,
        paymentMethod: dto.paymentMethod,
        status: PaymentStatus.PENDING,
      },
    });

    await this.prisma.order.update({
      where: { id: order.id },
      data: {
        paymentMethod: dto.paymentMethod,
        status: OrderStatus.PAYMENT_PENDING,
      },
    });

    return {
      success: true,
      reference: paymentRef,
      authorizationUrl: initiateResult.authorizationUrl,
      status: PaymentStatus.PENDING,
    };
  }

  /**
   * Process webhook from Payment Gateway
   */
  async handleWebhook(signature: string, payload: any) {
    const isValid = this.provider.verifyWebhookSignature(signature, payload);
    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = payload.event;
    const data = payload.data;

    this.logger.log(`Received payment webhook event: ${event}`);

    if (event === 'charge.success' || payload.status === 'success') {
      const reference = data?.reference || payload.reference;

      const intent = await this.prisma.paymentIntent.findUnique({
        where: { reference },
        include: { order: true },
      });

      if (!intent) {
        this.logger.warn(`PaymentIntent not found for ref: ${reference}`);
        return { received: true };
      }

      if (intent.status === PaymentStatus.SUCCESSFUL) {
        // Idempotent return
        return { received: true, alreadyProcessed: true };
      }

      const order = await this.prisma.order.findUnique({
        where: { id: intent.orderId },
        include: { customer: true, package: true },
      });
      const nextStatus = order?.riderId ? OrderStatus.RIDER_ASSIGNED : OrderStatus.PAYMENT_CONFIRMED;

      await this.prisma.$transaction(async (tx) => {
        await tx.paymentIntent.update({
          where: { id: intent.id },
          data: {
            status: PaymentStatus.SUCCESSFUL,
            rawWebhookPayload: payload,
          },
        });

        await tx.order.update({
          where: { id: intent.orderId },
          data: { status: nextStatus },
        });

        await tx.deliveryEvent.create({
          data: {
            orderId: intent.orderId,
            status: nextStatus,
            description: `Payment confirmed via ${intent.provider} webhook (Ref: ${reference}).${order?.riderId ? ' Rider assigned.' : ''}`,
          },
        });
      });

      if (order?.riderId) {
        const custName = [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ') || 'Customer';
        this.notificationsService
          .createNotification({
            userId: order.riderId,
            title: 'New Delivery Request!',
            message: `New pickup request for ${order.package?.name || 'Package'} from ${custName}.`,
            type: 'DELIVERY',
            data: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              trackingId: order.trackingId,
              totalPrice: Number(order.totalPrice),
            },
          })
          .catch(() => {});
      }
    }

    return { received: true };
  }

  // --------------------------------------------------------
  // CARD TOKENIZATION & SAVED METHODS MANAGEMENT
  // --------------------------------------------------------

  /**
   * Helper to detect card brand from number
   */
  private detectCardBrand(num: string): 'mastercard' | 'visa' | 'verve' {
    const clean = num.replace(/\D/g, '');
    if (clean.startsWith('4')) {
      return 'visa';
    }
    if (
      clean.startsWith('506') ||
      clean.startsWith('507') ||
      clean.startsWith('6500')
    ) {
      return 'verve';
    }
    return 'mastercard';
  }

  /**
   * List all saved cards for a user
   */
  async listSavedCards(userId: string) {
    return this.prisma.savedCard.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Save and tokenize a new card
   */
  async saveCard(userId: string, dto: SaveCardDto) {
    const cleanNum = dto.cardNumber.replace(/\s+/g, '').replace(/\D/g, '');
    if (cleanNum.length < 16 || cleanNum.length > 19) {
      throw new BadRequestException('Invalid card number. Must be 16 to 19 digits.');
    }

    const cardBrand = this.detectCardBrand(cleanNum);
    const last4 = cleanNum.slice(-4);

    const expiryParts = dto.expiry.split(/[\/\-]/);
    const expMonth = expiryParts[0]?.padStart(2, '0') || '12';
    const expYear = expiryParts[1]?.slice(-2) || '28';

    // Count existing cards
    const existingCount = await this.prisma.savedCard.count({
      where: { userId },
    });

    const isDefault = existingCount === 0 || dto.setAsDefault === true;

    return this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        // Demote previous default cards
        await tx.savedCard.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      const card = await tx.savedCard.create({
        data: {
          userId,
          cardType: cardBrand,
          last4,
          expMonth,
          expYear,
          cardHolder: dto.cardHolder || 'DART Customer',
          token: `tok_${nanoid(18)}`,
          provider: 'paystack',
          isDefault,
        },
      });

      // Send in-app notification confirming saved payment method
      await tx.notification.create({
        data: {
          userId,
          title: 'Card Saved Successfully',
          message: `Your ${cardBrand.toUpperCase()} ending in •••• ${last4} was saved as a payment method.`,
          type: 'PAYMENT',
          data: {
            cardId: card.id,
            cardType: cardBrand,
            last4,
          },
        },
      });

      return card;
    });
  }

  /**
   * Set a specific card as default
   */
  async setDefaultCard(userId: string, cardId: string) {
    const card = await this.prisma.savedCard.findFirst({
      where: { id: cardId, userId },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    await this.prisma.$transaction([
      this.prisma.savedCard.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      }),
      this.prisma.savedCard.update({
        where: { id: cardId },
        data: { isDefault: true },
      }),
    ]);

    return this.prisma.savedCard.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Delete a saved card
   */
  async deleteCard(userId: string, cardId: string) {
    const card = await this.prisma.savedCard.findFirst({
      where: { id: cardId, userId },
    });

    if (!card) {
      throw new NotFoundException('Card not found');
    }

    await this.prisma.savedCard.delete({
      where: { id: cardId },
    });

    // If deleted card was default, set the next most recent card as default
    if (card.isDefault) {
      const nextCard = await this.prisma.savedCard.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      if (nextCard) {
        await this.prisma.savedCard.update({
          where: { id: nextCard.id },
          data: { isDefault: true },
        });
      }
    }

    return { success: true, message: 'Card removed successfully' };
  }

  /**
   * Get payment methods overview including wallet balance and saved cards
   */
  async getPaymentOverview(userId: string) {
    const wallet = await this.walletService.getWallet(userId);
    const cards = await this.listSavedCards(userId);

    return {
      walletBalance: wallet.balance,
      walletCurrency: wallet.currency,
      cards,
      allowCashOnDelivery: true,
    };
  }
}
