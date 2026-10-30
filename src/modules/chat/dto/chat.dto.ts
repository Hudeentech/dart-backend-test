import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({
    example: 'text',
    enum: ['text', 'audio', 'image', 'file'],
    default: 'text',
  })
  @IsString()
  @IsNotEmpty()
  type: 'text' | 'audio' | 'image' | 'file';

  @ApiPropertyOptional({ example: 'client-generated-uuid' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  clientMessageId?: string;

  @ApiPropertyOptional({ example: 'Hello, are you near the pickup location?' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ example: 'https://cdn.dart.ng/audio/voice-note-1.webm' })
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiPropertyOptional({ example: 4.5, description: 'Duration in seconds' })
  @IsOptional()
  @IsNumber()
  audioDuration?: number;

  @ApiPropertyOptional({ example: 'https://cdn.dart.ng/photos/parcel-photo-1.jpg' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ example: 'delivery-receipt.pdf' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({ example: 1048576, description: 'File size in bytes' })
  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @ApiPropertyOptional({ example: 'https://cdn.dart.ng/docs/delivery-receipt.pdf' })
  @IsOptional()
  @IsString()
  fileUrl?: string;
}

export class ReactMessageDto {
  @ApiProperty({ example: '👍', description: 'Emoji reaction character' })
  @IsString()
  @IsNotEmpty()
  emoji: string;
}

export class PinMessageDto {
  @ApiProperty({ example: true, description: 'Pin or unpin message' })
  @IsBoolean()
  isPinned: boolean;
}

export class EditMessageDto {
  @ApiProperty({ example: 'Updated message text' })
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class ListConversationsQueryDto {
  @ApiPropertyOptional({
    enum: ['All', 'Conversation', 'Updates', 'Supports'],
    default: 'All',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Divine' })
  @IsOptional()
  @IsString()
  search?: string;
}
