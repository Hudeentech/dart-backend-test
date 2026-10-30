import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { ProcessOrderPaymentDto } from './dto/payment.dto';
import { SaveCardDto } from './dto/card.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('Payments')
@Controller()
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth()
  @Post('orders/:id/payment')
  @ApiOperation({ summary: 'Initiate order payment (Wallet, Card, COD)' })
  async processPayment(
    @CurrentUser('id') userId: string,
    @Param('id') orderId: string,
    @Body() dto: ProcessOrderPaymentDto,
  ) {
    return this.paymentsService.processOrderPayment(userId, orderId, dto);
  }

  @Public()
  @Post('payments/webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process payment gateway webhooks (Paystack / Gateway)' })
  async handleWebhook(
    @Headers('x-paystack-signature') signature: string,
    @Body() payload: any,
  ) {
    return this.paymentsService.handleWebhook(signature, payload);
  }

  @ApiBearerAuth()
  @Get('payments/methods')
  @ApiOperation({ summary: 'Get payment methods overview (Wallet, Saved Cards, COD)' })
  async getPaymentMethods(@CurrentUser('id') userId: string) {
    return this.paymentsService.getPaymentOverview(userId);
  }

  @ApiBearerAuth()
  @Get('payments/cards')
  @ApiOperation({ summary: 'List all saved cards for the current user' })
  async listSavedCards(@CurrentUser('id') userId: string) {
    return this.paymentsService.listSavedCards(userId);
  }

  @ApiBearerAuth()
  @Post('payments/cards')
  @ApiOperation({ summary: 'Save and tokenize a new card' })
  async saveCard(
    @CurrentUser('id') userId: string,
    @Body() dto: SaveCardDto,
  ) {
    return this.paymentsService.saveCard(userId, dto);
  }

  @ApiBearerAuth()
  @Patch('payments/cards/:id/default')
  @ApiOperation({ summary: 'Set a saved card as the default payment method' })
  async setDefaultCard(
    @CurrentUser('id') userId: string,
    @Param('id') cardId: string,
  ) {
    return this.paymentsService.setDefaultCard(userId, cardId);
  }

  @ApiBearerAuth()
  @Delete('payments/cards/:id')
  @ApiOperation({ summary: 'Delete a saved card' })
  async deleteCard(
    @CurrentUser('id') userId: string,
    @Param('id') cardId: string,
  ) {
    return this.paymentsService.deleteCard(userId, cardId);
  }
}
