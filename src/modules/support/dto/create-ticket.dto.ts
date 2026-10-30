import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTicketDto {
  @ApiProperty({
    example: 'Booking a delivery',
    description: 'Category of the reported issue',
  })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({
    example: 'The rider did not arrive at the scheduled pickup point',
    description: 'Detailed description of the issue',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    example: 'Pickup delay issue',
    description: 'Brief subject or title',
  })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({
    example: 'a0b1c2d3-uuid',
    description: 'Optional associated order ID',
  })
  @IsString()
  @IsOptional()
  orderId?: string;
}
