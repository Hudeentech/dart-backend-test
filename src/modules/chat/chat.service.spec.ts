import { ChatService } from './chat.service';
import { PrismaService } from '@/database/prisma.service';
import { ChatGateway } from './chat.gateway';
import { InMemoryStore } from '@/database/in-memory-store';

describe('ChatService persistence', () => {
  const prisma = {
    isConnected: true,
    chatMessage: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      deleteMany: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    order: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    riderProfile: {
      findFirst: jest.fn(),
    },
  };
  const gateway = {
    broadcastNewMessage: jest.fn(),
    broadcastReaction: jest.fn(),
  };
  let service: ChatService;

  beforeEach(() => {
    jest.clearAllMocks();
    const store = InMemoryStore.getInstance();
    store.messages.clear();
    store.conversations.clear();
    service = new ChatService(
      prisma as unknown as PrismaService,
      gateway as unknown as ChatGateway,
    );
  });

  it('loads message history from the database in chronological order', async () => {
    const newest = {
      id: 'message-new',
      chatId: 'order-id-1234-abc',
      senderId: 'rider-1',
      senderRole: 'rider',
      type: 'text',
      text: 'On my way',
      createdAt: new Date('2026-01-02T12:00:00.000Z'),
    };
    const oldest = {
      ...newest,
      id: 'message-old',
      senderId: 'customer-1',
      senderRole: 'customer',
      text: 'Hello',
      createdAt: new Date('2026-01-02T11:00:00.000Z'),
    };
    prisma.chatMessage.findMany.mockResolvedValue([newest, oldest]);

    const result = await service.getMessages('customer-1', 'order-id-1234-abc');

    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { chatId: { in: ['order-id-1234-abc'] } },
          { orderId: { in: ['id-1234-abc'] } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    expect(result.map((message) => message.id)).toEqual([
      'message-old',
      'message-new',
    ]);
    expect(result[0].sender).toBe('user');
    expect(result[1].sender).toBe('other');
  });

  it('lists prior order conversations using the latest persisted message', async () => {
    prisma.riderProfile.findFirst.mockResolvedValue(null);
    InMemoryStore.getInstance().conversations.set('customer-1', [
      {
        id: 'order-id-1234-abc',
        userId: 'customer-1',
        contactId: 'rider-1',
        name: 'Taylor Rider',
        avatar: '',
        role: 'Verified Courier',
        rating: '5.0',
        online: true,
        category: 'Conversation',
        lastMessage: 'Old cached message',
        lastMessageTime: new Date('2026-01-02T11:00:00.000Z'),
        unreadCount: 0,
      },
    ]);
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'id-1234-abc',
        orderNumber: 'DART-ORD-1',
        trackingId: 'TRACK-1',
        status: 'DELIVERED',
        updatedAt: new Date('2026-01-02T12:00:00.000Z'),
        createdAt: new Date('2026-01-01T12:00:00.000Z'),
        customer: { id: 'customer-1' },
        rider: {
          id: 'rider-1',
          firstName: 'Taylor',
          lastName: 'Rider',
          profileImageUrl: null,
        },
        package: { name: 'Parcel' },
        chatMessages: [
          {
            type: 'text',
            text: 'Delivered safely',
            createdAt: new Date('2026-01-02T13:00:00.000Z'),
          },
        ],
      },
    ]);

    const result = await service.getConversations('customer-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('order-id-1234-abc');
    expect(result[0].name).toBe('Taylor Rider');
    expect(result[0].lastMessage).toBe('Delivered safely');
  });

  it('keeps a customer on the existing chat for the same rider across orders', async () => {
    prisma.riderProfile.findFirst.mockResolvedValue(null);
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'new-order',
        orderNumber: 'DART-ORD-2',
        trackingId: 'TRACK-2',
        status: 'RIDER_ASSIGNED',
        updatedAt: new Date('2026-01-04T12:00:00.000Z'),
        createdAt: new Date('2026-01-04T11:00:00.000Z'),
        customer: { id: 'customer-1', firstName: 'Jordan', lastName: 'Customer' },
        rider: { id: 'rider-1', firstName: 'Taylor', lastName: 'Rider' },
        package: { name: 'New parcel' },
        chatMessages: [],
      },
      {
        id: 'existing-order',
        orderNumber: 'DART-ORD-1',
        trackingId: 'TRACK-1',
        status: 'DELIVERED',
        updatedAt: new Date('2026-01-02T12:00:00.000Z'),
        createdAt: new Date('2026-01-01T12:00:00.000Z'),
        customer: { id: 'customer-1', firstName: 'Jordan', lastName: 'Customer' },
        rider: { id: 'rider-1', firstName: 'Taylor', lastName: 'Rider' },
        package: { name: 'Old parcel' },
        chatMessages: [
          {
            type: 'text',
            text: 'Continuing the conversation',
            createdAt: new Date('2026-01-03T12:00:00.000Z'),
          },
        ],
      },
    ]);

    const result = await service.getConversations('customer-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('order-existing-order');
    expect(result[0].lastMessage).toBe('Continuing the conversation');
  });

  it('keeps a rider on one chat with a customer across multiple orders', async () => {
    prisma.riderProfile.findFirst.mockResolvedValue({
      id: 'rider-profile-1',
      userId: 'rider-1',
    });
    prisma.order.findMany.mockResolvedValue([
      {
        id: 'new-order',
        orderNumber: 'DART-ORD-2',
        trackingId: 'TRACK-2',
        status: 'RIDER_ASSIGNED',
        updatedAt: new Date('2026-01-04T12:00:00.000Z'),
        createdAt: new Date('2026-01-04T11:00:00.000Z'),
        customerId: 'customer-1',
        customer: { id: 'customer-1', firstName: 'Jordan', lastName: 'Customer' },
        rider: { id: 'rider-1', firstName: 'Taylor', lastName: 'Rider' },
        package: { name: 'New parcel' },
        chatMessages: [],
      },
      {
        id: 'existing-order',
        orderNumber: 'DART-ORD-1',
        trackingId: 'TRACK-1',
        status: 'DELIVERED',
        updatedAt: new Date('2026-01-02T12:00:00.000Z'),
        createdAt: new Date('2026-01-01T12:00:00.000Z'),
        customerId: 'customer-1',
        customer: { id: 'customer-1', firstName: 'Jordan', lastName: 'Customer' },
        rider: { id: 'rider-1', firstName: 'Taylor', lastName: 'Rider' },
        package: { name: 'Old parcel' },
        chatMessages: [
          {
            type: 'text',
            text: 'Continuing the conversation',
            createdAt: new Date('2026-01-03T12:00:00.000Z'),
          },
        ],
      },
    ]);

    const result = await service.getConversations('rider-1');

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('order-existing-order');
    expect(result[0].contactId).toBe('customer-1');
    expect(result[0].lastMessage).toBe('Continuing the conversation');
  });

  it('loads a customer-rider chat history across that pair’s orders', async () => {
    const olderMessage = {
      id: 'message-old',
      chatId: 'order-existing-order',
      senderId: 'customer-1',
      senderRole: 'customer',
      type: 'text',
      text: 'Earlier conversation',
      createdAt: new Date('2026-01-03T12:00:00.000Z'),
    };
    prisma.order.findUnique.mockResolvedValue({
      id: 'existing-order',
      customerId: 'customer-1',
      riderId: 'rider-1',
      assignments: [],
    });
    prisma.order.findMany.mockResolvedValue([
      { id: 'existing-order' },
      { id: 'new-order' },
    ]);
    prisma.chatMessage.findMany.mockResolvedValue([olderMessage]);

    const result = await service.getMessages(
      'customer-1',
      'order-existing-order',
    );

    expect(prisma.chatMessage.findMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { chatId: { in: ['order-existing-order', 'order-new-order'] } },
          { orderId: { in: ['existing-order', 'new-order'] } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Earlier conversation');
  });

  it('loads a rider-customer chat history across that pair’s orders', async () => {
    const previousMessage = {
      id: 'message-old',
      chatId: 'order-existing-order',
      senderId: 'customer-1',
      senderRole: 'customer',
      type: 'text',
      text: 'Earlier conversation',
      createdAt: new Date('2026-01-03T12:00:00.000Z'),
    };
    prisma.order.findUnique.mockResolvedValue({
      id: 'existing-order',
      customerId: 'customer-1',
      riderId: null,
      assignments: [{ riderProfileId: 'rider-profile-1' }],
    });
    prisma.riderProfile.findFirst.mockResolvedValue({
      id: 'rider-profile-1',
    });
    prisma.order.findMany.mockResolvedValue([
      { id: 'existing-order' },
      { id: 'new-order' },
    ]);
    prisma.chatMessage.findMany.mockResolvedValue([previousMessage]);

    const result = await service.getMessages(
      'rider-1',
      'order-existing-order',
    );

    expect(prisma.order.findMany).toHaveBeenCalledWith({
      where: {
        customerId: 'customer-1',
        OR: [
          { riderId: 'rider-1' },
          { riderId: 'rider-profile-1' },
          {
            assignments: {
              some: { riderProfileId: 'rider-profile-1' },
            },
          },
        ],
      },
      select: { id: true },
    });
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('Earlier conversation');
  });

  it('stores sent messages in the database', async () => {
    prisma.riderProfile.findFirst.mockResolvedValue(null);
    prisma.order.findUnique.mockResolvedValue({ id: 'id-1234-abc' });
    prisma.chatMessage.create.mockImplementation(({ data }) =>
      Promise.resolve({ ...data, createdAt: new Date() }),
    );

    const result = await service.sendMessage('customer-1', 'id-1234-abc', {
      type: 'text',
      text: 'Hello rider',
      clientMessageId: 'client-message-1',
    });

    expect(prisma.chatMessage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        chatId: 'order-id-1234-abc',
        senderId: 'customer-1',
        clientMessageId: 'client-message-1',
        orderId: 'id-1234-abc',
        senderRole: 'customer',
        type: 'text',
        text: 'Hello rider',
      }),
    });
    expect(result.text).toBe('Hello rider');
    expect(gateway.broadcastNewMessage).toHaveBeenCalledTimes(1);

    prisma.chatMessage.findFirst.mockResolvedValue({
      ...result,
      createdAt: result.createdAt,
    });
    const retried = await service.sendMessage('customer-1', 'id-1234-abc', {
      type: 'text',
      text: 'Hello rider',
      clientMessageId: 'client-message-1',
    });

    expect(retried.id).toBe(result.id);
    expect(prisma.chatMessage.create).toHaveBeenCalledTimes(1);
    expect(gateway.broadcastNewMessage).toHaveBeenCalledTimes(1);
  });

  it('does not allow customers to clear chat messages', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'CUSTOMER' });

    await expect(
      service.clearChat('customer-1', 'id-1234-abc'),
    ).rejects.toThrow('Customers cannot delete chat messages.');

    expect(prisma.chatMessage.deleteMany).not.toHaveBeenCalled();
  });

  it('does not allow a customer to edit a rider message', async () => {
    prisma.chatMessage.findFirst.mockResolvedValue({
      id: 'message-1',
      senderId: 'rider-1',
    });

    await expect(
      service.editMessage('customer-1', 'id-1234-abc', 'message-1', 'Changed'),
    ).rejects.toThrow('You can only edit your own messages.');

    expect(prisma.chatMessage.update).not.toHaveBeenCalled();
  });
});
