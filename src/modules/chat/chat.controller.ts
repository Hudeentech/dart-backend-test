import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import {
  SendMessageDto,
  ReactMessageDto,
  PinMessageDto,
  EditMessageDto,
  ListConversationsQueryDto,
} from './dto/chat.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('Chat & Messages')
@ApiBearerAuth()
@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  @ApiOperation({ summary: 'List user active conversation threads' })
  async getConversations(
    @CurrentUser('id') userId: string,
    @Query() query: ListConversationsQueryDto,
  ) {
    return this.chatService.getConversations(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single conversation contact details' })
  async getConversationById(
    @CurrentUser('id') userId: string,
    @Param('id') chatId: string,
  ) {
    return this.chatService.getConversationById(userId, chatId);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get chat messages history' })
  async getMessages(
    @CurrentUser('id') userId: string,
    @Param('id') chatId: string,
    @Query('limit') limit?: number,
  ) {
    return this.chatService.getMessages(userId, chatId, limit);
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Send a message (text, voice note, or photo)' })
  async sendMessage(
    @CurrentUser('id') userId: string,
    @Param('id') chatId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(userId, chatId, dto);
  }

  @Post(':id/messages/:messageId/react')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add or toggle an emoji reaction' })
  async reactToMessage(
    @CurrentUser('id') userId: string,
    @Param('id') chatId: string,
    @Param('messageId') messageId: string,
    @Body() dto: ReactMessageDto,
  ) {
    return this.chatService.reactToMessage(userId, chatId, messageId, dto.emoji);
  }

  @Patch(':id/messages/:messageId/pin')
  @ApiOperation({ summary: 'Pin or unpin a message' })
  async pinMessage(
    @CurrentUser('id') userId: string,
    @Param('id') chatId: string,
    @Param('messageId') messageId: string,
    @Body() dto: PinMessageDto,
  ) {
    return this.chatService.pinMessage(userId, chatId, messageId, dto.isPinned);
  }

  @Patch(':id/messages/:messageId')
  @ApiOperation({ summary: 'Edit message text' })
  async editMessage(
    @CurrentUser('id') userId: string,
    @Param('id') chatId: string,
    @Param('messageId') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.chatService.editMessage(userId, chatId, messageId, dto.text);
  }

  @Delete(':id/messages/:messageId')
  @ApiOperation({ summary: 'Delete a single message' })
  async deleteMessage(
    @CurrentUser('id') userId: string,
    @Param('id') chatId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.chatService.deleteMessage(userId, chatId, messageId);
  }

  @Delete(':id/clear')
  @ApiOperation({ summary: 'Clear all messages in chat' })
  async clearChat(
    @CurrentUser('id') userId: string,
    @Param('id') chatId: string,
  ) {
    return this.chatService.clearChat(userId, chatId);
  }
}
