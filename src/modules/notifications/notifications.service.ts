import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import {
  CreateNotificationDto,
  ListNotificationsQueryDto,
} from './dto/notification.dto';
import { InMemoryNotification, InMemoryStore } from '@/database/in-memory-store';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalize front-end tab names to backend notification types
   */
  private mapFilterType(type?: string): string[] | undefined {
    if (!type || type.toUpperCase() === 'ALL') return undefined;
    const clean = type.trim();
    if (clean.toLowerCase() === 'delivery') {
      return ['ORDER_UPDATE', 'DELIVERY'];
    }
    if (clean.toLowerCase() === 'system') {
      return ['SYSTEM', 'PAYMENT', 'WALLET'];
    }
    return [clean.toUpperCase()];
  }



  /**
   * Fetch user notifications with unread count
   */
  async getUserNotifications(userId: string, query?: ListNotificationsQueryDto) {
    const limit = query?.limit ? Number(query.limit) : 50;
    const mappedTypes = this.mapFilterType(query?.type);

    if (this.prisma.isConnected) {
      try {
        const whereClause: any = {
          userId,
          ...(query?.unreadOnly ? { isRead: false } : {}),
          ...(mappedTypes ? { type: { in: mappedTypes } } : {}),
        };

        const [notifications, unreadCount] = await Promise.all([
          this.prisma.notification.findMany({
            where: whereClause,
            orderBy: { createdAt: 'desc' },
            take: limit,
          }),
          this.prisma.notification.count({
            where: { userId, isRead: false },
          }),
        ]);

        return {
          notifications,
          unreadCount,
        };
      } catch (err: any) {
        this.logger.warn(`Prisma error in getUserNotifications: ${err.message}. Using in-memory fallback.`);
      }
    }

    // In-Memory Fallback
    const store = InMemoryStore.getInstance();
    const userNotifs = store.notifications.get(userId) || [];

    let filtered = [...userNotifs];
    if (query?.unreadOnly) {
      filtered = filtered.filter((n) => !n.isRead);
    }
    if (mappedTypes) {
      filtered = filtered.filter((n) => mappedTypes.includes(n.type));
    }

    // Sort descending by createdAt
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const unreadCount = userNotifs.filter((n) => !n.isRead).length;

    return {
      notifications: filtered.slice(0, limit),
      unreadCount,
    };
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(userId: string, notificationId: string) {
    if (this.prisma.isConnected) {
      try {
        const existing = await this.prisma.notification.findFirst({
          where: { id: notificationId, userId },
        });

        if (!existing) {
          throw new NotFoundException('Notification not found');
        }

        return await this.prisma.notification.update({
          where: { id: notificationId },
          data: { isRead: true },
        });
      } catch (err: any) {
        this.logger.warn(`Prisma error in markAsRead: ${err.message}`);
      }
    }

    const store = InMemoryStore.getInstance();
    const userNotifs = store.notifications.get(userId) || [];
    const notif = userNotifs.find((n) => n.id === notificationId);
    if (notif) {
      notif.isRead = true;
      return notif;
    }

    return { id: notificationId, isRead: true };
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    if (this.prisma.isConnected) {
      try {
        const result = await this.prisma.notification.updateMany({
          where: { userId, isRead: false },
          data: { isRead: true },
        });

        return {
          success: true,
          count: result.count,
        };
      } catch (err: any) {
        this.logger.warn(`Prisma error in markAllAsRead: ${err.message}`);
      }
    }

    const store = InMemoryStore.getInstance();
    const userNotifs = store.notifications.get(userId) || [];
    let updatedCount = 0;
    userNotifs.forEach((n) => {
      if (!n.isRead) {
        n.isRead = true;
        updatedCount++;
      }
    });

    return {
      success: true,
      count: updatedCount,
    };
  }

  /**
   * Clear / delete all notifications for a user
   */
  async clearNotifications(userId: string) {
    if (this.prisma.isConnected) {
      try {
        const result = await this.prisma.notification.deleteMany({
          where: { userId },
        });

        return {
          success: true,
          count: result.count,
        };
      } catch (err: any) {
        this.logger.warn(`Prisma error in clearNotifications: ${err.message}`);
      }
    }

    const store = InMemoryStore.getInstance();
    const userNotifs = store.notifications.get(userId) || [];
    const deletedCount = userNotifs.length;
    store.notifications.set(userId, []);

    return {
      success: true,
      count: deletedCount,
    };
  }

  /**
   * Delete single notification by ID
   */
  async deleteNotification(userId: string, notificationId: string) {
    if (this.prisma.isConnected) {
      try {
        await this.prisma.notification.deleteMany({
          where: { id: notificationId, userId },
        });
        return { success: true };
      } catch (err: any) {
        this.logger.warn(`Prisma error in deleteNotification: ${err.message}`);
      }
    }

    const store = InMemoryStore.getInstance();
    const userNotifs = store.notifications.get(userId) || [];
    store.notifications.set(
      userId,
      userNotifs.filter((n) => n.id !== notificationId),
    );

    return { success: true };
  }

  /**
   * Internal helper to create and dispatch notification to a user
   */
  async createNotification(dto: CreateNotificationDto) {
    if (this.prisma.isConnected) {
      try {
        return await this.prisma.notification.create({
          data: {
            userId: dto.userId,
            title: dto.title,
            message: dto.message,
            type: dto.type,
            data: dto.data || {},
            isRead: false,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Prisma error in createNotification: ${err.message}`);
      }
    }

    const store = InMemoryStore.getInstance();
    const userNotifs = store.notifications.get(dto.userId) || [];
    const newNotif: InMemoryNotification = {
      id: uuidv4(),
      userId: dto.userId,
      title: dto.title,
      message: dto.message,
      type: dto.type,
      data: dto.data || {},
      isRead: false,
      createdAt: new Date(),
    };
    userNotifs.unshift(newNotif);
    store.notifications.set(dto.userId, userNotifs);

    return newNotif;
  }
}
