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
import { BarsService } from './bars.service';
import { CreateBarDto } from './dto/create-bar.dto';
import { UpdateBarDto } from './dto/update-bar.dto';
@ApiTags('bars')
@ApiBearerAuth()
@Controller('events/:eventId/bars')
@UseGuards(JwtAuthGuard)
export class BarsController {
  constructor(private readonly bars: BarsService) {}
  @Get() list(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Query('search') search?: string,
    @Query('boothId') boothId?: string,
    @Query('active') active?: string,
  ) {
    return this.bars.list(
      req.user,
      eventId,
      search,
      boothId,
      active === undefined ? undefined : active === 'true',
    );
  }
  @Get(':barId') get(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('barId') id: string,
  ) {
    return this.bars.get(req.user, eventId, id);
  }
  @Post() create(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Body() dto: CreateBarDto,
  ) {
    return this.bars.create(req.user, eventId, dto);
  }
  @Patch(':barId') update(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('barId') id: string,
    @Body() dto: UpdateBarDto,
  ) {
    return this.bars.update(req.user, eventId, id, dto);
  }
}
