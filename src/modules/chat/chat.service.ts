import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import { ChatGateway } from './chat.gateway';
import {
  SendMessageDto,
  ListConversationsQueryDto,
} from './dto/chat.dto';
import {
  InMemoryChatMessage,
  InMemoryConversation,
  InMemoryStore,
} from '@/database/in-memory-store';
import { v4 as uuidv4 } from 'uuid';
import { OrderStatus, Prisma } from '@prisma/client';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * Helper to normalize order-based chat IDs
   */
  private normalizeChatId(chatId: string): string {
    if (chatId.startsWith('order-')) return chatId;
    // If it's a UUID or order ID
    if (chatId.length >= 8 && chatId.includes('-')) {
      return `order-${chatId}`;
    }
    return chatId;
  }

  /**
   * Fetch conversations derived from orders, including persisted message history
   */
  private async getOrderConversations(userId: string): Promise<InMemoryConversation[]> {
    if (!this.prisma.isConnected) {
      return [];
    }

    try {
      const riderProfile = await this.prisma.riderProfile.findFirst({
        where: { userId },
      });

      const orders = await this.prisma.order.findMany({
        where: riderProfile
          ? {
              OR: [
                { riderId: userId },
                { riderId: riderProfile.id },
                { assignments: { some: { riderProfileId: riderProfile.id } } },
                {
                  riderId: null,
                  status: {
                    in: [
                      OrderStatus.PAYMENT_CONFIRMED,
                      OrderStatus.RIDER_REQUESTED,
                      OrderStatus.RIDER_ASSIGNED,
                    ],
                  },
                },
              ],
            }
          : { customerId: userId },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              profileImageUrl: true,
            },
          },
          rider: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
              profileImageUrl: true,
            },
          },
          package: true,
          chatMessages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      const store = InMemoryStore.getInstance();
      const visibleOrders = Array.from(
        orders
          .reduce((selected, order) => {
            const contactId = riderProfile ? order.customerId : order.rider?.id;
            const key = contactId || `unassigned-${order.id}`;
            const current = selected.get(key);
            const latestMessage = order.chatMessages[0]?.createdAt;
            const currentLatestMessage = current?.chatMessages[0]?.createdAt;

            if (
              !current ||
              (latestMessage &&
                (!currentLatestMessage || latestMessage > currentLatestMessage)) ||
              (!latestMessage &&
                !currentLatestMessage &&
                order.updatedAt > current.updatedAt)
            ) {
              selected.set(key, order);
            }
            return selected;
          }, new Map<string, (typeof orders)[number]>())
          .values(),
      );

      return visibleOrders.map((order) => {
        const isRider = !!riderProfile;
        const otherParty = isRider ? order.customer : order.rider;
        const otherName = otherParty
          ? [otherParty.firstName, otherParty.lastName].filter(Boolean).join(' ') || (isRider ? 'Customer' : 'Dart Courier')
          : isRider ? 'Customer' : 'Dart Courier';

        const avatar =
          otherParty?.profileImageUrl ||
          `https://ui-avatars.com/api/?name=${encodeURIComponent(otherName)}&background=ffcc00&color=000000`;

        const chatId = `order-${order.id}`;
        const chatMsgs = store.messages.get(chatId) || [];
        const lastMsg = order.chatMessages[0] || (chatMsgs.length > 0 ? chatMsgs[chatMsgs.length - 1] : null);

        const lastMessageText = lastMsg
          ? lastMsg.type === 'audio'
            ? '🎤 Voice note'
            : lastMsg.type === 'image'
              ? '📷 Photo'
              : lastMsg.type === 'file'
                ? `📎 ${lastMsg.fileName || 'Attachment'}`
              : lastMsg.text || ''
          : `Order ${order.status.replace(/_/g, ' ').toLowerCase()}`;

        return {
          id: chatId,
          userId,
          contactId: otherParty?.id || order.id,
          name: otherName,
          avatar,
          role: isRider ? 'Customer' : 'Verified Courier',
          rating: '5.0',
          online: true,
          category: 'Conversation',
          package: {
            title: order.package?.name || 'Delivery Package',
            trackingId: order.trackingId || order.orderNumber,
            icon: '📦',
          },
          lastMessage: lastMessageText,
          lastMessageTime: lastMsg ? lastMsg.createdAt : (order.updatedAt || order.createdAt),
          unreadCount: 0,
        };
      });
    } catch (e) {
      this.logger.error('Failed to query order conversations', e);
      return [];
    }
  }

  /**
   * List conversation contacts for current user
   */
  async getConversations(userId: string, query?: ListConversationsQueryDto) {
    const store = InMemoryStore.getInstance();
    // Always refresh order conversations dynamically to capture real-time order bookings
    const orderConvos = await this.getOrderConversations(userId);

    let convos = store.conversations.get(userId) || [];

    // Merge fresh order conversations
    orderConvos.forEach((oc) => {
      const idx = convos.findIndex((c) => c.id === oc.id);
      if (idx >= 0) {
        const cachedTime = convos[idx].lastMessageTime
          ? new Date(convos[idx].lastMessageTime).getTime()
          : 0;
        const refreshedTime = oc.lastMessageTime
          ? new Date(oc.lastMessageTime).getTime()
          : 0;
        const refreshedIsNewer = refreshedTime >= cachedTime;
        convos[idx] = {
          ...oc,
          lastMessage: refreshedIsNewer
            ? oc.lastMessage
            : convos[idx].lastMessage,
          lastMessageTime: refreshedIsNewer
            ? oc.lastMessageTime
            : convos[idx].lastMessageTime,
        };
      } else {
        convos.unshift(oc);
      }
    });

    const canonicalOrderChatIds = new Map(
      orderConvos.map((conversation) => [conversation.contactId, conversation.id]),
    );
    convos = convos.filter((conversation) => {
      const canonicalId = canonicalOrderChatIds.get(conversation.contactId);
      return (
        !canonicalId ||
        conversation.category !== 'Conversation' ||
        conversation.id === canonicalId
      );
    });

    store.conversations.set(userId, convos);

    let filtered = [...convos];
    if (query?.category && query.category !== 'All') {
      filtered = filtered.filter(
        (c) => c.category.toLowerCase() === query.category?.toLowerCase(),
      );
    }

    if (query?.search) {
      const q = query.search.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q) ||
          c.package?.title.toLowerCase().includes(q) ||
          c.package?.trackingId.toLowerCase().includes(q),
      );
    }

    return filtered;
  }

  /**
   * Get single conversation details
   */
  async getConversationById(userId: string, chatId: string) {
    const convos = await this.getConversations(userId);
    const found = convos.find((c) => c.id === chatId || c.id === this.normalizeChatId(chatId));
    if (found) return found;

    // Check if it's an order-based chat
    const orderId = chatId.startsWith('order-') ? chatId.replace('order-', '') : chatId;
    if (this.prisma.isConnected) {
      try {
        const order = await this.prisma.order.findUnique({
          where: { id: orderId },
          include: { customer: true, rider: true, package: true },
        });
        if (order) {
          const riderProfile = await this.prisma.riderProfile.findFirst({ where: { userId } });
          const isRider = !!riderProfile;
          const otherParty = isRider ? order.customer : order.rider;
          const name = otherParty
            ? [otherParty.firstName, otherParty.lastName].filter(Boolean).join(' ') || (isRider ? 'Customer' : 'Dart Courier')
            : (isRider ? 'Customer' : 'Dart Courier');

          const avatar =
            otherParty?.profileImageUrl ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ffcc00&color=000000`;

          return {
            id: `order-${order.id}`,
            userId,
            contactId: otherParty?.id || order.id,
            name,
            avatar,
            role: isRider ? 'Customer' : 'Verified Courier',
            rating: '5.0',
            online: true,
            category: 'Conversation',
            package: {
              title: order.package?.name || 'Delivery Package',
              trackingId: order.trackingId || order.orderNumber,
              icon: '📦',
            },
            unreadCount: 0,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Failed to find order for chat ${chatId}: ${err.message}`);
      }
    }

    throw new NotFoundException(`Conversation with ID ${chatId} not found`);
  }

  /**
   * Get message history for a conversation
   */
  async getMessages(userId: string, chatId: string, limit = 100) {
    const store = InMemoryStore.getInstance();
    const normalized = this.normalizeChatId(chatId);

    if (this.prisma.isConnected) {
      let chatIds = [normalized];
      if (normalized.startsWith('order-')) {
        const orderId = normalized.slice('order-'.length);
        const order = await this.prisma.order.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            customerId: true,
            riderId: true,
            assignments: { select: { riderProfileId: true } },
          },
        });
        const riderProfile = await this.prisma.riderProfile.findFirst({
          where: { userId },
          select: { id: true },
        });
        const isRider =
          order &&
          (order.riderId === userId ||
            order.riderId === riderProfile?.id ||
          order.assignments?.some(
              ({ riderProfileId }) => riderProfileId === riderProfile?.id,
            ));
        if (
          order &&
          ((order.customerId === userId && order.riderId) || isRider)
        ) {
          const samePairWhere = order.customerId === userId
            ? {
                customerId: order.customerId,
                riderId: order.riderId,
              }
            : {
                customerId: order.customerId,
                OR: [
                  { riderId: userId },
                  ...(riderProfile
                    ? [
                        { riderId: riderProfile.id },
                        {
                          assignments: {
                            some: { riderProfileId: riderProfile.id },
                          },
                        },
                      ]
                    : []),
                ],
              };
          const relatedOrders = await this.prisma.order.findMany({
            where: samePairWhere,
            select: { id: true },
          });
          chatIds = relatedOrders.map(({ id }) => `order-${id}`);
        }
      }

      const messages = await this.prisma.chatMessage.findMany({
        where: {
          OR: [
            { chatId: { in: chatIds } },
            {
              orderId: {
                in: chatIds.map((id) => id.slice('order-'.length)),
              },
            },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: Math.max(1, Math.trunc(limit)),
      });

      return messages.reverse().map((message) => {
        const isMine = message.senderId === userId;
        return {
          ...message,
          sender: isMine ? 'user' : 'other',
          time: message.createdAt.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
      });
    }

    let chatMsgs = store.messages.get(normalized);
    if (!chatMsgs && chatId !== normalized) {
      chatMsgs = store.messages.get(chatId);
    }
    if (!chatMsgs) {
      chatMsgs = [];
      store.messages.set(normalized, chatMsgs);
      if (chatId !== normalized) {
        store.messages.set(chatId, chatMsgs);
      }
    }

    // Return in chronological order, computing sender relative to current user
    const sorted = [...chatMsgs].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return sorted.slice(-limit).map((m: any) => {
      const isMine = m.senderId === userId;
      return {
        ...m,
        sender: isMine ? 'user' : 'other',
        senderRole: m.senderRole || (isMine ? 'user' : 'other'),
        time:
          m.time ||
          (m.createdAt
            ? new Date(m.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Just now'),
      };
    });
  }

  /**
   * Send a new message (text, voice note audio, image, or file)
   */
  async sendMessage(userId: string, chatId: string, dto: SendMessageDto) {
    const store = InMemoryStore.getInstance();
    const normalized = this.normalizeChatId(chatId);

    let chatMsgs = store.messages.get(normalized);
    if (!chatMsgs) {
      chatMsgs = [];
      store.messages.set(normalized, chatMsgs);
      if (chatId !== normalized) {
        store.messages.set(chatId, chatMsgs);
      }
    }

    if (dto.clientMessageId) {
      const existingInMemory = chatMsgs.find(
        (message) =>
          message.senderId === userId &&
          message.clientMessageId === dto.clientMessageId,
      );
      if (existingInMemory) {
        return { ...existingInMemory, sender: 'user' };
      }

      if (this.prisma.isConnected) {
        const existingPersisted = await this.prisma.chatMessage.findFirst({
          where: {
            chatId: normalized,
            senderId: userId,
            clientMessageId: dto.clientMessageId,
          },
        });
        if (existingPersisted) {
          return {
            ...existingPersisted,
            sender: 'user',
            time: existingPersisted.createdAt.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
        }
      }
    }

    let isRider = false;
    if (this.prisma.isConnected) {
      try {
        const profile = await this.prisma.riderProfile.findFirst({ where: { userId } });
        isRider = !!profile;
      } catch {}
    }

    const timeStr = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    const newMsg: InMemoryChatMessage & { time?: string } = {
      id: uuidv4(),
      chatId: normalized,
      senderId: userId,
      clientMessageId: dto.clientMessageId,
      senderRole: isRider ? 'rider' : 'customer',
      type: dto.type,
      text: dto.text,
      audioUrl: dto.audioUrl,
      audioDuration: dto.audioDuration,
      imageUrl: dto.imageUrl,
      fileName: dto.fileName,
      fileSize: dto.fileSize,
      fileUrl: dto.fileUrl,
      reactions: [],
      isPinned: false,
      isEdited: false,
      createdAt: new Date(),
      time: timeStr,
    };

    if (this.prisma.isConnected) {
      const orderId = normalized.startsWith('order-')
        ? normalized.slice('order-'.length)
        : null;
      const order = orderId
        ? await this.prisma.order.findUnique({
            where: { id: orderId },
            select: { id: true },
          })
        : null;

      try {
        const persistedMessage = await this.prisma.chatMessage.create({
          data: {
            id: newMsg.id,
            chatId: normalized,
            senderId: userId,
            clientMessageId: dto.clientMessageId,
            orderId: order?.id,
            senderRole: newMsg.senderRole,
            type: newMsg.type,
            text: newMsg.text,
            audioUrl: newMsg.audioUrl,
            audioDuration: newMsg.audioDuration,
            imageUrl: newMsg.imageUrl,
            fileName: newMsg.fileName,
            fileSize: newMsg.fileSize,
            fileUrl: newMsg.fileUrl,
            reactions: [],
            isPinned: false,
            isEdited: false,
          },
        });
        Object.assign(newMsg, persistedMessage);
      } catch (error) {
        if (
          !dto.clientMessageId ||
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        ) {
          throw error;
        }

        const duplicate = await this.prisma.chatMessage.findFirst({
          where: {
            chatId: normalized,
            senderId: userId,
            clientMessageId: dto.clientMessageId,
          },
        });
        if (!duplicate) throw error;
        return {
          ...duplicate,
          sender: 'user',
          time: duplicate.createdAt.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
      }
    }

    chatMsgs.push(newMsg);

    // Update conversation last message preview
    const updateConvoList = (uid: string) => {
      const convos = store.conversations.get(uid) || [];
      const targetConvo = convos.find((c) => c.id === normalized || c.id === chatId);
      if (targetConvo) {
        targetConvo.lastMessage =
          dto.type === 'audio'
            ? '🎤 Voice note'
            : dto.type === 'image'
              ? '📷 Photo'
              : dto.type === 'file'
                ? `📎 ${dto.fileName || 'Attachment'}`
                : dto.text || '';
        targetConvo.lastMessageTime = newMsg.createdAt;
      }
    };
    updateConvoList(userId);

    // Broadcast via WebSocket to room participants
    this.chatGateway.broadcastNewMessage(normalized, newMsg);

    return {
      ...newMsg,
      sender: 'user',
    };
  }

  /**
   * Add or toggle emoji reaction on a message
   */
  async reactToMessage(
    userId: string,
    chatId: string,
    messageId: string,
    emoji: string,
  ) {
    const store = InMemoryStore.getInstance();
    const normalized = this.normalizeChatId(chatId);
    const chatMsgs = store.messages.get(normalized) || store.messages.get(chatId) || [];
    const msg = chatMsgs.find((m) => m.id === messageId);
    if (this.prisma.isConnected) {
      const persistedMessage = await this.prisma.chatMessage.findFirst({
        where: { id: messageId, chatId: normalized },
        select: { reactions: true },
      });
      if (!persistedMessage) {
        throw new NotFoundException(`Message ${messageId} not found`);
      }

      const reactions = [...persistedMessage.reactions];
      const existingIdx = reactions.indexOf(emoji);
      if (existingIdx > -1) {
        reactions.splice(existingIdx, 1);
      } else {
        reactions.push(emoji);
      }
      const updated = await this.prisma.chatMessage.update({
        where: { id: messageId },
        data: { reactions },
      });
      if (msg) msg.reactions = reactions;
      this.chatGateway.broadcastReaction(chatId, { messageId, reactions });
      return updated;
    }

    if (!msg) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    if (!msg.reactions) msg.reactions = [];
    const existingIdx = msg.reactions.indexOf(emoji);
    if (existingIdx > -1) {
      msg.reactions.splice(existingIdx, 1);
    } else {
      msg.reactions.push(emoji);
    }

    this.chatGateway.broadcastReaction(chatId, {
      messageId,
      reactions: msg.reactions,
    });

    return msg;
  }

  /**
   * Pin or unpin a message
   */
  async pinMessage(
    userId: string,
    chatId: string,
    messageId: string,
    isPinned: boolean,
  ) {
    const store = InMemoryStore.getInstance();
    const normalized = this.normalizeChatId(chatId);
    const chatMsgs = store.messages.get(normalized) || store.messages.get(chatId) || [];
    const msg = chatMsgs.find((m) => m.id === messageId);
    if (this.prisma.isConnected) {
      const existing = await this.prisma.chatMessage.findFirst({
        where: { id: messageId, chatId: normalized },
      });
      if (!existing) {
        throw new NotFoundException(`Message ${messageId} not found`);
      }
      const updated = await this.prisma.chatMessage.update({
        where: { id: messageId },
        data: { isPinned },
      });
      if (msg) msg.isPinned = isPinned;
      this.chatGateway.broadcastPin(chatId, { messageId, isPinned });
      return updated;
    }

    if (!msg) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }

    msg.isPinned = isPinned;
    this.chatGateway.broadcastPin(chatId, { messageId, isPinned });
    return msg;
  }

  /**
   * Edit message text
   */
  async editMessage(
    userId: string,
    chatId: string,
    messageId: string,
    text: string,
  ) {
    const store = InMemoryStore.getInstance();
    const normalized = this.normalizeChatId(chatId);
    const chatMsgs = store.messages.get(normalized) || store.messages.get(chatId) || [];
    const msg = chatMsgs.find((m) => m.id === messageId);
    if (this.prisma.isConnected) {
      const existing = await this.prisma.chatMessage.findFirst({
        where: { id: messageId, chatId: normalized },
      });
      if (!existing) {
        throw new NotFoundException(`Message ${messageId} not found`);
      }
      if (existing.senderId !== userId) {
        throw new ForbiddenException('You can only edit your own messages.');
      }
      const updated = await this.prisma.chatMessage.update({
        where: { id: messageId },
        data: { text, isEdited: true },
      });
      if (msg) {
        msg.text = text;
        msg.isEdited = true;
      }
      this.chatGateway.broadcastEdit(chatId, {
        messageId,
        text,
        isEdited: true,
      });
      return updated;
    }

    if (!msg) {
      throw new NotFoundException(`Message ${messageId} not found`);
    }
    if (msg.senderId !== userId) {
      throw new ForbiddenException('You can only edit your own messages.');
    }

    msg.text = text;
    msg.isEdited = true;
    this.chatGateway.broadcastEdit(chatId, {
      messageId,
      text,
      isEdited: true,
    });
    return msg;
  }

  /**
   * Delete a message by ID
   */
  async deleteMessage(userId: string, chatId: string, messageId: string) {
    await this.assertMessageDeletionAllowed(userId);
    const store = InMemoryStore.getInstance();
    const normalized = this.normalizeChatId(chatId);
    const chatMsgs = store.messages.get(normalized) || store.messages.get(chatId) || [];
    if (this.prisma.isConnected) {
      await this.prisma.chatMessage.deleteMany({
        where: { id: messageId, chatId: normalized },
      });
    }
    const filtered = chatMsgs.filter((m) => m.id !== messageId);
    store.messages.set(normalized, filtered);
    if (chatId !== normalized) store.messages.set(chatId, filtered);

    this.chatGateway.broadcastDelete(chatId, messageId);
    return { success: true };
  }

  /**
   * Clear all messages in a chat thread
   */
  async clearChat(userId: string, chatId: string) {
    await this.assertMessageDeletionAllowed(userId);
    const store = InMemoryStore.getInstance();
    const normalized = this.normalizeChatId(chatId);
    if (this.prisma.isConnected) {
      await this.prisma.chatMessage.deleteMany({
        where: { chatId: normalized },
      });
    }
    store.messages.set(normalized, []);
    if (chatId !== normalized) store.messages.set(chatId, []);
    return { success: true };
  }

  private async assertMessageDeletionAllowed(userId: string) {
    const user = this.prisma.isConnected
      ? await this.prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        })
      : InMemoryStore.getInstance().users.get(userId);

    if (!user || !['RIDER', 'ADMIN'].includes(user.role)) {
      throw new ForbiddenException('Customers cannot delete chat messages.');
    }
  }
}
