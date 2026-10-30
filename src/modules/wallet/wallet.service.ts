import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { DepositDto, WithdrawDto } from './dto/wallet.dto';
import {
  LedgerEntryType,
  LedgerTransactionType,
  HoldStatus,
  Prisma,
} from '@prisma/client';
import { nanoid } from 'nanoid';
import { InMemoryStore } from '@/database/in-memory-store';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch wallet account with active holds and ledger summary
   */
  async getWallet(userId: string) {
    if (!this.prisma.isConnected) {
      const store = InMemoryStore.getInstance();
      const memUser = store.users.get(userId);
      const balance = memUser?.walletAccount?.balance ?? 24500;
      return {
        id: 'wallet-dev-1',
        userId,
        currency: 'NGN',
        totalBalance: balance,
        balance: balance,
        holdsBalance: 0,
        availableBalance: balance,
        isActive: true,
        activeHolds: [],
      };
    }

    let wallet = await this.prisma.walletAccount.findUnique({
      where: { userId },
      include: {
        holds: {
          where: { status: HoldStatus.ACTIVE },
        },
      },
    });

    if (!wallet) {
      // Auto-initialize if missing
      wallet = await this.prisma.walletAccount.create({
        data: { userId, currency: 'NGN' },
        include: { holds: true },
      });
    }

    const availableBalance = Number(wallet.balance) - Number(wallet.holdsBalance);

    return {
      id: wallet.id,
      userId: wallet.userId,
      currency: wallet.currency,
      totalBalance: Number(wallet.balance),
      balance: Number(wallet.balance),
      holdsBalance: Number(wallet.holdsBalance),
      availableBalance: Math.max(0, availableBalance),
      isActive: wallet.isActive,
      activeHolds: wallet.holds,
    };
  }

  /**
   * Deposit funds into wallet through verified payment intent or direct top-up
   */
  async deposit(userId: string, dto: DepositDto) {
    if (!this.prisma.isConnected) {
      const store = InMemoryStore.getInstance();
      const memUser = store.users.get(userId);
      if (memUser) {
        if (!memUser.walletAccount) {
          memUser.walletAccount = { id: 'wallet-dev-1', balance: 24500, currency: 'NGN' };
        }
        memUser.walletAccount.balance += dto.amount;
      }
      return {
        success: true,
        transaction: {
          id: `tx-dep-${Date.now()}`,
          transactionNumber: `TX-${nanoid(10).toUpperCase()}`,
          type: 'DEPOSIT',
          amount: dto.amount,
          status: 'SUCCESSFUL',
          createdAt: new Date().toISOString(),
        },
      };
    }

    const idempotencyKey = dto.idempotencyKey || `DEP-${nanoid(12)}`;

    // Check for idempotency replay
    const existingTx = await this.prisma.ledgerTransaction.findUnique({
      where: { idempotencyKey },
      include: { entries: true },
    });

    if (existingTx) {
      this.logger.warn(`Idempotent replay detected for key: ${idempotencyKey}`);
      return {
        success: true,
        isReplay: true,
        transaction: existingTx,
      };
    }

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.walletAccount.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const balanceBefore = new Prisma.Decimal(wallet.balance);
      const depositAmount = new Prisma.Decimal(dto.amount);
      const balanceAfter = balanceBefore.add(depositAmount);

      const ref = `TX-DEP-${nanoid(10).toUpperCase()}`;

      // 1. Create immutable Ledger Transaction
      const ledgerTx = await tx.ledgerTransaction.create({
        data: {
          reference: ref,
          idempotencyKey,
          type: LedgerTransactionType.DEPOSIT,
          description: `Wallet top-up via ${dto.paymentMethod || 'CARD'}`,
          amount: depositAmount,
          currency: wallet.currency,
        },
      });

      // 2. Create Ledger Entry (Credit to user wallet)
      await tx.ledgerEntry.create({
        data: {
          transactionId: ledgerTx.id,
          walletId: wallet.id,
          type: LedgerEntryType.CREDIT,
          amount: depositAmount,
          balanceBefore,
          balanceAfter,
        },
      });

      // 3. Update cached wallet balance
      const updatedWallet = await tx.walletAccount.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      return {
        success: true,
        reference: ref,
        amount: Number(depositAmount),
        balance: Number(updatedWallet.balance),
        transactionId: ledgerTx.id,
      };
    });
  }

  /**
   * Withdraw funds to external bank account
   */
  async withdraw(userId: string, dto: WithdrawDto) {
    const idempotencyKey = dto.idempotencyKey || `WTD-${nanoid(12)}`;

    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.walletAccount.findUnique({
        where: { userId },
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      const availableBalance = new Prisma.Decimal(wallet.balance).sub(
        new Prisma.Decimal(wallet.holdsBalance),
      );
      const withdrawAmount = new Prisma.Decimal(dto.amount);

      if (availableBalance.lessThan(withdrawAmount)) {
        throw new BadRequestException('Insufficient available funds for withdrawal');
      }

      const balanceBefore = new Prisma.Decimal(wallet.balance);
      const balanceAfter = balanceBefore.sub(withdrawAmount);
      const ref = `TX-WTD-${nanoid(10).toUpperCase()}`;

      // 1. Ledger Transaction
      const ledgerTx = await tx.ledgerTransaction.create({
        data: {
          reference: ref,
          idempotencyKey,
          type: LedgerTransactionType.WITHDRAWAL,
          description: `Withdrawal to ${dto.bankName || 'Bank'} - ${dto.accountNumber}`,
          amount: withdrawAmount,
          currency: wallet.currency,
        },
      });

      // 2. Ledger Entry (Debit)
      await tx.ledgerEntry.create({
        data: {
          transactionId: ledgerTx.id,
          walletId: wallet.id,
          type: LedgerEntryType.DEBIT,
          amount: withdrawAmount,
          balanceBefore,
          balanceAfter,
        },
      });

      // 3. Update wallet
      await tx.walletAccount.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      // 4. Create Withdrawal Record
      const withdrawal = await tx.withdrawal.create({
        data: {
          walletId: wallet.id,
          amount: withdrawAmount,
          bankCode: dto.bankCode,
          bankName: dto.bankName || 'Commercial Bank',
          accountNumber: dto.accountNumber,
          accountName: dto.accountName,
          status: 'PROCESSING',
          providerReference: `BANK-REF-${nanoid(8).toUpperCase()}`,
        },
      });

      return {
        success: true,
        reference: ref,
        withdrawalId: withdrawal.id,
        amount: Number(withdrawAmount),
        balance: Number(balanceAfter),
      };
    });
  }

  /**
   * Place an escrow hold on customer's wallet for an active order
   */
  async placeEscrowHold(
    tx: Prisma.TransactionClient,
    walletId: string,
    orderId: string,
    amount: number | Prisma.Decimal,
  ) {
    const holdAmount = new Prisma.Decimal(amount);
    const wallet = await tx.walletAccount.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet account not found');
    }

    const availableBalance = new Prisma.Decimal(wallet.balance).sub(
      new Prisma.Decimal(wallet.holdsBalance),
    );

    if (availableBalance.lessThan(holdAmount)) {
      throw new BadRequestException(
        `Insufficient wallet balance. Required: ₦${holdAmount}, Available: ₦${availableBalance}`,
      );
    }

    // Update holds balance
    await tx.walletAccount.update({
      where: { id: walletId },
      data: {
        holdsBalance: new Prisma.Decimal(wallet.holdsBalance).add(holdAmount),
      },
    });

    // Record WalletHold
    return tx.walletHold.create({
      data: {
        walletId,
        orderId,
        amount: holdAmount,
        status: HoldStatus.ACTIVE,
      },
    });
  }

  /**
   * Release hold upon cancellation
   */
  async releaseEscrowHold(
    tx: Prisma.TransactionClient,
    walletId: string,
    orderId: string,
  ) {
    const hold = await tx.walletHold.findUnique({
      where: { orderId },
    });

    if (!hold || hold.status !== HoldStatus.ACTIVE) {
      return null;
    }

    const wallet = await tx.walletAccount.findUnique({
      where: { id: walletId },
    });

    if (wallet) {
      const newHolds = Prisma.Decimal.max(
        0,
        new Prisma.Decimal(wallet.holdsBalance).sub(new Prisma.Decimal(hold.amount)),
      );

      await tx.walletAccount.update({
        where: { id: walletId },
        data: { holdsBalance: newHolds },
      });
    }

    return tx.walletHold.update({
      where: { id: hold.id },
      data: { status: HoldStatus.RELEASED },
    });
  }

  /**
   * Complete delivery settlement atomically:
   * - Release & capture customer hold (Debit customer wallet balance & clear hold)
   * - Credit rider wallet with net settlement fee
   * - Record platform fee & settlement record
   */
  async settleOrderFunds(
    tx: Prisma.TransactionClient,
    customerWalletId: string,
    riderUserId: string,
    orderId: string,
    totalPrice: Prisma.Decimal | number,
    platformFee: Prisma.Decimal | number,
    riderSettlementFee: Prisma.Decimal | number,
  ) {
    const totalAmount = new Prisma.Decimal(totalPrice);
    const feeAmount = new Prisma.Decimal(platformFee);
    const riderAmount = new Prisma.Decimal(riderSettlementFee);

    // 1. Settle customer wallet
    const customerWallet = await tx.walletAccount.findUnique({
      where: { id: customerWalletId },
    });

    if (customerWallet) {
      const custBefore = new Prisma.Decimal(customerWallet.balance);
      const custAfter = custBefore.sub(totalAmount);
      const newHolds = Prisma.Decimal.max(
        0,
        new Prisma.Decimal(customerWallet.holdsBalance).sub(totalAmount),
      );

      await tx.walletAccount.update({
        where: { id: customerWalletId },
        data: {
          balance: custAfter,
          holdsBalance: newHolds,
        },
      });

      // Customer Debit Ledger
      const custTxRef = `TX-PAY-${nanoid(8).toUpperCase()}`;
      const custTx = await tx.ledgerTransaction.create({
        data: {
          reference: custTxRef,
          type: LedgerTransactionType.ORDER_PAYMENT,
          description: `Payment for delivery order #${orderId}`,
          amount: totalAmount,
          orderId,
        },
      });

      await tx.ledgerEntry.create({
        data: {
          transactionId: custTx.id,
          walletId: customerWalletId,
          type: LedgerEntryType.DEBIT,
          amount: totalAmount,
          balanceBefore: custBefore,
          balanceAfter: custAfter,
        },
      });

      // Update hold status to CAPTURED
      await tx.walletHold.updateMany({
        where: { orderId, status: HoldStatus.ACTIVE },
        data: { status: HoldStatus.CAPTURED },
      });
    }

    // 2. Credit Rider Wallet
    let riderWallet = await tx.walletAccount.findUnique({
      where: { userId: riderUserId },
    });

    if (!riderWallet) {
      riderWallet = await tx.walletAccount.create({
        data: { userId: riderUserId, currency: 'NGN' },
      });
    }

    const riderBefore = new Prisma.Decimal(riderWallet.balance);
    const riderAfter = riderBefore.add(riderAmount);

    await tx.walletAccount.update({
      where: { id: riderWallet.id },
      data: { balance: riderAfter },
    });

    // Rider Credit Ledger
    const riderTxRef = `TX-SETTLE-${nanoid(8).toUpperCase()}`;
    const riderTx = await tx.ledgerTransaction.create({
      data: {
        reference: riderTxRef,
        type: LedgerTransactionType.RIDER_SETTLEMENT,
        description: `Settlement for completed delivery #${orderId}`,
        amount: riderAmount,
        orderId,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        transactionId: riderTx.id,
        walletId: riderWallet.id,
        type: LedgerEntryType.CREDIT,
        amount: riderAmount,
        balanceBefore: riderBefore,
        balanceAfter: riderAfter,
      },
    });

    // 3. Create immutable Settlement record
    return tx.settlement.create({
      data: {
        orderId,
        riderId: riderUserId,
        grossAmount: totalAmount,
        platformFee: feeAmount,
        netAmount: riderAmount,
        isSettled: true,
        settledAt: new Date(),
      },
    });
  }

  /**
   * Get ledger transaction history
   */
  async getTransactions(userId: string) {
    if (!this.prisma.isConnected) {
      return [
        {
          id: 'tx-1',
          type: 'CREDIT',
          amount: 20500,
          description: 'Wallet Top-up',
          createdAt: new Date().toISOString(),
          transaction: {
            transactionNumber: 'TX-DEP-9912',
            type: 'DEPOSIT',
            description: 'Wallet Top-up via Card',
          },
        },
        {
          id: 'tx-2',
          type: 'DEBIT',
          amount: 5000,
          description: 'Delivery Payment (Auchi → Benin)',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          transaction: {
            transactionNumber: 'TX-ORD-4412',
            type: 'ORDER_PAYMENT',
            description: 'Delivery Payment',
          },
        },
      ];
    }

    const wallet = await this.prisma.walletAccount.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return this.prisma.ledgerEntry.findMany({
      where: { walletId: wallet.id },
      include: {
        transaction: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
