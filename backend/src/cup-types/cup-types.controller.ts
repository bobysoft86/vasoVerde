import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { CupTypesService } from './cup-types.service';
import { CreateCupTypeDto } from './dto/create-cup-type.dto';
import { UpdateCupTypeDto } from './dto/update-cup-type.dto';

@ApiTags('cup-types')
@ApiBearerAuth()
@Controller('cup-types')
@UseGuards(JwtAuthGuard)
export class CupTypesController {
  constructor(private readonly cupTypes: CupTypesService) {}
  @Get() list(
    @Req() req: AuthenticatedRequest,
    @Query('active') active?: string,
  ) {
    return this.cupTypes.list(
      req.user.companyId,
      active === undefined ? undefined : active === 'true',
    );
  }
  @Get(':id') get(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.cupTypes.get(req.user.companyId, id);
  }
  @Post() create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCupTypeDto,
  ) {
    return this.cupTypes.create(req.user, dto);
  }
  @Patch(':id') update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCupTypeDto,
  ) {
    return this.cupTypes.update(req.user, id, dto);
  }
}
