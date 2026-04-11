import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRoleEnum } from '@prisma/client';
import type {
  AdminOrderItem,
  CreateOrderReceiptRequest,
  CreateOrderReceiptResponse,
  CreateOrderReminderRequest,
  CreateOrderReminderResponse,
  CreateOrderRequest,
  CreditOrderItem,
  OrderPrintRecordRequest,
  OrderPrintRecordResponse,
  TenantOrderItem,
  UpdateOrderRequest,
  VoidOrderRequest,
} from '@shou/types/contracts';
import type { PaginatedResponse } from '@shou/types/common';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateOrderPrintRecordDto } from './dto/create-order-print-record.dto';
import { CreateOrderReceiptDto } from './dto/create-order-receipt.dto';
import { CreateOrderReminderDto } from './dto/create-order-reminder.dto';
import { ListCreditOrdersQueryDto } from './dto/list-credit-orders.query.dto';
import { ListOrdersQueryDto } from './dto/list-orders.query.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { VoidOrderDto } from './dto/void-order.dto';
import { OrderService } from './order.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get('credit')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_FINANCE)
  async getCreditOrders(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: ListCreditOrdersQueryDto,
  ): Promise<PaginatedResponse<CreditOrderItem>> {
    return this.orderService.getCreditOrders(currentUser, query.page, query.pageSize);
  }

  @Post('print-records')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async createPrintRecord(
    @CurrentUser() currentUser: JwtPayload,
    @Body() request: CreateOrderPrintRecordDto,
  ): Promise<OrderPrintRecordResponse> {
    return this.orderService.createPrintRecord(
      currentUser,
      request as OrderPrintRecordRequest,
    );
  }

  @Get()
  @Roles(
    UserRoleEnum.OS_SUPER_ADMIN,
    UserRoleEnum.TENANT_OWNER,
    UserRoleEnum.TENANT_OPERATOR,
    UserRoleEnum.TENANT_FINANCE,
    UserRoleEnum.TENANT_VIEWER,
  )
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: ListOrdersQueryDto,
  ): Promise<PaginatedResponse<TenantOrderItem | AdminOrderItem>> {
    return this.orderService.findAll(currentUser, query);
  }

  @Get(':id')
  @Roles(
    UserRoleEnum.OS_SUPER_ADMIN,
    UserRoleEnum.TENANT_OWNER,
    UserRoleEnum.TENANT_OPERATOR,
    UserRoleEnum.TENANT_FINANCE,
    UserRoleEnum.TENANT_VIEWER,
  )
  async getOrder(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<TenantOrderItem | AdminOrderItem> {
    return this.orderService.getOrder(id, currentUser);
  }

  @Post()
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async createOrder(
    @CurrentUser() currentUser: JwtPayload,
    @Body() request: CreateOrderDto,
  ): Promise<TenantOrderItem> {
    return this.orderService.createOrder(currentUser, request as CreateOrderRequest);
  }

  @Put(':id')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async updateOrder(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() request: UpdateOrderDto,
  ): Promise<TenantOrderItem> {
    return this.orderService.updateOrder(currentUser, id, request as UpdateOrderRequest);
  }

  @Patch(':id')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_OPERATOR)
  async voidOrder(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() request: VoidOrderDto,
  ): Promise<TenantOrderItem> {
    return this.orderService.voidOrder(currentUser, id, request as VoidOrderRequest);
  }

  @Post(':id/reminders')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_FINANCE)
  async createReminder(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() request: CreateOrderReminderDto,
  ): Promise<CreateOrderReminderResponse> {
    return this.orderService.createReminder(
      currentUser,
      id,
      request as CreateOrderReminderRequest,
    );
  }

  @Post(':id/receipts')
  @Roles(UserRoleEnum.TENANT_OWNER, UserRoleEnum.TENANT_FINANCE)
  async createReceipt(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() request: CreateOrderReceiptDto,
  ): Promise<CreateOrderReceiptResponse> {
    return this.orderService.createReceipt(
      currentUser,
      id,
      request as CreateOrderReceiptRequest,
    );
  }
}
