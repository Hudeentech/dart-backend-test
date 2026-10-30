import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { OrderStatus, AccountStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * System overview metrics
   */
  async getDashboardMetrics() {
    const totalUsers = await this.prisma.user.count();
    const totalRiders = await this.prisma.riderProfile.count();
    const onlineRiders = await this.prisma.riderAvailability.count({
      where: { status: 'ONLINE' },
    });
    const totalOrders = await this.prisma.order.count();
    const completedOrders = await this.prisma.order.count({
      where: { status: OrderStatus.SETTLED },
    });

    const activeOrders = await this.prisma.order.count({
      where: {
        status: {
          in: [
            OrderStatus.PAYMENT_CONFIRMED,
            OrderStatus.RIDER_ASSIGNED,
            OrderStatus.RIDER_ACCEPTED,
            OrderStatus.PICKUP_PENDING,
            OrderStatus.PICKED_UP,
            OrderStatus.IN_TRANSIT,
          ],
        },
      },
    });

    const revenueResult = await this.prisma.settlement.aggregate({
      _sum: {
        platformFee: true,
        grossAmount: true,
      },
    });

    return {
      users: { total: totalUsers, riders: totalRiders, onlineRiders },
      orders: { total: totalOrders, active: activeOrders, completed: completedOrders },
      financials: {
        totalGrossVolume: revenueResult._sum.grossAmount || 0,
        totalPlatformRevenue: revenueResult._sum.platformFee || 0,
      },
    };
  }

  /**
   * Audit logs
   */
  async getAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, email: true, role: true },
          },
        },
      }),
      this.prisma.auditLog.count(),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Deep investigation of an order (all timeline events, payments, holds, code hashes, and settlements)
   */
  async inspectOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        rider: { include: { riderProfile: true } },
        package: { include: { items: true } },
        pickupAddress: true,
        destinationAddress: true,
        deliveryEvents: { orderBy: { createdAt: 'asc' } },
        paymentIntents: true,
        walletHold: true,
        settlement: true,
        handoverCode: true,
        ratings: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Update user account status (e.g. suspend / activate)
   */
  async updateUserStatus(userId: string, status: AccountStatus, reason?: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });
  }
}
