import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole, AccountStatus } from '@prisma/client';

@ApiTags('Admin & Operations')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get operational metrics and revenue summary' })
  async getDashboard() {
    return this.adminService.getDashboardMetrics();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Retrieve system immutable audit trail' })
  async getAuditLogs(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getAuditLogs(Number(page) || 1, Number(limit) || 50);
  }

  @Get('orders/:id/inspect')
  @ApiOperation({ summary: 'Deep audit and inspection of an order and its ledger/settlement events' })
  async inspectOrder(@Param('id') orderId: string) {
    return this.adminService.inspectOrder(orderId);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Update user account status (e.g. SUSPENDED, ACTIVE)' })
  async updateUserStatus(
    @Param('id') userId: string,
    @Body('status') status: AccountStatus,
    @Body('reason') reason?: string,
  ) {
    return this.adminService.updateUserStatus(userId, status, reason);
  }
}
