import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CustomerSignupDto {
  @ApiPropertyOptional({ example: 'customer@dart.ng' })
  @ValidateIf((o) => !o.phoneNumber || o.email)
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @ValidateIf((o) => !o.email || o.phoneNumber)
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'SecurePassword123!' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ example: 'David Alabi' })
  @IsString()
  @IsOptional()
  fullName?: string;
}

export class RiderSignupDto {
  @ApiPropertyOptional({ example: 'rider@dart.ng' })
  @ValidateIf((o) => !o.phoneNumber || o.email)
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+2348098765432' })
  @ValidateIf((o) => !o.email || o.phoneNumber)
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'SecurePassword123!' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ example: 'Rider John' })
  @IsString()
  @IsOptional()
  fullName?: string;
}

export class GoogleAuthDto {
  @ApiPropertyOptional({ example: 'google-oauth2-id-token-or-sub' })
  @IsString()
  @IsNotEmpty()
  tokenOrId: string;

  @ApiPropertyOptional({ example: 'customer@gmail.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: 'Chidi' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Okonkwo' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: 'https://lh3.googleusercontent.com/avatar.jpg' })
  @IsString()
  @IsOptional()
  profileImageUrl?: string;
}
