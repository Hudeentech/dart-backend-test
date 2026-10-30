import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CustomerSignupDto, RiderSignupDto, GoogleAuthDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestOtpDto, VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CheckIdentifierDto } from './dto/check-identifier.dto';
import { Public } from '@/common/decorators/public.decorator';
import { UserRole } from '@prisma/client';
import { Request } from 'express';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('signup/customer')
  @ApiOperation({ summary: 'Register a new customer using email or phone number (no role selection needed)' })
  @ApiResponse({ status: 201, description: 'Customer account created' })
  async signupCustomer(@Body() dto: CustomerSignupDto) {
    return this.authService.signupCustomer(dto);
  }

  @Public()
  @Post('signup/rider')
  @ApiOperation({ summary: 'Register a new rider using email or phone number (no role selection needed)' })
  @ApiResponse({ status: 201, description: 'Rider account created' })
  async signupRider(@Body() dto: RiderSignupDto) {
    return this.authService.signupRider(dto);
  }

  @Public()
  @Post('google/customer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Continue with Google as a Customer' })
  async googleCustomer(@Body() dto: GoogleAuthDto) {
    return this.authService.googleAuth(UserRole.CUSTOMER, dto);
  }

  @Public()
  @Post('google/rider')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Continue with Google as a Rider' })
  async googleRider(@Body() dto: GoogleAuthDto) {
    return this.authService.googleAuth(UserRole.RIDER, dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email/phone and password' })
  @ApiResponse({ status: 200, description: 'Authentication successful' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'];
    return this.authService.login(dto, ip, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate and refresh JWT access token' })
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and revoke active session' })
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }


  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request OTP for phone or email verification' })
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP code' })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post('check-identifier')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check if an account exists by email or phone number' })
  async checkIdentifier(@Body() dto: CheckIdentifierDto) {
    return this.authService.checkIdentifier(dto.identifier);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset user password with verified OTP' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
