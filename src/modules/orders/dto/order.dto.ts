import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SelectRiderDto {
  @ApiPropertyOptional({ example: 'clx123abc456', description: 'Rider Profile ID' })
  @IsOptional()
  @IsString()
  riderProfileId?: string;

  @ApiPropertyOptional({ example: 'clx123abc456', description: 'Rider ID' })
  @IsOptional()
  @IsString()
  riderId?: string;
}

export class ConfirmDeliveryDto {
  @ApiProperty({ example: '83920', description: '5-digit handover delivery code' })
  @IsString()
  @Length(5, 5, { message: 'Handover code must be 5 digits' })
  @Matches(/^\d{5}$/, { message: 'Handover code must contain only digits' })
  code: string;

  @ApiPropertyOptional({ example: 6.4474 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 3.4723 })
  @IsOptional()
  @IsNumber()
  longitude?: number;
}

export class CancelOrderDto {
  @ApiProperty({ example: 'Sender changed mind before pickup' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class ReassignRiderDto {
  @ApiPropertyOptional({ example: 'clx123abc456', description: 'New Rider Profile ID or User ID' })
  @IsOptional()
  @IsString()
  riderId?: string;

  @ApiPropertyOptional({ example: 'clx123abc456', description: 'New Rider Profile ID' })
  @IsOptional()
  @IsString()
  riderProfileId?: string;
}

export class DeleteOrdersDto {
  @ApiProperty({ type: [String], example: ['order-id-1', 'order-id-2'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  orderIds: string[];
}
