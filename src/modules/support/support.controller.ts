import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';

@ApiTags('Support & Issue Reporting')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @ApiOperation({ summary: 'Submit a new support ticket / issue report' })
  async createTicket(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTicketDto,
  ) {
    return this.supportService.createTicket(userId, dto);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'List all support tickets submitted by current user' })
  async listUserTickets(@CurrentUser('id') userId: string) {
    return this.supportService.listUserTickets(userId);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get details of a specific support ticket' })
  async getTicket(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ) {
    return this.supportService.getTicket(userId, id);
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Get list of supported issue categories' })
  getCategories() {
    return this.supportService.getCategories();
  }
}
