import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import {
  SelectRiderDto,
  ConfirmDeliveryDto,
  CancelOrderDto,
  DeleteOrdersDto,
  ReassignRiderDto,
} from './dto/order.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  @ApiOperation({ summary: 'List user orders (customer or rider)' })
  async listOrders(@CurrentUser('id') userId: string) {
    return this.ordersService.listUserOrders(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order details by ID' })
  async getOrder(
    @CurrentUser('id') userId: string,
    @Param('id') orderId: string,
  ) {
    return this.ordersService.getOrderById(userId, orderId);
  }

  @Get(':id/live-status')
  @ApiOperation({ summary: 'Get live package status, tracking metrics, and rider info' })
  async getLiveStatus(
    @CurrentUser('id') userId: string,
    @Param('id') orderId: string,
  ) {
    return this.ordersService.getLiveOrderStatus(userId, orderId);
  }

  @Post(':id/select-rider')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Customer selects an available rider' })
  async selectRider(
    @CurrentUser('id') customerId: string,
    @Param('id') orderId: string,
    @Body() dto: SelectRiderDto,
  ) {
    return this.ordersService.selectRider(customerId, orderId, dto);
  }

  @Post(':id/accept-rider')
  @ApiOperation({ summary: 'Trigger or simulate rider accepting delivery task' })
  async simulateRiderAccept(
    @CurrentUser('id') userId: string,
    @Param('id') orderId: string,
  ) {
    return this.ordersService.simulateRiderAccept(userId, orderId);
  }

  @Post(':id/reassign-rider')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Customer chooses another rider after wait countdown expires' })
  async reassignRider(
    @CurrentUser('id') customerId: string,
    @Param('id') orderId: string,
    @Body() dto: ReassignRiderDto,
  ) {
    return this.ordersService.reassignRider(customerId, orderId, dto);
  }

  @Post(':id/extend-wait')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Customer extends wait time for assigned rider' })
  async extendWait(
    @CurrentUser('id') customerId: string,
    @Param('id') orderId: string,
  ) {
    return this.ordersService.extendWait(customerId, orderId);
  }

  @Post(':id/accept')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Rider accepts assigned delivery task' })
  async acceptOrder(
    @CurrentUser('id') riderUserId: string,
    @Param('id') orderId: string,
  ) {
    return this.ordersService.acceptOrder(riderUserId, orderId);
  }

  @Post(':id/pickup')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Rider marks package picked up (advances to PICKED_UP & generates handover code)' })
  async pickupOrder(
    @CurrentUser('id') riderUserId: string,
    @Param('id') orderId: string,
  ) {
    return this.ordersService.pickupOrder(riderUserId, orderId);
  }

  @Post(':id/confirm-delivery')
  @Roles(UserRole.RIDER)
  @ApiOperation({ summary: 'Rider submits the 5-digit handover code to complete and settle delivery' })
  async confirmDelivery(
    @CurrentUser('id') riderUserId: string,
    @Param('id') orderId: string,
    @Body() dto: ConfirmDeliveryDto,
  ) {
    return this.ordersService.confirmDelivery(riderUserId, orderId, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel order and release active holds' })
  async cancelOrder(
    @CurrentUser('id') userId: string,
    @Param('id') orderId: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOrder(userId, orderId, dto);
  }

  @Get(':id/handover-code')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Customer views delivery handover code' })
  async getHandoverCode(
    @CurrentUser('id') customerId: string,
    @Param('id') orderId: string,
  ) {
    return this.ordersService.getHandoverCode(customerId, orderId);
  }

  @Post(':id/confirm-receipt')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Customer confirms delivery receipt' })
  async confirmCustomerReceipt(
    @CurrentUser('id') customerId: string,
    @Param('id') orderId: string,
  ) {
    return this.ordersService.confirmCustomerReceipt(customerId, orderId);
  }

  @Delete('bulk')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Delete multiple deletable customer orders' })
  async deleteOrders(
    @CurrentUser('id') customerId: string,
    @Body() dto: DeleteOrdersDto,
  ) {
    return this.ordersService.deleteOrders(customerId, dto.orderIds);
  }

  @Delete(':id')
  @Roles(UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Customer deletes/removes a draft, completed, or cancelled package order' })
  async deleteOrder(
    @CurrentUser('id') customerId: string,
    @Param('id') orderId: string,
  ) {
    return this.ordersService.deleteOrder(customerId, orderId);
  }
}
