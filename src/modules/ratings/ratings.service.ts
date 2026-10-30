import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreateRatingDto } from './dto/rating.dto';
import { OrderStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async submitRating(customerId: string, dto: CreateRatingDto) {
    if (!this.prisma.isConnected) {
      return {
        id: uuidv4(),
        orderId: dto.orderId,
        raterId: customerId,
        targetId: 'r-dev-1',
        score: dto.score,
        review: dto.review || '',
        tags: dto.tags || [],
        createdAt: new Date().toISOString(),
      };
    }

    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { rider: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException('Only the customer can rate this order');
    }

    if (
      order.status !== OrderStatus.DELIVERED &&
      order.status !== OrderStatus.CUSTOMER_CONFIRMED &&
      order.status !== OrderStatus.SETTLED
    ) {
      throw new BadRequestException('Ratings can only be submitted after delivery is completed');
    }

    if (!order.riderId) {
      throw new BadRequestException('No rider associated with this order');
    }

    const existingRating = await this.prisma.rating.findFirst({
      where: {
        orderId: order.id,
        raterId: customerId,
      },
    });

    if (existingRating) {
      throw new BadRequestException('You have already rated this delivery');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create rating record
      const rating = await tx.rating.create({
        data: {
          orderId: order.id,
          raterId: customerId,
          targetId: order.riderId,
          score: dto.score,
          review: dto.review,
          tags: dto.tags || [],
        },
      });

      // 2. Recalculate rider average rating
      const riderRatings = await tx.rating.findMany({
        where: { targetId: order.riderId },
        select: { score: true },
      });

      const totalScore = riderRatings.reduce((acc, curr) => acc + curr.score, 0);
      const avgScore = Number((totalScore / riderRatings.length).toFixed(1));

      await tx.riderProfile.updateMany({
        where: { userId: order.riderId },
        data: { averageRating: avgScore },
      });

      return rating;
    });
  }

  async getRiderRatings(riderUserId: string) {
    if (!this.prisma.isConnected) {
      return [
        {
          id: 'rating-1',
          targetId: riderUserId,
          score: 5,
          review: 'Very fast pickup and arrived in perfect condition!',
          tags: ['On-Time', 'Polite', 'Careful'],
          createdAt: new Date().toISOString(),
          rater: { firstName: 'Adebayo', profileImageUrl: null },
        },
      ];
    }

    return this.prisma.rating.findMany({
      where: { targetId: riderUserId },
      include: {
        rater: {
          select: { firstName: true, profileImageUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
