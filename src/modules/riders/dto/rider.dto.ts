import {
  IsEnum,
  Max,
  Min,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RiderStatus, VehicleType } from '@prisma/client';

export class UpdateRiderAvailabilityDto {
  @ApiProperty({ enum: RiderStatus, example: RiderStatus.ONLINE })
  @IsEnum(RiderStatus)
  @IsNotEmpty()
  status: RiderStatus;
}

export class UpdateRiderLocationDto {
  @ApiProperty({ example: 6.4474 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @ApiProperty({ example: 3.4723 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}

export class UpdateRiderProfileDto {
  @ApiPropertyOptional({ enum: VehicleType })
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;

  @ApiPropertyOptional({ example: 'KJA-123XY' })
  @IsOptional()
  @IsString()
  plateNumber?: string;

  @ApiPropertyOptional({ example: 'LAG-LIC-9821' })
  @IsOptional()
  @IsString()
  licenseNumber?: string;
}

export class FindAvailableRidersQueryDto {
  @ApiPropertyOptional({ example: 6.4474 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 3.4723 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: 6.4474 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ example: 3.4723 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ example: 10, description: 'Max radius in KM' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxDistanceKm?: number;
}
