import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  UpdateRiderAvailabilityDto,
  UpdateRiderLocationDto,
  UpdateRiderProfileDto,
  FindAvailableRidersQueryDto,
} from './dto/rider.dto';
import { OrderStatus, RiderStatus } from '@prisma/client';

@Injectable()
export class RidersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getProfile(userId: string) {
    const profile = await this.prisma.riderProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phoneNumber: true,
            email: true,
            profileImageUrl: true,
          },
        },
        availability: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('Rider profile not found');
    }

    return profile;
  }

  async updateProfile(userId: string, dto: UpdateRiderProfileDto) {
    const profile = await this.prisma.riderProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Rider profile not found');
    }

    return this.prisma.riderProfile.update({
      where: { userId },
      data: {
        vehicleType: dto.vehicleType,
        plateNumber: dto.plateNumber,
        licenseNumber: dto.licenseNumber,
      },
    });
  }

  async updateAvailability(userId: string, dto: UpdateRiderAvailabilityDto) {
    const profile = await this.prisma.riderProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Rider profile not found');
    }

    return this.prisma.riderAvailability.upsert({
      where: { riderProfileId: profile.id },
      update: { status: dto.status },
      create: {
        riderProfileId: profile.id,
        status: dto.status,
      },
    });
  }

  async updateLocation(userId: string, dto: UpdateRiderLocationDto) {
    const profile = await this.prisma.riderProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Rider profile not found');
    }

    const updatedProfile = await this.prisma.riderProfile.update({
      where: { userId },
      data: {
        currentLat: dto.latitude,
        currentLng: dto.longitude,
        lastLocationAt: new Date(),
      },
    });

    const activeOrders = await this.prisma.order.findMany({
      where: {
        riderId: userId,
        status: { in: [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT] },
        arrivalNotifiedAt: null,
      },
      select: {
        id: true,
        customerId: true,
        trackingId: true,
        destinationAddress: {
          select: { latitude: true, longitude: true },
        },
      },
    });

    for (const order of activeOrders) {
      const distanceKm = this.calculateHaversineDistance(
        dto.latitude,
        dto.longitude,
        order.destinationAddress.latitude,
        order.destinationAddress.longitude,
      );
      if (distanceKm > 0.5) continue;

      const arrivedAt = new Date();
      const arrivalRecorded = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.order.updateMany({
          where: {
            id: order.id,
            riderId: userId,
            status: { in: [OrderStatus.PICKED_UP, OrderStatus.IN_TRANSIT] },
            arrivalNotifiedAt: null,
          },
          data: { arrivalNotifiedAt: arrivedAt },
        });
        if (updated.count !== 1) return false;

        await tx.deliveryEvent.create({
          data: {
            orderId: order.id,
            status: OrderStatus.IN_TRANSIT,
            description: 'Rider has arrived near the delivery destination.',
            actorId: userId,
            latitude: dto.latitude,
            longitude: dto.longitude,
            metadata: { eventType: 'ARRIVAL_IMMINENT', distanceKm },
          },
        });
        return true;
      });

      if (arrivalRecorded) {
        await this.notificationsService.createNotification({
          userId: order.customerId,
          title: 'Your rider is nearby',
          message: 'Your rider is within 500 meters of the delivery location.',
          type: 'ORDER_UPDATE',
          data: { orderId: order.id, trackingId: order.trackingId },
        });
      }
    }

    return updatedProfile;
  }

  /**
   * Authoritative server-side discovery of available, verified riders.
   * Map-free discovery based on eligibility and optional proximity.
   */
  async findAvailableRiders(query: FindAvailableRidersQueryDto) {
    if (!this.prisma.isConnected) {
      return [];
    }

    const onlineRiders = await this.prisma.riderProfile.findMany({
      where: {
        isVerified: true,
        availability: {
          status: RiderStatus.ONLINE,
        },
        user: {
          status: 'ACTIVE',
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            profileImageUrl: true,
          },
        },
        availability: true,
      },
    });

    const clientLat = query.latitude ?? query.lat;
    const clientLng = query.longitude ?? query.lng;

    // Compute distance and sort by proximity if client coordinates provided
    if (clientLat != null && clientLng != null) {
      const ridersWithDist = onlineRiders.map((rider) => {
        const rLat = rider.currentLat ?? 7.0682;
        const rLng = rider.currentLng ?? 6.2736;
        const distanceKm = this.calculateHaversineDistance(
          Number(clientLat),
          Number(clientLng),
          Number(rLat),
          Number(rLng),
        );
        return {
          ...rider,
          distanceKm: Number(distanceKm.toFixed(2)),
        };
      });

      // Sort strictly by closest to customer first
      ridersWithDist.sort((a, b) => a.distanceKm - b.distanceKm);

      if (query.maxDistanceKm) {
        const filtered = ridersWithDist.filter((r) => r.distanceKm <= query.maxDistanceKm);
        return filtered.length > 0 ? filtered : ridersWithDist;
      }

      return ridersWithDist;
    }

    return onlineRiders;
  }

  private calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a = Math.min(
      1,
      Math.max(
      0,
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(this.deg2rad(lat1)) *
          Math.cos(this.deg2rad(lat2)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2),
      ),
    );
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
