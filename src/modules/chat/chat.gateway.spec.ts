import { Server } from 'socket.io';
import { ChatGateway } from './chat.gateway';

describe('ChatGateway', () => {
  it('broadcasts once to the canonical and alias rooms', () => {
    const emit = jest.fn();
    const server = {
      to: jest.fn().mockReturnValue({ emit }),
    };
    const gateway = new ChatGateway();
    gateway.server = server as unknown as Server;

    const message = { id: 'message-1' };
    gateway.broadcastNewMessage('order-123', message);

    expect(server.to).toHaveBeenCalledTimes(1);
    expect(server.to).toHaveBeenCalledWith(['chat_order-123', 'chat_123']);
    expect(emit).toHaveBeenCalledWith('new_message', message);
  });
});
