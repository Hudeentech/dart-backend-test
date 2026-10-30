import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum NotificationType {
  ALL = 'ALL',
  ORDER_UPDATE = 'ORDER_UPDATE',
  PAYMENT = 'PAYMENT',
  SYSTEM = 'SYSTEM',
}

export class ListNotificationsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by notification category/type',
    enum: ['ALL', 'ORDER_UPDATE', 'PAYMENT', 'SYSTEM', 'Delivery', 'System'],
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Filter only unread notifications',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  unreadOnly?: boolean;

  @ApiPropertyOptional({
    description: 'Page limit for pagination',
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

export class CreateNotificationDto {
  @IsString()
  userId: string;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsString()
  type: string; // "ORDER_UPDATE", "PAYMENT", "SYSTEM"

  @IsOptional()
  data?: any;
}
