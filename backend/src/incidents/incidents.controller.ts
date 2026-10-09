import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateIncidentCommentDto } from './dto/create-incident-comment.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentsService } from './incidents.service';

@ApiTags('incidents')
@ApiBearerAuth()
@Controller('events/:eventId/incidents')
@UseGuards(JwtAuthGuard)
export class IncidentsController {
  constructor(private readonly incidents: IncidentsService) {}

  @Get() list(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string) {
    return this.incidents.list(req.user, eventId);
  }

  @Get('assignees') assignees(@Req() req: AuthenticatedRequest, @Param('eventId') eventId: string) {
    return this.incidents.candidates(req.user, eventId);
  }

  @Post() create(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Body() dto: CreateIncidentDto,
  ) {
    return this.incidents.create(req.user, eventId, dto);
  }

  @Patch(':incidentId') update(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('incidentId') incidentId: string,
    @Body() dto: UpdateIncidentDto,
  ) {
    return this.incidents.update(req.user, eventId, incidentId, dto);
  }

  @Post(':incidentId/comments') comment(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('incidentId') incidentId: string,
    @Body() dto: CreateIncidentCommentDto,
  ) {
    return this.incidents.comment(req.user, eventId, incidentId, dto);
  }
}
