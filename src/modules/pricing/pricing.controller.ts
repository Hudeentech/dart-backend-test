import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PricingService } from './pricing.service';
import { DeliveryQuoteRequestDto } from './dto/quote.dto';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('Pricing & Quotes')
@Controller('orders')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Public()
  @Post('quote')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Calculate authoritative delivery price quote' })
  async calculateQuote(@Body() dto: DeliveryQuoteRequestDto) {
    return this.pricingService.calculateQuote(dto);
  }
}
