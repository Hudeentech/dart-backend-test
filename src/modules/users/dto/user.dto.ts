import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitNinDto {
  @ApiProperty({ example: '12345678901', description: '11-digit National Identity Number' })
  @IsString()
  @IsNotEmpty({ message: 'NIN is required' })
  @Length(11, 11, { message: 'NIN must be exactly 11 digits' })
  @Matches(/^\d{11}$/, { message: 'NIN must contain only numeric digits' })
  nin: string;

  @ApiPropertyOptional({ example: 'https://cdn.dart.ng/kyc/nin-card-1.jpg', description: 'Photo or front-view of ID card' })
  @IsOptional()
  @IsString()
  idCardImage?: string;

  @ApiPropertyOptional({ example: 'NIN', enum: ['NIN', 'VOTERS_CARD', 'DRIVERS_LICENSE', 'PASSPORT'] })
  @IsOptional()
  @IsString()
  idType?: string;
}


export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Chidi' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Okonkwo' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'https://cdn.dart.ng/avatars/user-1.jpg' })
  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @ApiPropertyOptional({ example: 'male', enum: ['male', 'female', 'other'] })
  @IsOptional()
  @IsString()
  gender?: string;
}

export class CompleteProfileDto {
  @ApiProperty({ example: 'Chidi' })
  @IsString()
  @IsNotEmpty({ message: 'First name is required to complete profile' })
  firstName: string;

  @ApiProperty({ example: 'Okonkwo' })
  @IsString()
  @IsNotEmpty({ message: 'Last name is required to complete profile' })
  lastName: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'customer@dart.ng' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ example: 'https://cdn.dart.ng/avatars/user-1.jpg' })
  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @ApiPropertyOptional({ example: 'male', enum: ['male', 'female', 'other'] })
  @IsOptional()
  @IsString()
  gender?: string;
}

export class OnboardingProfileDto {
  @ApiPropertyOptional({ example: 'Adebayo' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Okonkwo' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 'Adebayo Okonkwo' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiPropertyOptional({ example: 'male', enum: ['male', 'female', 'other'] })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb' })
  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @ApiPropertyOptional({ example: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb' })
  @IsOptional()
  @IsString()
  profilePicture?: string;

  @ApiPropertyOptional({ example: '+2347031013632' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '+2347031013632' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'Auchi, Edo State' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: false, description: 'If true, verifies account immediately to unlock all features' })
  @IsOptional()
  @IsBoolean()
  verifyNow?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Alias for verifyNow' })
  @IsOptional()
  @IsBoolean()
  verified?: boolean;
}

export class CreateAddressDto {
  @ApiPropertyOptional({ example: 'Home' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: '15 Admiralty Way, Lekki Phase 1' })
  @IsOptional()
  @IsString()
  street?: string;

  @ApiPropertyOptional({ example: '15 Admiralty Way, Lekki Phase 1' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: 'Lagos' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'Lagos State' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: '105102' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ example: 6.4474 })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ example: 3.4723 })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ example: 'Chidi Okonkwo' })
  @IsOptional()
  @IsString()
  contactName?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
