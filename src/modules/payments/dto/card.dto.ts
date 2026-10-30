import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveCardDto {
  @ApiProperty({ description: 'Card number (16-19 digits)', example: '5399410012345678' })
  @IsString()
  @IsNotEmpty()
  cardNumber: string;

  @ApiPropertyOptional({ description: 'Cardholder name', example: 'John Doe' })
  @IsOptional()
  @IsString()
  cardHolder?: string;

  @ApiProperty({ description: 'Expiry date in MM/YY format', example: '08/28' })
  @IsString()
  @IsNotEmpty()
  expiry: string;

  @ApiPropertyOptional({ description: '3 or 4 digit CVV/CVC', example: '123' })
  @IsOptional()
  @IsString()
  cvv?: string;

  @ApiPropertyOptional({ description: 'Set this card as default', default: false })
  @IsOptional()
  @IsBoolean()
  setAsDefault?: boolean;
}
