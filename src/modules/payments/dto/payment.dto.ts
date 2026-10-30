import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class ProcessOrderPaymentDto {
  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.WALLET })
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ example: 'https://dart.ng/orders/callback' })
  @IsOptional()
  @IsString()
  callbackUrl?: string;

  @ApiPropertyOptional({ example: 'IDEMP-PAY-81928471' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
