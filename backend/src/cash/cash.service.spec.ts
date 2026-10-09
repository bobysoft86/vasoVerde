import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  CashMovementType,
  CashSessionStatus,
  EventStatus,
  GlobalRole,
  LocationType,
  LocationUserRole,
  Prisma,
  StockCondition,
  StockMovementType,
} from '@prisma/client';
import { CashService } from './cash.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { AuthUser } from '../common/types/auth-request';

describe('CashService transaction invariants', () => {
  const user: AuthUser = {
    sub: 'user',
    companyId: 'company',
    email: 'u@example.test',
    globalRole: GlobalRole.ADMIN,
  };
  const location = {
    id: 'loc-z',
    companyId: 'company',
    eventId: 'event',
    type: LocationType.BOOTH,
    name: 'Box',
  };
  const session = {
    id: 'session-z',
    locationId: location.id,
    location,
    status: CashSessionStatus.OPEN,
    openingAmount: 10,
    closingAmount: null,
    difference: null,
    movements: [] as Array<{ type: CashMovementType; amount: number }>,
  };
  const movement = {
    type: CashMovementType.EXPENSE,
    amount: 5,
    concept: 'Expense',
  };
  let tx: any;
  let prisma: any;
  let service: CashService;
  let locks: string[];
  beforeEach(() => {
    locks = [];
    tx = {
      $queryRaw: jest.fn((sql: Prisma.Sql) => {
        locks.push(`${sql.sql}:${sql.values[0]}`);
        return Promise.resolve([]);
      }),
      event: {
        findFirst: jest.fn().mockResolvedValue({ status: EventStatus.ACTIVE }),
      },
      eventUser: {
        findUnique: jest.fn().mockResolvedValue({ role: 'VIEWER' }),
      },
      location: {
        findFirst: jest.fn().mockResolvedValue(location),
        findUniqueOrThrow: jest.fn().mockResolvedValue(location),
      },
      locationUserAssignment: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ role: LocationUserRole.WORKER }),
      },
      locationClosure: { findFirst: jest.fn().mockResolvedValue(null) },
      cashSession: {
        findMany: jest.fn().mockResolvedValue([session]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue(session),
        update: jest.fn().mockResolvedValue(session),
      },
      cashMovement: { create: jest.fn().mockResolvedValue({ id: 'movement' }) },
      cashTransfer: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'transfer', amount: 5, movements: [] }),
      },
      cupType: { findFirst: jest.fn().mockResolvedValue({ id: 'cup' }) },
      stockMovement: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'stock' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    prisma = {
      $transaction: jest.fn(
        async (fn: (client: Prisma.TransactionClient) => Promise<unknown>) =>
          fn(tx),
      ),
      cashSession: { findFirst: jest.fn().mockResolvedValue(session) },
    };
    service = new CashService(
      prisma as PrismaService,
      { assertAccess: jest.fn() } as unknown as EventsService,
    );
  });

  it('checks duplicate opening only after locking the location inside the transaction', async () => {
    tx.cashSession.findFirst.mockImplementation(() => {
      expect(locks.some((lock) => lock.includes('Location'))).toBe(true);
      return session;
    });
    await expect(
      service.open(user, 'event', {
        locationId: location.id,
        openingAmount: 0,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.cashSession.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });
  });

  it('does not create event cash from an invented opening balance', async () => {
    await expect(
      service.open(user, 'event', { locationId: location.id, openingAmount: 10 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['close', 'movement', 'transfer'])(
    'rejects a session closed while %s waits for locks',
    async (operation) => {
      const other = { ...session, id: 'session-a', locationId: 'loc-a' };
      const initial = operation === 'transfer' ? [session, other] : [session];
      tx.cashSession.findMany
        .mockResolvedValueOnce(initial)
        .mockImplementation(() => {
          expect(locks.some((lock) => lock.includes('CashSession'))).toBe(true);
          return initial.map((value) => ({
            ...value,
            status: CashSessionStatus.CLOSED,
          }));
        });
      const result =
        operation === 'close'
          ? service.close(user, 'event', session.id, { closingAmount: 10 })
          : operation === 'movement'
            ? service.addMovement(user, 'event', session.id, movement)
            : service.transfer(user, 'event', {
                originSessionId: session.id,
                destinationSessionId: other.id,
                amount: 5,
                concept: 'Transfer',
              });
      await expect(result).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.cashSession.update).not.toHaveBeenCalled();
      expect(tx.cashMovement.create).not.toHaveBeenCalled();
      expect(tx.cashTransfer.create).not.toHaveBeenCalled();
    },
  );

  it('locks transfer locations and sessions in sorted order regardless of direction', async () => {
    const other = { ...session, id: 'session-a', locationId: 'loc-a' };
    tx.cashSession.findMany.mockResolvedValue([session, other]);
    for (const [origin, destination] of [
      [session, other],
      [other, session],
    ]) {
      locks.length = 0;
      await service.transfer(user, 'event', {
        originSessionId: origin.id,
        destinationSessionId: destination.id,
        amount: 5,
        concept: 'Transfer',
      });
      expect(locks.map((lock) => lock.split(':').at(-1))).toEqual([
        'event',
        'loc-a',
        'loc-z',
        'session-a',
        'session-z',
      ]);
    }
  });

  it('uses movements read after the lock to calculate closing difference', async () => {
    tx.cashSession.findMany
      .mockResolvedValueOnce([session])
      .mockResolvedValueOnce([
        {
          ...session,
          movements: [{ type: CashMovementType.CASH_IN, amount: 7 }],
        },
      ]);
    await service.close(user, 'event', session.id, { closingAmount: 15 });
    expect(tx.cashSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ difference: -2 }),
      }),
    );
  });

  it.each([
    CashMovementType.CASH_OUT,
    CashMovementType.WITHDRAWAL,
    CashMovementType.EXPENSE,
    CashMovementType.REFUND,
  ])('rejects unfunded %s before cash or stock writes', async (type) => {
    await expect(
      service.addMovement(user, 'event', session.id, {
        ...movement,
        type,
        amount: 11,
        ...(type === CashMovementType.REFUND
          ? { cupTypeId: 'cup', cupQuantity: 1 }
          : {}),
      }),
    ).rejects.toThrow('Insufficient cash funds');
    expect(tx.cashMovement.create).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('rejects a transfer using the balance re-read after locking', async () => {
    const other = { ...session, id: 'session-a', locationId: 'loc-a' };
    tx.cashSession.findMany
      .mockResolvedValueOnce([session, other])
      .mockResolvedValueOnce([
        {
          ...session,
          movements: [{ type: CashMovementType.EXPENSE, amount: 8 }],
        },
        other,
      ]);
    await expect(
      service.transfer(user, 'event', {
        originSessionId: session.id,
        destinationSessionId: other.id,
        amount: 5,
        concept: 'Transfer',
      }),
    ).rejects.toThrow('Insufficient cash funds');
    expect(tx.cashTransfer.create).not.toHaveBeenCalled();
  });

  it.each([EventStatus.FINISHED, EventStatus.ARCHIVED, EventStatus.CANCELLED])(
    'rejects writes to %s events even for admins',
    async (status) => {
      tx.event.findFirst.mockResolvedValue({ status });
      await expect(
        service.open(user, 'event', {
          locationId: location.id,
          openingAmount: 0,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.cashSession.create).not.toHaveBeenCalled();
    },
  );

  it('requires event membership even with an active location assignment', async () => {
    tx.eventUser.findUnique.mockResolvedValue(null);
    await expect(
      service.open({ ...user, globalRole: GlobalRole.WORKER }, 'event', {
        locationId: location.id,
        openingAmount: 0,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('requires an active worker/responsible assignment for non-admins', async () => {
    tx.locationUserAssignment.findFirst.mockResolvedValue(null);
    await expect(
      service.addMovement(
        { ...user, globalRole: GlobalRole.RESPONSIBLE },
        'event',
        session.id,
        movement,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.locationUserAssignment.findFirst).toHaveBeenCalledWith({
      where: {
        companyId: user.companyId,
        eventId: 'event',
        locationId: location.id,
        userId: user.sub,
        active: true,
        role: { in: [LocationUserRole.WORKER, LocationUserRole.RESPONSIBLE] },
      },
    });
  });

  it('allows an assigned worker with event membership and an exactly funded expense', async () => {
    await service.addMovement(
      { ...user, globalRole: GlobalRole.WORKER },
      'event',
      session.id,
      { ...movement, amount: 10 },
    );
    expect(tx.cashMovement.create).toHaveBeenCalledTimes(1);
  });

  it('checks assignments on both transfer endpoints', async () => {
    tx.cashSession.findMany.mockResolvedValue([
      session,
      { ...session, id: 'other', locationId: 'other-location' },
    ]);
    tx.locationUserAssignment.findFirst
      .mockResolvedValueOnce({ role: LocationUserRole.WORKER })
      .mockResolvedValueOnce(null);
    await expect(
      service.transfer({ ...user, globalRole: GlobalRole.WORKER }, 'event', {
        originSessionId: session.id,
        destinationSessionId: 'other',
        amount: 1,
        concept: 'Transfer',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.cashTransfer.create).not.toHaveBeenCalled();
  });

  it.each([null, 'event'])(
    'uses shared cleaning semantics and the correct history scope for location event %s',
    async (locationEventId) => {
      tx.location.findUniqueOrThrow.mockResolvedValue({
        ...location,
        eventId: locationEventId,
      });
      tx.stockMovement.findMany.mockResolvedValue([
        {
          sourceLocationId: null,
          destinationLocationId: location.id,
          type: StockMovementType.RETURN,
          createdAt: new Date(1),
          items: [
            { cupTypeId: 'cup', quantity: 5, condition: StockCondition.CLEAN },
          ],
        },
        {
          sourceLocationId: location.id,
          destinationLocationId: 'elsewhere',
          type: StockMovementType.CLEANING_RETURN,
          createdAt: new Date(2),
          items: [
            { cupTypeId: 'cup', quantity: 5, condition: StockCondition.CLEAN },
          ],
        },
      ]);
      await service.addMovement(user, 'event', session.id, {
        type: CashMovementType.SALE,
        amount: 1,
        concept: 'Sale',
        cupTypeId: 'cup',
        cupQuantity: 5,
      });
      const query = tx.stockMovement.findMany.mock.calls[0][0];
      expect(query.where.companyId).toBe(user.companyId);
      if (locationEventId === null)
        expect(query.where).not.toHaveProperty('eventId');
      else expect(query.where.eventId).toBe('event');
      expect(query.select.createdAt).toBe(true);
      expect(query.select.items.select.cupTypeId).toBe(true);
      expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
    },
  );

  it('rejects insufficient stock before recording either side of a sale', async () => {
    await expect(
      service.addMovement(user, 'event', session.id, {
        type: CashMovementType.SALE,
        amount: 1,
        concept: 'Sale',
        cupTypeId: 'cup',
        cupQuantity: 1,
      }),
    ).rejects.toThrow('Insufficient clean stock for this sale');
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.cashMovement.create).not.toHaveBeenCalled();
  });
  it.each([CashMovementType.SALE, CashMovementType.REFUND])('rejects foreign editions in cash %s', async (type) => {
    tx.cupType.findFirst.mockResolvedValue({ id: 'cup', ownerEventId: 'other-event' });
    await expect(service.addMovement(user, 'event', session.id, {
      type, amount: 1, concept: 'Cup', cupTypeId: 'cup', cupQuantity: 1,
    })).rejects.toThrow('otro evento');
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
    expect(tx.cashMovement.create).not.toHaveBeenCalled();
  });
});
