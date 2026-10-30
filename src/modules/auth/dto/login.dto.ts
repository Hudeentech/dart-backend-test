import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LoginDto {
  @ApiPropertyOptional({ example: 'customer@dart.ng' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: '+2347031013632' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'customer@dart.ng' })
  @IsOptional()
  @IsString()
  identifier?: string;

  @ApiProperty({ example: 'SecurePassword123!' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'd3f56a81-7c98-4bfa-a388-66236bfa799a' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
