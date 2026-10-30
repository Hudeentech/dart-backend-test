import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/rating.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('Ratings & Reviews')
@ApiBearerAuth()
@Controller('ratings')
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit rating and review for a completed order' })
  async createRating(
    @CurrentUser('id') customerId: string,
    @Body() dto: CreateRatingDto,
  ) {
    return this.ratingsService.submitRating(customerId, dto);
  }

  @Public()
  @Get('rider/:riderUserId')
  @ApiOperation({ summary: 'Get reviews and rating history for a rider' })
  async getRiderRatings(@Param('riderUserId') riderUserId: string) {
    return this.ratingsService.getRiderRatings(riderUserId);
  }
}
