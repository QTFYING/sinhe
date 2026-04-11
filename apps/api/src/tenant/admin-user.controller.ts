import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
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
  CreateUserPasswordResetRequest,
  CreateUserPasswordResetResponse,
  UserListQuery,
  UserRecordItem,
  UserStatusUpdateRequest,
  UserUpsertRequest,
} from '@shou/types/contracts';
import type { PaginatedResponse } from '@shou/types/common';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateUserPasswordResetDto } from './dto/create-user-password-reset.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { PatchUserStatusDto } from './dto/patch-user-status.dto';
import { UpsertUserDto } from './dto/upsert-user.dto';
import { TenantService } from './tenant.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminUserController {
  constructor(private readonly tenantService: TenantService) {}

  @Get()
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async getUsers(@Query() query: ListUsersQueryDto): Promise<PaginatedResponse<UserRecordItem>> {
    return this.tenantService.getAdminUsers(query as UserListQuery);
  }

  @Post()
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async createUser(
    @CurrentUser() currentUser: JwtPayload,
    @Body() request: UpsertUserDto,
    @Ip() ip: string,
  ): Promise<UserRecordItem> {
    return this.tenantService.createAdminUser(currentUser, request as UserUpsertRequest, ip);
  }

  @Put(':id')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async updateUser(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() request: UpsertUserDto,
    @Ip() ip: string,
  ): Promise<UserRecordItem> {
    return this.tenantService.updateAdminUser(
      currentUser,
      userId,
      request as UserUpsertRequest,
      ip,
    );
  }

  @Delete(':id')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async deleteUser(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Ip() ip: string,
  ): Promise<null> {
    return this.tenantService.deleteAdminUser(currentUser, userId, ip);
  }

  @Patch(':id')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async patchUserStatus(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() request: PatchUserStatusDto,
    @Ip() ip: string,
  ): Promise<UserRecordItem> {
    return this.tenantService.patchAdminUserStatus(
      currentUser,
      userId,
      request as UserStatusUpdateRequest,
      ip,
    );
  }

  @Post(':id/password-resets')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async resetPassword(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Body() request: CreateUserPasswordResetDto,
    @Ip() ip: string,
  ): Promise<CreateUserPasswordResetResponse> {
    return this.tenantService.resetAdminUserPassword(
      currentUser,
      userId,
      request as CreateUserPasswordResetRequest,
      ip,
    );
  }
}
