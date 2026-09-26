import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GlobalRole } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AdminPasswordDto } from './dto/admin-password.dto';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(GlobalRole.ADMIN, GlobalRole.SUPER_ADMIN)
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get() findAll(@Req() req: AuthenticatedRequest) {
    return this.users.findAll(req.user.companyId);
  }
  @Get(':id') findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.users.findOne(req.user.companyId, id);
  }
  @Post() create(@Req() req: AuthenticatedRequest, @Body() dto: CreateUserDto) {
    return this.users.create(req.user.companyId, dto);
  }
  @Patch(':id') update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(req.user.companyId, id, dto);
  }
  @Patch(':id/status') status(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.users.setStatus(req.user.companyId, id, dto.active);
  }
  @Patch(':id/password') password(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AdminPasswordDto,
  ) {
    return this.users.setPassword(req.user.companyId, id, dto);
  }
}
