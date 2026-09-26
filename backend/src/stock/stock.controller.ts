import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StockMovementType } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EventAccessGuard } from '../common/guards/event-access.guard';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { CloseLocationDto } from './dto/close-location.dto';
import { StockService } from './stock.service';

@ApiTags('stock')
@ApiBearerAuth()
@Controller('events/:eventId')
@UseGuards(JwtAuthGuard, EventAccessGuard)
export class StockController {
  constructor(private readonly stock: StockService) {}
  @Get('operational-locations') operationalLocations(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string) {
    return this.stock.operationalLocations(req.user,eventId);
  }
  @Get('locations') locations(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
  ) {
    return this.stock.locations(req.user, eventId);
  }
  @Get('stock') eventStock(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Query('includeLocations') includeLocations?: string,
  ) {
    return this.stock.eventStock(
      req.user,
      eventId,
      includeLocations === 'true',
    );
  }
  @Get('locations/:locationId/stock') locationStock(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.stock.stockAtLocation(req.user, eventId, locationId);
  }
  @Get('stock-movements') list(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Query('type') type?: StockMovementType,
    @Query('sourceLocationId') sourceLocationId?: string,
    @Query('destinationLocationId') destinationLocationId?: string,
    @Query('cupTypeId') cupTypeId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.stock.list(req.user, eventId, {
      type,
      sourceLocationId,
      destinationLocationId,
      cupTypeId,
      dateFrom,
      dateTo,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }
  @Get('stock-movements/:movementId') detail(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('movementId') movementId: string,
  ) {
    return this.stock.detail(req.user, eventId, movementId);
  }
  @Post('stock-movements') create(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Body() dto: CreateStockMovementDto,
  ) {
    return this.stock.create(req.user, eventId, dto);
  }
  @Post('locations/:locationId/close') closeLocation(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('locationId') locationId: string,
    @Body() dto: CloseLocationDto,
  ) {
    return this.stock.closeLocation(req.user, eventId, locationId, dto);
  }
}
