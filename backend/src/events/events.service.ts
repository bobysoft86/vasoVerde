import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  EventRole,
  EventStatus,
  GlobalRole,
  LocationUserRole,
  Prisma,
} from '@prisma/client';
import { balanceFor } from '../stock/stock-ledger';
import { PrismaService } from '../prisma/prisma.service';
import { LocationsService } from '../locations/locations.service';
import { AssignEventUserDto } from './dto/assign-event-user.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AuthUser } from '../common/types/auth-request';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService,
  ) {}
  private isAdmin(user: AuthUser) {
    return (
      user.globalRole === GlobalRole.ADMIN ||
      user.globalRole === GlobalRole.SUPER_ADMIN
    );
  }
  private datesAreValid(start?: string | Date, end?: string | Date) {
    return (
      !start || !end || new Date(end).getTime() >= new Date(start).getTime()
    );
  }
  list(user: AuthUser, status?: EventStatus, search?: string) {
    return this.prisma.event.findMany({
      where: {
        companyId: user.companyId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(this.isAdmin(user)
          ? {}
          : { users: { some: { userId: user.sub } } }),
        ...(search
          ? {
              OR: [
                { name: { contains: search } },
                { code: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        _count: { select: { booths: true, bars: true, users: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }
  async detail(user: AuthUser, eventId: string) {
    await this.assertAccess(user, eventId);
    return this.prisma.event.findFirstOrThrow({
      where: { id: eventId },
      include: {
        _count: { select: { booths: true, bars: true, users: true } },
        locations: { where: { type: 'EVENT_WAREHOUSE' } },
      },
    });
  }
  async create(user: AuthUser, dto: CreateEventDto) {
    if (!this.isAdmin(user))
      throw new ForbiddenException('Administrative permissions required');
    if (!this.datesAreValid(dto.startDate, dto.endDate))
      throw new BadRequestException('endDate must be after startDate');
    const code = dto.code.trim().toUpperCase();
    const exists = await this.prisma.event.findFirst({
      where: { companyId: user.companyId, code },
    });
    if (exists) throw new ConflictException('Event code already exists');
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          companyId: user.companyId,
          name: dto.name.trim(),
          code,
          description: dto.description,
          location: dto.location,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          status: dto.status ?? EventStatus.DRAFT,
        },
      });
      await this.locations.ensureEventWarehouse(event, tx);
      return event;
    });
  }
  async update(user: AuthUser, eventId: string, dto: UpdateEventDto) {
    await this.assertManager(user, eventId);
    return this.prisma.$transaction(async (tx) => {
    await this.lockEvent(tx, user.companyId, eventId);
    const current = await tx.event.findFirstOrThrow({
      where: { id: eventId, companyId: user.companyId },
    });
    const start = dto.startDate ?? current.startDate;
    const end = dto.endDate ?? current.endDate;
    if (!this.datesAreValid(start, end))
      throw new BadRequestException('endDate must be after startDate');
    const code = dto.code?.trim().toUpperCase();
    if (
      code &&
      code !== current.code &&
      (await tx.event.findFirst({
        where: { companyId: user.companyId, code, NOT: { id: eventId } },
      }))
    )
      throw new ConflictException('Event code already exists');
    if (dto.status === EventStatus.FINISHED || dto.status === EventStatus.ARCHIVED) {
      await this.requireClosure(tx, user.companyId, eventId);
    }
    const event = await tx.event.update({
      where: { id: eventId },
      data: {
        name: dto.name?.trim(),
        code,
        description: dto.description,
        location: dto.location,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        status: dto.status,
      },
    });
    await this.locations.ensureEventWarehouse(event, tx);
    return event;
    });
  }
  private async lockEvent(tx: Prisma.TransactionClient, companyId: string, eventId: string) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM Event WHERE id = ${eventId} AND companyId = ${companyId}
      AND deletedAt IS NULL FOR UPDATE
    `;
    if (!rows.length) throw new NotFoundException('Event not found');
  }

  private async closureChecklistFor(tx: Prisma.TransactionClient, companyId: string, eventId: string) {
    const [pendingLocations, openCashSessions, unsettledCashSessions, unsignedNotes, movements] = await Promise.all([
      tx.location.findMany({
        where: { companyId, eventId, active: true, deletedAt: null,
          type: { in: ['BAR', 'BOOTH'] }, closures: { none: { companyId, eventId } } },
        select: { id: true, name: true, type: true }, orderBy: { name: 'asc' },
      }),
      tx.cashSession.findMany({
        where: { companyId, eventId, status: 'OPEN' },
        select: { id: true, locationId: true, location: { select: { name: true } } },
      }),
      tx.cashSession.findMany({
        where: { companyId, eventId, status: 'CLOSED', settledAt: null },
        select: { id: true, locationId: true, location: { select: { name: true } }, closingAmount: true },
      }),
      tx.deliveryNote.findMany({
        where: { companyId, eventId, status: { notIn: ['SIGNED', 'CANCELLED'] } },
        select: { id: true, number: true, status: true },
      }),
      tx.stockMovement.findMany({
        where: { companyId, eventId, status: 'POSTED' },
        include: { items: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    ]);
    const locationIds = [...new Set(movements.flatMap((movement) =>
      [movement.sourceLocationId, movement.destinationLocationId].filter((id): id is string => !!id)))];
    const dirtyStock = locationIds.flatMap((locationId) =>
      [...balanceFor(movements, locationId).entries()]
        .filter(([key, quantity]) => key.endsWith(':DIRTY') && quantity > 0)
        .map(([key, quantity]) => ({ locationId, cupTypeId: key.slice(0, -6), quantity })),
    );
    const blockers = {
      pendingLocations: pendingLocations.length,
      openCashSessions: openCashSessions.length,
      unsettledCashSessions: unsettledCashSessions.length,
      unsignedNotes: unsignedNotes.length,
      dirtyStock: dirtyStock.reduce((sum, item) => sum + item.quantity, 0),
    };
    return { eventId, ready: Object.values(blockers).every((count) => count === 0),
      blockers, pendingLocations, openCashSessions, unsettledCashSessions, unsignedNotes, dirtyStock };
  }

  async closureChecklist(user: AuthUser, eventId: string) {
    const event = await this.assertAccess(user, eventId);
    const membership = this.isAdmin(user) ? null : await this.prisma.eventUser.findUnique({
      where: { eventId_userId: { eventId, userId: user.sub } },
    });
    return { ...await this.closureChecklistFor(this.prisma, user.companyId, eventId),
      status: event.status, canManage: this.isAdmin(user) || membership?.role === EventRole.EVENT_MANAGER };
  }

  private async requireClosure(tx: Prisma.TransactionClient, companyId: string, eventId: string) {
    const checklist = await this.closureChecklistFor(tx, companyId, eventId);
    if (!checklist.ready) throw new ConflictException({
      message: 'Resolve all event closure blockers before finishing or archiving', checklist,
    });
  }

  async finish(user: AuthUser, eventId: string) {
    await this.assertManager(user, eventId);
    return this.prisma.$transaction(async (tx) => {
      await this.lockEvent(tx, user.companyId, eventId);
      const event = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
      if (event.status === EventStatus.ARCHIVED || event.status === EventStatus.CANCELLED)
        throw new ConflictException('Archived or cancelled events cannot be finished');
      await this.requireClosure(tx, user.companyId, eventId);
      return tx.event.update({ where: { id: eventId }, data: { status: EventStatus.FINISHED } });
    });
  }
  private async event(companyId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, companyId, deletedAt: null },
    });
    if (!event) throw new NotFoundException('Event not found');
    return event;
  }
  async assertAccess(user: AuthUser, eventId: string) {
    const event = await this.event(user.companyId, eventId);
    if (this.isAdmin(user)) return event;
    const membership = await this.prisma.eventUser.findUnique({
      where: { eventId_userId: { eventId, userId: user.sub } },
    });
    if (!membership)
      throw new ForbiddenException('You do not have access to this event');
    return event;
  }
  async assertManager(user: AuthUser, eventId: string) {
    await this.event(user.companyId, eventId);
    if (this.isAdmin(user)) return;
    const membership = await this.prisma.eventUser.findUnique({
      where: { eventId_userId: { eventId, userId: user.sub } },
    });
    if (membership?.role !== EventRole.EVENT_MANAGER)
      throw new ForbiddenException('Event manager permissions required');
  }
  async listUsers(user: AuthUser, eventId: string) {
    await this.assertAccess(user, eventId);
    return this.prisma.eventUser.findMany({
      where: { eventId, user: { companyId: user.companyId } },
      select: {
        userId: true,
        role: true,
        assignedAt: true,
        user: { select: { id: true, name: true, email: true, active: true } },
      },
      orderBy: { assignedAt: 'asc' },
    });
  }
  async listUserCandidates(user: AuthUser, eventId: string) {
    await this.assertAccess(user, eventId);
    return this.prisma.user.findMany({
      where: { companyId: user.companyId, deletedAt: null, active: true },
      select: {
        id: true,
        name: true,
        email: true,
        active: true,
        globalRole: true,
      },
      orderBy: { name: 'asc' },
    });
  }
  async assign(user: AuthUser, eventId: string, dto: AssignEventUserDto) {
    await this.assertManager(user, eventId);
    const target = await this.prisma.user.findFirst({
      where: { id: dto.userId, companyId: user.companyId, deletedAt: null },
    });
    if (!target) throw new NotFoundException('User not found');
    const existing = await this.prisma.eventUser.findUnique({
      where: { eventId_userId: { eventId, userId: dto.userId } },
    });
    if (existing)
      throw new ConflictException('User is already assigned to this event');
    return this.prisma.eventUser.create({
      data: { eventId, userId: dto.userId, role: dto.role },
      select: { userId: true, role: true, assignedAt: true },
    });
  }
  async updateUser(
    user: AuthUser,
    eventId: string,
    userId: string,
    role: EventRole,
  ) {
    await this.assertManager(user, eventId);
    const membership = await this.prisma.eventUser.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!membership) throw new NotFoundException('Event assignment not found');
    return this.prisma.eventUser.update({
      where: { eventId_userId: { eventId, userId } },
      data: { role },
      select: { userId: true, role: true, assignedAt: true },
    });
  }
  async listLocationAssignments(
    user: AuthUser,
    eventId: string,
    locationId: string,
  ) {
    await this.eventsAccessForLocation(user, eventId, locationId);
    return this.prisma.locationUserAssignment.findMany({
      where: { eventId, locationId, active: true },
      select: {
        id: true,
        userId: true,
        role: true,
        assignedAt: true,
        user: {
          select: { id: true, name: true, email: true, globalRole: true },
        },
      },
      orderBy: { assignedAt: 'asc' },
    });
  }
  async assignLocationUser(
    user: AuthUser,
    eventId: string,
    locationId: string,
    dto: { userId: string; role: LocationUserRole },
  ) {
    await this.assertManager(user, eventId);
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        eventId,
        companyId: user.companyId,
        deletedAt: null,
        active: true,
      },
    });
    if (!location)
      throw new NotFoundException('Location not found for this event');
    const target = await this.prisma.user.findFirst({
      where: {
        id: dto.userId,
        companyId: user.companyId,
        active: true,
        deletedAt: null,
      },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.globalRole !== dto.role)
      throw new BadRequestException(`User must have global role ${dto.role}`);
    const eventRole =
      dto.role === LocationUserRole.RESPONSIBLE
        ? EventRole.EVENT_MANAGER
        : dto.role === LocationUserRole.CLIENT
          ? EventRole.VIEWER
          : EventRole.OPERATOR;
    await this.prisma.eventUser.upsert({
      where: { eventId_userId: { eventId, userId: target.id } },
      create: { eventId, userId: target.id, role: eventRole },
      update: {},
    });
    return this.prisma.locationUserAssignment.upsert({
      where: { locationId_userId: { locationId, userId: target.id } },
      create: {
        companyId: user.companyId,
        eventId,
        locationId,
        userId: target.id,
        role: dto.role,
      },
      update: { role: dto.role, active: true },
      select: {
        id: true,
        userId: true,
        role: true,
        assignedAt: true,
        user: {
          select: { id: true, name: true, email: true, globalRole: true },
        },
      },
    });
  }
  async removeLocationUser(
    user: AuthUser,
    eventId: string,
    locationId: string,
    userId: string,
  ) {
    await this.assertManager(user, eventId);
    const assignment = await this.prisma.locationUserAssignment.findFirst({
      where: { eventId, locationId, userId, active: true },
    });
    if (!assignment)
      throw new NotFoundException('Location assignment not found');
    await this.prisma.locationUserAssignment.update({
      where: { id: assignment.id },
      data: { active: false },
    });
    return { success: true };
  }
  private async eventsAccessForLocation(
    user: AuthUser,
    eventId: string,
    locationId: string,
  ) {
    await this.assertAccess(user, eventId);
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        eventId,
        companyId: user.companyId,
        deletedAt: null,
      },
    });
    if (!location)
      throw new NotFoundException('Location not found for this event');
    return location;
  }
  async removeUser(user: AuthUser, eventId: string, userId: string) {
    await this.assertManager(user, eventId);
    const membership = await this.prisma.eventUser.findUnique({
      where: { eventId_userId: { eventId, userId } },
    });
    if (!membership) throw new NotFoundException('Event assignment not found');
    await this.prisma.eventUser.delete({
      where: { eventId_userId: { eventId, userId } },
    });
    return { success: true };
  }
}
