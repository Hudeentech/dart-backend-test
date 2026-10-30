import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RidersService } from './riders.service';
import {
  UpdateRiderAvailabilityDto,
  UpdateRiderLocationDto,
  UpdateRiderProfileDto,
  FindAvailableRidersQueryDto,
} from './dto/rider.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Riders')
@ApiBearerAuth()
@Controller('riders')
export class RidersController {
  constructor(private readonly ridersService: RidersService) {}

  @Public()
  @Get('available')
  @ApiOperation({ summary: 'Discover available and eligible riders' })
  async findAvailable(@Query() query: FindAvailableRidersQueryDto) {
    return this.ridersService.findAvailableRiders(query);
  }

  @Get('profile')
  @Roles(UserRole.RIDER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get current rider profile' })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.ridersService.getProfile(userId);
  }

  @Patch('profile')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Update rider profile details' })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateRiderProfileDto,
  ) {
    return this.ridersService.updateProfile(userId, dto);
  }

  @Post('availability')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Update rider availability status (ONLINE/OFFLINE/BUSY)' })
  async updateAvailability(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateRiderAvailabilityDto,
  ) {
    return this.ridersService.updateAvailability(userId, dto);
  }

  @Post('location')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Update rider GPS coordinates beacon' })
  async updateLocation(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateRiderLocationDto,
  ) {
    return this.ridersService.updateLocation(userId, dto);
  }
}
