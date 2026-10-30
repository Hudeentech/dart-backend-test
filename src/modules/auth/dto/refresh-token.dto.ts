import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ example: 'd3f56a81-7c98-4bfa-a388-66236bfa799a' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
