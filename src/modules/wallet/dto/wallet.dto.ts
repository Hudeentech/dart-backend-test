import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';

export class DepositDto {
  @ApiProperty({ example: 5000, description: 'Amount in NGN to deposit' })
  @IsNumber()
  @Min(100, { message: 'Minimum deposit is 100 NGN' })
  amount: number;

  @ApiPropertyOptional({ enum: PaymentMethod, default: PaymentMethod.CARD })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod = PaymentMethod.CARD;

  @ApiPropertyOptional({ example: 'IDEMP-DEP-18293849', description: 'Idempotency Key' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class WithdrawDto {
  @ApiProperty({ example: 10000, description: 'Amount in NGN to withdraw' })
  @IsNumber()
  @Min(500, { message: 'Minimum withdrawal is 500 NGN' })
  amount: number;

  @ApiProperty({ example: '058', description: 'Bank Code (e.g. GTBank 058)' })
  @IsString()
  @IsNotEmpty()
  bankCode: string;

  @ApiPropertyOptional({ example: 'Access Bank' })
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiProperty({ example: '0123456789' })
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty({ example: 'Chidi Okonkwo' })
  @IsString()
  @IsNotEmpty()
  accountName: string;

  @ApiPropertyOptional({ example: 'IDEMP-WTD-91823746' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
