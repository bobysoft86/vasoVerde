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
import { CashSessionStatus } from '@prisma/client';
import { EventAccessGuard } from '../common/guards/event-access.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { CashService } from './cash.service';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';
import { CreateCashTransferDto } from './dto/create-cash-transfer.dto';
import { ConfirmBarSettlementDto } from './dto/confirm-bar-settlement.dto';

@ApiTags('cash')
@ApiBearerAuth()
@Controller('events/:eventId/cash')
@UseGuards(JwtAuthGuard, EventAccessGuard)
export class CashController {
  constructor(private readonly cash: CashService) {}
  @Post('sessions') open(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Body() dto: OpenCashSessionDto,
  ) {
    return this.cash.open(req.user, eventId, dto);
  }
  @Get('sessions') list(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Query('status') status?: CashSessionStatus,
  ) {
    return this.cash.list(req.user, eventId, status);
  }
  @Get('sessions/:id') detail(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('id') id: string,
  ) {
    return this.cash.detail(req.user, eventId, id);
  }
  @Post('transfers') transfer(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Body() dto: CreateCashTransferDto,
  ) {
    return this.cash.transfer(req.user, eventId, dto);
  }
  @Get('bar-settlements/preview/:locationId') settlementPreview(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.cash.barSettlementPreview(req.user, eventId, locationId);
  }
  @Post('bar-settlements') settleBar(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Body() dto: ConfirmBarSettlementDto,
  ) {
    return this.cash.settleBar(req.user, eventId, dto);
  }
  @Post('sessions/:id/movements') addMovement(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: CreateCashMovementDto,
  ) {
    return this.cash.addMovement(req.user, eventId, id, dto);
  }
  @Post('sessions/:id/close') close(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: CloseCashSessionDto,
  ) {
    return this.cash.close(req.user, eventId, id, dto);
  }
}

@ApiTags('central-cash')
@ApiBearerAuth()
@Controller('warehouse/cash')
@UseGuards(JwtAuthGuard)
export class CentralCashController {
  constructor(private readonly cash: CashService) {}

  @Post('sessions') open(
    @Req() req: AuthenticatedRequest,
    @Body() dto: OpenCashSessionDto,
  ) {
    return this.cash.open(req.user, null, dto);
  }

  @Get('sessions') list(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: CashSessionStatus,
  ) {
    return this.cash.list(req.user, null, status);
  }

  @Get('sessions/:id') detail(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.cash.detail(req.user, null, id);
  }

  @Post('sessions/:id/movements') addMovement(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CreateCashMovementDto,
  ) {
    return this.cash.addMovement(req.user, null, id, dto);
  }

  @Post('sessions/:id/close') close(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CloseCashSessionDto,
  ) {
    return this.cash.close(req.user, null, id, dto);
  }

  @Post('transfers') transfer(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCashTransferDto,
  ) {
    return this.cash.centralTransfer(req.user, dto);
  }

  @Post('settlements') settle(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCashTransferDto,
  ) {
    return this.cash.settleToCentral(req.user, dto);
  }
}
