import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { EventAccessGuard } from '../common/guards/event-access.guard';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}
  @Get('dashboard') global(@Req() req: AuthenticatedRequest) {
    return this.dashboard.global(req.user);
  }
  @Get('events/:eventId/dashboard') event(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.dashboard.event(req.user, eventId, query);
  }
  @Get('events/:eventId/alerts') @UseGuards(EventAccessGuard) alerts(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
  ) {
    return this.dashboard.alerts(req.user, eventId);
  }
  @Get('events/:eventId/reports/stock') @UseGuards(EventAccessGuard) stock(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.dashboard.reportStock(req.user, eventId, query);
  }
  @Get('events/:eventId/reports/stock.csv')
  @UseGuards(EventAccessGuard)
  async stockCsv(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Query() query: Record<string, string | undefined>,
    @Res() response: Response,
  ) {
    const csv = await this.dashboard.csvStock(req.user, eventId, query);
    response
      .set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="stock-report.csv"',
      })
      .send(csv);
  }
  @Get('events/:eventId/reports/stock-movements')
  @UseGuards(EventAccessGuard)
  movements(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.dashboard.reportMovements(req.user, eventId, query);
  }
  @Get('events/:eventId/reports/cash') @UseGuards(EventAccessGuard) cash(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.dashboard.reportCash(req.user, eventId, query);
  }
  @Get('events/:eventId/reports/cash.csv')
  @UseGuards(EventAccessGuard)
  async cashCsv(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Query() query: Record<string, string | undefined>,
    @Res() response: Response,
  ) {
    const csv = await this.dashboard.csvCash(req.user, eventId, query);
    response
      .set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="cash-report.csv"',
      })
      .send(csv);
  }
  @Get('events/:eventId/reports/delivery-notes')
  @UseGuards(EventAccessGuard)
  reportsNotes(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
  ) {
    return this.dashboard.reportDeliveryNotes(req.user, eventId);
  }
}
