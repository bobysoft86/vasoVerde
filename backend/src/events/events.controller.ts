import {
  Body,
  Controller,
  Delete,
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
import { EventAccessGuard } from '../common/guards/event-access.guard';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { EventsService } from './events.service';
import { AssignEventUserDto } from './dto/assign-event-user.dto';
import { AssignLocationUserDto } from './dto/assign-location-user.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventStatus } from '@prisma/client';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}
  @Get(':eventId/closure-checklist') closureChecklist(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
  ) {
    return this.events.closureChecklist(req.user, eventId);
  }
  @Post(':eventId/finish') finish(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
  ) {
    return this.events.finish(req.user, eventId);
  }
  @Get() list(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: EventStatus,
    @Query('search') search?: string,
  ) {
    return this.events.list(req.user, status, search);
  }
  @Get(':eventId') detail(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
  ) {
    return this.events.detail(req.user, eventId);
  }
  @Post() create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateEventDto,
  ) {
    return this.events.create(req.user, dto);
  }
  @Patch(':eventId') updateEvent(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.events.update(req.user, eventId, dto);
  }
  @Get(':eventId/users') @UseGuards(EventAccessGuard) users(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
  ) {
    return this.events.listUsers(req.user, eventId);
  }
  @Get(':eventId/user-candidates') @UseGuards(EventAccessGuard) userCandidates(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
  ) {
    return this.events.listUserCandidates(req.user, eventId);
  }
  @Post(':eventId/users') @UseGuards(EventAccessGuard) assign(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Body() dto: AssignEventUserDto,
  ) {
    return this.events.assign(req.user, eventId, dto);
  }
  @Patch(':eventId/users/:userId') @UseGuards(EventAccessGuard) update(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Body() dto: AssignEventUserDto,
  ) {
    return this.events.updateUser(req.user, eventId, userId, dto.role);
  }
  @Delete(':eventId/users/:userId') @UseGuards(EventAccessGuard) remove(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
  ) {
    return this.events.removeUser(req.user, eventId, userId);
  }
  @Get(':eventId/locations/:locationId/assignments')
  @UseGuards(EventAccessGuard)
  locationAssignments(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.events.listLocationAssignments(req.user, eventId, locationId);
  }
  @Post(':eventId/locations/:locationId/assignments')
  @UseGuards(EventAccessGuard)
  assignLocation(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('locationId') locationId: string,
    @Body() dto: AssignLocationUserDto,
  ) {
    return this.events.assignLocationUser(req.user, eventId, locationId, dto);
  }
  @Delete(':eventId/locations/:locationId/assignments/:userId')
  @UseGuards(EventAccessGuard)
  removeLocation(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('locationId') locationId: string,
    @Param('userId') userId: string,
  ) {
    return this.events.removeLocationUser(
      req.user,
      eventId,
      locationId,
      userId,
    );
  }
}
