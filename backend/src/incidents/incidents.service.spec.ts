import { ForbiddenException } from '@nestjs/common';
import { EventRole, GlobalRole, IncidentKind, IncidentPriority, IncidentStatus, IncidentType } from '@prisma/client';
import { AuthUser } from '../common/types/auth-request';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentsService } from './incidents.service';

describe('IncidentsService', () => {
  const worker: AuthUser = { sub: 'worker', companyId: 'company', email: 'worker@example.test', globalRole: GlobalRole.WORKER };
  const manager: AuthUser = { ...worker, sub: 'manager', globalRole: GlobalRole.USER };
  let prisma: any;
  let tx: any;
  let events: any;
  let service: IncidentsService;

  beforeEach(() => {
    tx = {
      incident: { update: jest.fn().mockResolvedValue({ id: 'incident', status: IncidentStatus.IN_PROGRESS }) },
      incidentComment: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      location: { findFirst: jest.fn().mockResolvedValue({ id: 'bar' }) },
      incident: {
        create: jest.fn().mockResolvedValue({ id: 'incident' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'incident', status: IncidentStatus.OPEN, priority: IncidentPriority.NORMAL, assignedToUserId: null }),
      },
      eventUser: { findUnique: jest.fn().mockResolvedValue({ role: EventRole.EVENT_MANAGER }) },
      $transaction: jest.fn((callback: (client: any) => Promise<unknown>) => callback(tx)),
    };
    events = { assertAccess: jest.fn().mockResolvedValue({ id: 'event' }) };
    service = new IncidentsService(prisma as PrismaService, events as EventsService);
  });

  it('lets event members create location-specific notices and incidents', async () => {
    const result = await service.create(worker, 'event', {
      kind: IncidentKind.INCIDENT, type: IncidentType.STOCK, priority: IncidentPriority.HIGH,
      title: '  Falta stock  ', description: '  Revisar almacén  ', locationId: 'bar',
    });
    expect(result.id).toBe('incident');
    expect(prisma.location.findFirst).toHaveBeenCalledWith({
      where: { id: 'bar', companyId: 'company', eventId: 'event', deletedAt: null },
    });
    expect(prisma.incident.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        companyId: 'company', eventId: 'event', createdByUserId: 'worker',
        title: 'Falta stock', description: 'Revisar almacén',
      }),
    }));
  });

  it('records a status transition in the incident timeline', async () => {
    await service.update(manager, 'event', 'incident', { status: IncidentStatus.IN_PROGRESS });
    expect(tx.incidentComment.create).toHaveBeenCalledWith({
      data: { incidentId: 'incident', userId: 'manager', message: 'Estado cambiado a En curso' },
    });
  });

  it('restricts assignment and status changes to managers', async () => {
    prisma.eventUser.findUnique.mockResolvedValue({ role: EventRole.OPERATOR });
    await expect(service.update(worker, 'event', 'incident', { status: IncidentStatus.RESOLVED }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.incident.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
