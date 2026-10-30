import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  UpdateUserDto,
  CompleteProfileDto,
  CreateAddressDto,
  OnboardingProfileDto,
  SubmitNinDto,
} from './dto/user.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';


@ApiTags('Users & Addresses')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getProfile(userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update user profile details' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Post('onboarding')
  @ApiOperation({ summary: 'Save onboarding profile (Names, Gender, Avatar) with optional immediate verification' })
  async saveOnboarding(
    @CurrentUser('id') userId: string,
    @Body() dto: OnboardingProfileDto,
  ) {
    return this.usersService.saveOnboardingProfile(userId, dto);
  }

  @Post('me/onboarding')
  @ApiOperation({ summary: 'Alias: Save onboarding profile' })
  async saveOnboardingMe(
    @CurrentUser('id') userId: string,
    @Body() dto: OnboardingProfileDto,
  ) {
    return this.usersService.saveOnboardingProfile(userId, dto);
  }

  @Patch('me/complete-profile')
  @ApiOperation({ summary: 'Complete profile (First name, Last name, Phone) to unlock bookings and packages' })
  async completeProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: CompleteProfileDto,
  ) {
    return this.usersService.completeProfile(userId, dto);
  }

  @Get('addresses')
  @ApiOperation({ summary: 'List user saved addresses' })
  async getAddresses(@CurrentUser('id') userId: string) {
    return this.usersService.getAddresses(userId);
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Save a new address' })
  async createAddress(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateAddressDto,
  ) {
    return this.usersService.createAddress(userId, dto);
  }

  @Delete('addresses/:id')
  @ApiOperation({ summary: 'Delete a saved address' })
  async deleteAddress(
    @CurrentUser('id') userId: string,
    @Param('id') addressId: string,
  ) {
    return this.usersService.deleteAddress(userId, addressId);
  }

  @Get('verification')
  @ApiOperation({ summary: 'Get account verification progress and KYC status' })
  async getVerificationStatus(@CurrentUser('id') userId: string) {
    return this.usersService.getVerificationStatus(userId);
  }

  @Get('me/verification')
  @ApiOperation({ summary: 'Alias: Get account verification progress and KYC status' })
  async getVerificationStatusMe(@CurrentUser('id') userId: string) {
    return this.usersService.getVerificationStatus(userId);
  }

  @Post('verification/nin')
  @ApiOperation({ summary: 'Submit 11-digit NIN and ID document for verification' })
  async submitNin(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitNinDto,
  ) {
    return this.usersService.submitNin(userId, dto);
  }

  @Post('kyc/nin')
  @ApiOperation({ summary: 'Alias: Submit NIN for verification' })
  async submitNinAlias(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitNinDto,
  ) {
    return this.usersService.submitNin(userId, dto);
  }

  @Post('verification/email')
  @ApiOperation({ summary: 'Verify email for authenticated user' })
  async verifyEmail(
    @CurrentUser('id') userId: string,
    @Body() body: { email: string; code?: string },
  ) {
    return this.usersService.verifyEmail(userId, body.email);
  }

  @Post('verification/phone')
  @ApiOperation({ summary: 'Verify phone for authenticated user' })
  async verifyPhone(
    @CurrentUser('id') userId: string,
    @Body() body: { phoneNumber: string; code?: string },
  ) {
    return this.usersService.verifyPhone(userId, body.phoneNumber);
  }
}

