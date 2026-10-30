import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: '+2348012345678 or rider@dart.ng' })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  code: string;

  @ApiProperty({ example: 'NewSecurePassword123!' })
  @IsString()
  @Length(6, 100, { message: 'Password must be between 6 and 100 characters' })
  newPassword: string;
}
