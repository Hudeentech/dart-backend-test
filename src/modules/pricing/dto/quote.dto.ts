import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PackageCategory } from '@prisma/client';

export class DeliveryQuoteRequestDto {
  @ApiPropertyOptional({ example: 6.4474, description: 'Pickup Latitude' })
  @IsOptional()
  @IsNumber()
  pickupLat?: number;

  @ApiPropertyOptional({ example: 3.4723, description: 'Pickup Longitude' })
  @IsOptional()
  @IsNumber()
  pickupLng?: number;

  @ApiPropertyOptional({ example: 6.4474, description: 'Origin Latitude' })
  @IsOptional()
  @IsNumber()
  originLat?: number;

  @ApiPropertyOptional({ example: 3.4723, description: 'Origin Longitude' })
  @IsOptional()
  @IsNumber()
  originLng?: number;

  @ApiPropertyOptional({ example: 6.5244, description: 'Destination Latitude' })
  @IsOptional()
  @IsNumber()
  destinationLat?: number;

  @ApiPropertyOptional({ example: 3.3792, description: 'Destination Longitude' })
  @IsOptional()
  @IsNumber()
  destinationLng?: number;

  @ApiPropertyOptional({ example: 6.5244 })
  @IsOptional()
  @IsNumber()
  destLat?: number;

  @ApiPropertyOptional({ example: 3.3792 })
  @IsOptional()
  @IsNumber()
  destLng?: number;

  @ApiPropertyOptional({ example: 2.5, description: 'Weight in KG' })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  weightKg?: number;

  @ApiPropertyOptional({ enum: PackageCategory, default: PackageCategory.PARCEL })
  @IsOptional()
  @IsEnum(PackageCategory)
  category?: PackageCategory = PackageCategory.PARCEL;

  @ApiPropertyOptional({ example: 'PARCEL' })
  @IsOptional()
  @IsString()
  packageType?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFragile?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean;
}

export interface DeliveryQuoteResponse {
  basePrice: number;
  distancePrice: number;
  weightPrice: number;
  surgePrice: number;
  totalPrice: number;
  platformFee: number;
  riderSettlementFee: number;
  distanceKm: number;
  estimatedMinutes: number;
  expiresAt: string;
}
