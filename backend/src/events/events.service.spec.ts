import { ForbiddenException } from '@nestjs/common';
import { EventRole, GlobalRole } from '@prisma/client';
import { AuthUser } from '../common/types/auth-request';
import { LocationsService } from '../locations/locations.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from './events.service';

describe('EventsService quick event user creation', () => {
  const manager: AuthUser = {
    sub: 'manager', companyId: 'company', email: 'manager@example.test', globalRole: GlobalRole.USER,
  };
  let prisma: any;
  let tx: any;
  let service: EventsService;

  beforeEach(() => {
    tx = {
      user: { create: jest.fn().mockResolvedValue({ id: 'new-user', name: 'New Worker', email: 'new@example.test', globalRole: GlobalRole.WORKER }) },
      eventUser: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      event: { findFirst: jest.fn().mockResolvedValue({ id: 'event' }) },
      eventUser: { findUnique: jest.fn().mockResolvedValue({ role: EventRole.EVENT_MANAGER }) },
      user: { findFirst: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (client: any) => Promise<unknown>) => callback(tx)),
    };
    service = new EventsService(prisma as PrismaService, {} as LocationsService);
  });

  it('creates an account and adds it to the event with the requested roles atomically', async () => {
    const result = await service.quickCreateEventUser(manager, 'event', {
      name: ' New Worker ', email: ' NEW@example.test ', password: 'Initial123!',
      globalRole: GlobalRole.WORKER, eventRole: EventRole.OPERATOR,
    });
    expect(result.id).toBe('new-user');
    expect(tx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        companyId: 'company', name: 'New Worker', email: 'new@example.test',
        globalRole: GlobalRole.WORKER, passwordHash: expect.any(String),
      }),
    }));
    expect(tx.eventUser.create).toHaveBeenCalledWith({
      data: { eventId: 'event', userId: 'new-user', role: EventRole.OPERATOR },
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('does not create accounts for non-managers', async () => {
    prisma.eventUser.findUnique.mockResolvedValue({ role: EventRole.OPERATOR });
    await expect(service.quickCreateEventUser(manager, 'event', {
      name: 'New Worker', email: 'new@example.test', password: 'Initial123!',
    })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a duplicate company email before creating an account', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'existing-user' });
    await expect(service.quickCreateEventUser(manager, 'event', {
      name: 'New Worker', email: 'new@example.test', password: 'Initial123!',
    })).rejects.toThrow('Ya existe un usuario');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
