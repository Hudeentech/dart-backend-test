import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected to chat: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from chat: ${client.id}`);
  }

  private getChatRooms(chatId: string): string[] {
    if (!chatId) return [];
    const rooms = new Set<string>();
    rooms.add(`chat_${chatId}`);
    if (chatId.startsWith('order-')) {
      const stripped = chatId.replace('order-', '');
      if (stripped) rooms.add(`chat_${stripped}`);
    } else {
      rooms.add(`chat_order-${chatId}`);
    }
    return Array.from(rooms);
  }

  @SubscribeMessage('join_chat')
  handleJoinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    if (!data?.chatId) return;
    const rooms = this.getChatRooms(data.chatId);
    client.join(rooms);
    this.logger.log(`Client ${client.id} joined rooms: ${rooms.join(', ')}`);
    return { event: 'joined_chat', data: { rooms } };
  }

  @SubscribeMessage('leave_chat')
  handleLeaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    if (!data?.chatId) return;
    const rooms = this.getChatRooms(data.chatId);
    rooms.forEach((room) => client.leave(room));
    this.logger.log(`Client ${client.id} left rooms: ${rooms.join(', ')}`);
    return { event: 'left_chat', data: { rooms } };
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { chatId: string; isTyping: boolean; userName?: string },
  ) {
    if (!data?.chatId) return;
    const rooms = this.getChatRooms(data.chatId);
    client.to(rooms).emit('user_typing', data);
  }

  /**
   * Broadcast a newly sent message to all room members
   */
  broadcastNewMessage(chatId: string, message: any) {
    if (this.server) {
      const rooms = this.getChatRooms(chatId);
      this.server.to(rooms).emit('new_message', message);
    }
  }

  /**
   * Broadcast message reaction update
   */
  broadcastReaction(
    chatId: string,
    payload: { messageId: string; reactions: string[] },
  ) {
    if (this.server) {
      const rooms = this.getChatRooms(chatId);
      this.server.to(rooms).emit('message_reacted', payload);
    }
  }

  /**
   * Broadcast message pin/unpin
   */
  broadcastPin(
    chatId: string,
    payload: { messageId: string; isPinned: boolean },
  ) {
    if (this.server) {
      const rooms = this.getChatRooms(chatId);
      this.server.to(rooms).emit('message_pinned', payload);
    }
  }

  /**
   * Broadcast message edit
   */
  broadcastEdit(
    chatId: string,
    payload: { messageId: string; text: string; isEdited: boolean },
  ) {
    if (this.server) {
      const rooms = this.getChatRooms(chatId);
      this.server.to(rooms).emit('message_edited', payload);
    }
  }

  /**
   * Broadcast message delete
   */
  broadcastDelete(chatId: string, messageId: string) {
    if (this.server) {
      const rooms = this.getChatRooms(chatId);
      this.server.to(rooms).emit('message_deleted', { messageId });
    }
  }
}
