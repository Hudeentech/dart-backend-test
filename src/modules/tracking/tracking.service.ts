import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Public tracking by trackingId (e.g. TRK-A8F7D9)
   */
  async getTrackingTimeline(trackingId: string) {
    if (!this.prisma.isConnected) {
      throw new NotFoundException(`Tracking ID ${trackingId} not found`);
    }

    const order = await this.prisma.order.findUnique({
      where: { trackingId },
      include: {
        package: {
          select: {
            name: true,
            category: true,
            weightKg: true,
            isFragile: true,
            photoUrl: true,
          },
        },
        pickupAddress: {
          select: {
            city: true,
            state: true,
            street: true,
          },
        },
        destinationAddress: {
          select: {
            city: true,
            state: true,
            street: true,
          },
        },
        rider: {
          select: {
            firstName: true,
            lastName: true,
            phoneNumber: true,
            riderProfile: {
              select: {
                vehicleType: true,
                plateNumber: true,
                averageRating: true,
              },
            },
          },
        },
        deliveryEvents: {
          select: {
            status: true,
            description: true,
            latitude: true,
            longitude: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Tracking record not found');
    }

    return {
      orderNumber: order.orderNumber,
      trackingId: order.trackingId,
      status: order.status,
      distanceKm: order.distanceKm,
      estimatedMinutes: order.estimatedMinutes,
      package: order.package,
      pickup: order.pickupAddress,
      destination: order.destinationAddress,
      rider: order.rider
        ? {
            name: `${order.rider.firstName} ${order.rider.lastName[0]}.`,
            vehicle: order.rider.riderProfile?.vehicleType,
            plateNumber: order.rider.riderProfile?.plateNumber,
            rating: order.rider.riderProfile?.averageRating,
          }
        : null,
      timeline: order.deliveryEvents,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
