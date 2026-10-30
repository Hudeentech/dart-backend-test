import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { DepositDto, WithdrawDto } from './dto/wallet.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

@ApiTags('Wallet & Ledger')
@ApiBearerAuth()
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user wallet account and balances' })
  async getWallet(@CurrentUser('id') userId: string) {
    return this.walletService.getWallet(userId);
  }

  @Post('deposit')
  @ApiOperation({ summary: 'Deposit funds into wallet' })
  async deposit(
    @CurrentUser('id') userId: string,
    @Body() dto: DepositDto,
  ) {
    return this.walletService.deposit(userId, dto);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Withdraw funds from wallet to bank' })
  async withdraw(
    @CurrentUser('id') userId: string,
    @Body() dto: WithdrawDto,
  ) {
    return this.walletService.withdraw(userId, dto);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get ledger transaction and balance audit history' })
  async getTransactions(@CurrentUser('id') userId: string) {
    return this.walletService.getTransactions(userId);
  }
}
