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
import { BoothsService } from './booths.service';
import { CreateBoothDto } from './dto/create-booth.dto';
import { UpdateBoothDto } from './dto/update-booth.dto';
@ApiTags('booths')
@ApiBearerAuth()
@Controller('events/:eventId/booths')
@UseGuards(JwtAuthGuard)
export class BoothsController {
  constructor(private readonly booths: BoothsService) {}
  @Get() list(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Query('search') search?: string,
    @Query('active') active?: string,
  ) {
    return this.booths.list(
      req.user,
      eventId,
      search,
      active === undefined ? undefined : active === 'true',
    );
  }
  @Get(':boothId') get(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('boothId') id: string,
  ) {
    return this.booths.get(req.user, eventId, id);
  }
  @Post() create(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Body() dto: CreateBoothDto,
  ) {
    return this.booths.create(req.user, eventId, dto);
  }
  @Patch(':boothId') update(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('boothId') id: string,
    @Body() dto: UpdateBoothDto,
  ) {
    return this.booths.update(req.user, eventId, id, dto);
  }
}
