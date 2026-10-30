import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRatingDto {
  @ApiProperty({ example: 'clx123orderid', description: 'Order ID' })
  @IsString()
  @IsNotEmpty()
  orderId: string;

  @ApiPropertyOptional({ example: 'rider-user-id', description: 'Rider User ID' })
  @IsOptional()
  @IsString()
  riderUserId?: string;

  @ApiProperty({ example: 5, description: 'Rating score from 1 to 5' })
  @IsInt()
  @Min(1)
  @Max(5)
  score: number;

  @ApiPropertyOptional({ example: 'Very fast pickup and arrived in perfect condition!' })
  @IsOptional()
  @IsString()
  review?: string;

  @ApiPropertyOptional({ example: 'Very fast pickup and arrived in perfect condition!' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ example: ['On-Time', 'Polite', 'Careful'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
