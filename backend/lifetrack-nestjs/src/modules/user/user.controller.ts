import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';

import { UserService } from './user.service';
import {
  UpdateProfileDto,
  UpdateElderlyProfileDto,
  CreateElderlyProfileDto,
  AdminUpdateUserDto,
  UserQueryDto,
} from './dto/user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User, UserRole } from '../../entities/auth/user.entity';

@ApiTags('Users & Profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ── UC-04: Personal Profile ───────────────────────────────────────────────

  @Get('users/me')
  @ApiOperation({ summary: 'Get own profile (UC-04)' })
  async getMyProfile(@CurrentUser() user: User) {
    return this.userService.getProfile(user.id);
  }

  @Put('users/me')
  @ApiOperation({ summary: 'Update own profile (UC-04)' })
  async updateMyProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.userService.updateProfile(user.id, dto);
  }

  // ── Search users by name/email (for caregiver) ───────────────────────────

  @Get('users/search')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CAREGIVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Search users by name or email' })
  async searchUsers(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.userService.searchUsers(q, limit ? parseInt(limit) : 10);
  }

  // ── UC-05: Elderly Profiles ───────────────────────────────────────────────

  @Get('elderly')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CAREGIVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'List elderly profiles (UC-05)' })
  async listElderly(@CurrentUser() user: User, @Query('caregiverId') caregiverId?: string) {
    const effectiveCaregiverId =
      user.role === UserRole.CAREGIVER ? user.id : caregiverId;
    return this.userService.listElderlyProfiles(effectiveCaregiverId);
  }

  @Post('elderly')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CAREGIVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Create elderly profile (UC-05)' })
  async createElderly(
    @Body() dto: CreateElderlyProfileDto,
    @CurrentUser() user: User,
  ) {
    return this.userService.createElderlyProfile(dto, user.id);
  }

  @Get('elderly/:id')
  @ApiOperation({ summary: 'Get elderly profile by ID (UC-05)' })
  async getElderly(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.getElderlyProfile(id);
  }

  @Put('elderly/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CAREGIVER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Update elderly profile (UC-05)' })
  async updateElderly(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateElderlyProfileDto,
  ) {
    return this.userService.updateElderlyProfile(id, dto);
  }

  @Delete('elderly/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.CAREGIVER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete elderly profile (UC-05)' })
  async deleteElderly(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.softDeleteElderlyProfile(id);
  }

  // ── UC-16: Admin User Management ──────────────────────────────────────────

  @Get('admin/users')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: list all users (UC-16)' })
  async adminListUsers(@Query() query: UserQueryDto) {
    return this.userService.listUsers(query);
  }

  @Patch('admin/users/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Admin: update user role/status (UC-16)' })
  async adminUpdateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() admin: User,
  ) {
    return this.userService.adminUpdateUser(id, dto, admin.id);
  }

  @Delete('admin/users/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: delete user (UC-16)' })
  async adminDeleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: User,
  ) {
    return this.userService.adminDeleteUser(id, admin.id);
  }
}
