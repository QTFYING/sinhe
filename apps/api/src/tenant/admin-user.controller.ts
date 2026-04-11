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
import { ApiBearerAuth, ApiExtraModels, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
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
import {
  CreateUserPasswordResetResponseSwagger,
  UserListResponseSwagger,
  UserRecordItemSwagger,
} from './tenant.swagger';

@ApiTags('Admin Users')
@ApiBearerAuth()
@ApiExtraModels(UserListResponseSwagger, UserRecordItemSwagger, CreateUserPasswordResetResponseSwagger)
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminUserController {
  constructor(private readonly tenantService: TenantService) {}

  @ApiOperation({ summary: '获取平台用户列表' })
  @ApiOkResponse({ type: UserListResponseSwagger })
  @Get()
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async getUsers(@Query() query: ListUsersQueryDto): Promise<PaginatedResponse<UserRecordItem>> {
    return this.tenantService.getAdminUsers(query as UserListQuery);
  }

  @ApiOperation({ summary: '创建平台用户' })
  @ApiOkResponse({ type: UserRecordItemSwagger })
  @Post()
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async createUser(
    @CurrentUser() currentUser: JwtPayload,
    @Body() request: UpsertUserDto,
    @Ip() ip: string,
  ): Promise<UserRecordItem> {
    return this.tenantService.createAdminUser(currentUser, request as UserUpsertRequest, ip);
  }

  @ApiOperation({ summary: '更新平台用户' })
  @ApiParam({ name: 'id', description: '用户 ID', format: 'uuid' })
  @ApiOkResponse({ type: UserRecordItemSwagger })
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

  @ApiOperation({ summary: '删除平台用户' })
  @ApiParam({ name: 'id', description: '用户 ID', format: 'uuid' })
  @ApiOkResponse({ description: '删除成功', schema: { type: 'null' } })
  @Delete(':id')
  @Roles(UserRoleEnum.OS_SUPER_ADMIN)
  async deleteUser(
    @CurrentUser() currentUser: JwtPayload,
    @Param('id', new ParseUUIDPipe()) userId: string,
    @Ip() ip: string,
  ): Promise<null> {
    return this.tenantService.deleteAdminUser(currentUser, userId, ip);
  }

  @ApiOperation({ summary: '更新平台用户状态' })
  @ApiParam({ name: 'id', description: '用户 ID', format: 'uuid' })
  @ApiOkResponse({ type: UserRecordItemSwagger })
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

  @ApiOperation({ summary: '创建密码重置记录' })
  @ApiParam({ name: 'id', description: '用户 ID', format: 'uuid' })
  @ApiOkResponse({ type: CreateUserPasswordResetResponseSwagger })
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
