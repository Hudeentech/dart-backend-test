import { IsEnum, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VerificationType } from '@prisma/client';

export class RequestOtpDto {
  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ enum: VerificationType, default: VerificationType.PHONE_OTP })
  @IsEnum(VerificationType)
  type: VerificationType;

  @ApiPropertyOptional({ example: 'whatsapp', enum: ['sms', 'whatsapp'], default: 'sms' })
  @IsOptional()
  @IsString()
  channel?: 'sms' | 'whatsapp';

  @ApiPropertyOptional({ example: 'signup', enum: ['login', 'signup', 'reset_password'] })
  @IsOptional()
  @IsString()
  purpose?: 'login' | 'signup' | 'reset_password';
}

export class VerifyOtpDto {
  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  code: string;

  @ApiProperty({ enum: VerificationType, default: VerificationType.PHONE_OTP })
  @IsEnum(VerificationType)
  type: VerificationType;

  @ApiPropertyOptional({ example: 'signup', enum: ['login', 'signup'] })
  @IsOptional()
  @IsString()
  purpose?: 'login' | 'signup';

  @ApiPropertyOptional({ example: 'MySecurePassword123!' })
  @IsOptional()
  @IsString()
  password?: string;
}
