import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

export const SUPPORT_CATEGORIES = [
  'Booking a delivery',
  'Payment Issues',
  'Rider behaviour',
  'Package not delivered',
  'Account issue',
  'Other issue',
];

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Submit a new support ticket / issue report
   */
  async createTicket(userId: string, dto: CreateTicketDto) {
    const randomCode = Math.floor(100000 + Math.random() * 900000);
    const ticketNumber = `TCK-${randomCode}`;

    const ticket = await this.prisma.supportTicket.create({
      data: {
        ticketNumber,
        userId,
        category: dto.category,
        description: dto.description,
        subject: dto.subject || dto.category,
        orderId: dto.orderId || null,
        status: 'OPEN',
        priority: 'MEDIUM',
      },
    });

    // Create a confirmation notification for the user
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          title: `Support Ticket Created (${ticketNumber})`,
          message: `We received your report regarding "${dto.category}". Our team is reviewing it and will respond within 24 hours.`,
          type: 'SYSTEM',
          data: {
            ticketId: ticket.id,
            ticketNumber: ticket.ticketNumber,
            category: ticket.category,
          },
        },
      });
    } catch (err) {
      console.warn('[SupportService] Notification creation note:', err);
    }

    return ticket;
  }

  /**
   * List all tickets submitted by a specific user
   */
  async listUserTickets(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            trackingId: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Get single ticket details
   */
  async getTicket(userId: string, ticketId: string) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id: ticketId,
        userId,
      },
      include: {
        order: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Support ticket with ID "${ticketId}" not found`);
    }

    return ticket;
  }

  /**
   * Get available issue categories
   */
  getCategories() {
    return SUPPORT_CATEGORIES;
  }
}
