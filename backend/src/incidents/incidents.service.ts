import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventRole, GlobalRole, IncidentStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../common/types/auth-request';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIncidentCommentDto } from './dto/create-incident-comment.dto';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsService) {}

  private isAdmin(user: AuthUser) {
    return user.globalRole === GlobalRole.ADMIN || user.globalRole === GlobalRole.SUPER_ADMIN;
  }

  private async assertManager(user: AuthUser, eventId: string) {
    if (this.isAdmin(user)) return;
    const membership = await this.prisma.eventUser.findUnique({
      where: { eventId_userId: { eventId, userId: user.sub } },
      select: { role: true },
    });
    if (membership?.role !== EventRole.EVENT_MANAGER)
      throw new ForbiddenException('Event manager permissions required');
  }

  private readonly include = {
    createdBy: { select: { id: true, name: true } },
    assignedTo: { select: { id: true, name: true } },
    location: { select: { id: true, name: true, type: true } },
    comments: {
      orderBy: { createdAt: Prisma.SortOrder.asc },
      include: { user: { select: { id: true, name: true } } },
    },
  } satisfies Prisma.IncidentInclude;

  async list(user: AuthUser, eventId: string) {
    await this.events.assertAccess(user, eventId);
    return this.prisma.incident.findMany({
      where: { companyId: user.companyId, eventId },
      include: this.include,
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(user: AuthUser, eventId: string, dto: CreateIncidentDto) {
    await this.events.assertAccess(user, eventId);
    if (dto.locationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: dto.locationId, companyId: user.companyId, eventId, deletedAt: null },
      });
      if (!location) throw new NotFoundException('Location not found in this event');
    }
    return this.prisma.incident.create({
      data: {
        companyId: user.companyId,
        eventId,
        locationId: dto.locationId,
        createdByUserId: user.sub,
        kind: dto.kind,
        type: dto.type,
        priority: dto.priority,
        title: dto.title.trim(),
        description: dto.description?.trim(),
      },
      include: this.include,
    });
  }

  async update(user: AuthUser, eventId: string, incidentId: string, dto: UpdateIncidentDto) {
    await this.assertManager(user, eventId);
    const current = await this.prisma.incident.findFirst({
      where: { id: incidentId, eventId, companyId: user.companyId },
    });
    if (!current) throw new NotFoundException('Incident not found');
    if (dto.assignedToUserId) {
      const member = await this.prisma.eventUser.findUnique({
        where: { eventId_userId: { eventId, userId: dto.assignedToUserId } },
      });
      if (!member) throw new NotFoundException('Assignee is not a member of this event');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.incident.update({
        where: { id: incidentId },
        data: {
          status: dto.status,
          priority: dto.priority,
          assignedToUserId: dto.assignedToUserId === '' ? null : dto.assignedToUserId,
        },
        include: this.include,
      });
      const changes = [];
      if (dto.status && dto.status !== current.status)
        changes.push(`Estado cambiado a ${this.statusLabel(dto.status)}`);
      if (dto.priority && dto.priority !== current.priority)
        changes.push(`Prioridad cambiada a ${this.priorityLabel(dto.priority)}`);
      if (dto.assignedToUserId !== undefined && dto.assignedToUserId !== current.assignedToUserId)
        changes.push(dto.assignedToUserId ? 'Responsable asignado' : 'Responsable retirado');
      if (changes.length)
        await tx.incidentComment.create({
          data: { incidentId, userId: user.sub, message: changes.join(' · ') },
        });
      return updated;
    });
    return result;
  }

  async comment(user: AuthUser, eventId: string, incidentId: string, dto: CreateIncidentCommentDto) {
    await this.events.assertAccess(user, eventId);
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, eventId, companyId: user.companyId },
      select: { id: true, status: true },
    });
    if (!incident) throw new NotFoundException('Incident not found');
    if (incident.status === IncidentStatus.CANCELLED)
      throw new ForbiddenException('Cancelled items cannot be updated');
    return this.prisma.incidentComment.create({
      data: { incidentId, userId: user.sub, message: dto.message.trim() },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  async candidates(user: AuthUser, eventId: string) {
    await this.assertManager(user, eventId);
    return this.prisma.eventUser.findMany({
      where: { eventId, user: { active: true, deletedAt: null } },
      select: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: 'asc' } },
    }).then((rows) => rows.map((row) => row.user));
  }

  private statusLabel(status: IncidentStatus) {
    return ({ OPEN: 'Abierta', IN_PROGRESS: 'En curso', RESOLVED: 'Resuelta', CANCELLED: 'Cancelada' })[status];
  }

  private priorityLabel(priority: string) {
    return ({ NORMAL: 'Normal', HIGH: 'Alta', URGENT: 'Urgente' } as Record<string, string>)[priority] ?? priority;
  }
}
