import {
  IsBoolean,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ArrayMinSize,
  ArrayUnique,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PackageCategory } from '@prisma/client';
import { CreateAddressDto } from '../../users/dto/user.dto';

export class PackageItemDto {
  @ApiProperty({ example: 'Apple MacBook Pro' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  quantity?: number = 1;

  @ApiPropertyOptional({ example: 1500000 })
  @IsOptional()
  @IsNumber()
  unitPrice?: number;
}

export class CreatePackageDto {
  @ApiProperty({ example: 'Important Contract Documents & Device' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Handle with extreme care, fragile glass inside.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: PackageCategory, default: PackageCategory.PARCEL })
  @IsOptional()
  @IsEnum(PackageCategory)
  category?: PackageCategory = PackageCategory.PARCEL;

  @ApiPropertyOptional({ example: 'PARCEL' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ example: 2.5, description: 'Weight in KG' })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  weightKg?: number;

  @ApiPropertyOptional({ example: 2.5, description: 'Weight in KG' })
  @IsOptional()
  @IsNumber()
  weight?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isFragile?: boolean = false;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isSensitive?: boolean = false;

  @ApiPropertyOptional({ example: 'https://cdn.dart.ng/packages/pkg-9812.jpg' })
  @IsOptional()
  @IsString()
  photoUrl?: string;

  @ApiPropertyOptional({ example: 50000, description: 'Estimated item value for insurance/escrow' })
  @IsOptional()
  @IsNumber()
  valueAmount?: number;

  @ApiPropertyOptional({ type: [PackageItemDto] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PackageItemDto)
  items?: PackageItemDto[];

  @ApiPropertyOptional({ type: CreateAddressDto })
  @IsOptional()
  pickupAddress?: any;

  @ApiPropertyOptional({ type: CreateAddressDto })
  @IsOptional()
  destinationAddress?: any;

  @ApiPropertyOptional({ example: 'Ring Road, Benin City' })
  @IsOptional()
  dropoffAddress?: any;

  @ApiPropertyOptional({ example: 'Ring Road, Benin City' })
  @IsOptional()
  recipientAddress?: any;

  @ApiPropertyOptional({ example: 'David Alabi' })
  @IsOptional()
  @IsString()
  senderName?: string;

  @ApiPropertyOptional({ example: '+2348011223344' })
  @IsOptional()
  @IsString()
  senderPhone?: string;

  @ApiPropertyOptional({ example: 'Sarah Jenkins' })
  @IsOptional()
  @IsString()
  recipientName?: string;

  @ApiPropertyOptional({ example: '+2348099887766' })
  @IsOptional()
  @IsString()
  recipientPhone?: string;

  @ApiPropertyOptional({ example: 'WALLET' })
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class SavePackageDraftDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  data: Record<string, any>;
}

export class DeletePackageDraftsDto {
  @ApiProperty({ type: [String], example: ['draft-id-1', 'draft-id-2'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  draftIds: string[];
}

export class DeleteInboundPackagesDto {
  @ApiProperty({ type: [String], example: ['inbound-id-1', 'inbound-id-2'] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  packageIds: string[];
}

export class LinkInboundPackageDto {
  @ApiProperty({ example: 'NG021358672334' })
  @IsString()
  @IsNotEmpty()
  trackingId: string;

  @ApiProperty({ example: 'SpeedAF Inbound Package' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ example: 'AliExpress' })
  @IsOptional()
  @IsString()
  store?: string;

  @ApiPropertyOptional({ example: 'PARCEL' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({ example: 'SpeedAF Express' })
  @IsString()
  @IsNotEmpty()
  courier: string;

  @ApiPropertyOptional({ example: 'Sep 12th 2026' })
  @IsOptional()
  @IsString()
  shippedDate?: string;

  @ApiPropertyOptional({ example: 'Sep 13th 2026' })
  @IsOptional()
  @IsString()
  estimatedArrival?: string;

  @ApiPropertyOptional({ example: 'Nigeria Clearance Hub' })
  @IsOptional()
  @IsString()
  fromLocation?: string;

  @ApiPropertyOptional({ example: 'Distribution DC-BNI CENTRAL' })
  @IsOptional()
  @IsString()
  toLocation?: string;

  @ApiPropertyOptional({ example: 'In-Transit' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isArrived?: boolean;

  @ApiPropertyOptional({ example: 'Jul 30th 2026' })
  @IsOptional()
  @IsString()
  arrivedDate?: string;

  @ApiPropertyOptional({ example: 'GIG Terminal, Auchi, Edo state' })
  @IsOptional()
  @IsString()
  pickupTerminal?: string;

  @ApiPropertyOptional({ example: 'Inbound shipment via SpeedAF' })
  @IsOptional()
  @IsString()
  fragileNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  tracks?: any[];

  @ApiPropertyOptional({ example: 'https://pay.speedaf.com/duty/123' })
  @IsOptional()
  @IsString()
  payUrl?: string;
}
