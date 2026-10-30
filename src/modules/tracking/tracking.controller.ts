import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TrackingService } from './tracking.service';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('Tracking')
@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Public()
  @Get(':trackingId')
  @ApiOperation({ summary: 'Public tracking of package and delivery milestones' })
  async getTracking(@Param('trackingId') trackingId: string) {
    return this.trackingService.getTrackingTimeline(trackingId);
  }
}
