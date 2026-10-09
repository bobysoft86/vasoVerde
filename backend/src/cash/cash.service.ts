import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
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
  StockMovementStatus,
} from '@prisma/client';
import { AuthUser } from '../common/types/auth-request';
import { EventsService } from '../events/events.service';
import { PrismaService } from '../prisma/prisma.service';
import { balanceFor } from '../stock/stock-ledger';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import { CloseCashSessionDto } from './dto/close-cash-session.dto';
import { OpenCashSessionDto } from './dto/open-cash-session.dto';
import { CreateCashTransferDto } from './dto/create-cash-transfer.dto';

@Injectable()
export class CashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}
  private admin(user: AuthUser) {
    return (
      user.globalRole === GlobalRole.ADMIN ||
      user.globalRole === GlobalRole.SUPER_ADMIN
    );
  }
  private async operator(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    eventId: string | null,
  ) {
    // All cash writers acquire locks in event -> location -> session order.
    if (eventId) {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM Event WHERE id = ${eventId} AND companyId = ${user.companyId} FOR UPDATE`,
      );
      const event = await tx.event.findFirst({
        where: { id: eventId, companyId: user.companyId, deletedAt: null },
      });
      if (!event) throw new NotFoundException('Event not found');
      if (
        (
          [
            EventStatus.FINISHED,
            EventStatus.ARCHIVED,
            EventStatus.CANCELLED,
          ] as EventStatus[]
        ).includes(event.status)
      )
        throw new BadRequestException(
          'This event no longer accepts cash operations',
        );
    } else if (!this.admin(user)) {
      throw new ForbiddenException(
        'Central cash requires administration permissions',
      );
    }
    if (this.admin(user)) return;
    if (!eventId)
      throw new ForbiddenException(
        'Central cash requires administration permissions',
      );
    const membership = await tx.eventUser.findUnique({
      where: { eventId_userId: { eventId, userId: user.sub } },
    });
    if (!membership)
      throw new ForbiddenException('Cash operation permissions required');
  }
  private async location(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    eventId: string | null,
    locationId: string,
  ) {
    const location = await tx.location.findFirst({
      where: {
        id: locationId,
        companyId: user.companyId,
        deletedAt: null,
        active: true,
        ...(eventId
          ? {
              OR: [
                { eventId },
                { eventId: null, type: LocationType.CENTRAL_WAREHOUSE },
              ],
            }
          : { eventId: null, type: LocationType.CENTRAL_WAREHOUSE }),
      },
    });
    if (!location)
      throw new BadRequestException('Location is not available for this event');
    if (
      !(
        [
          LocationType.CENTRAL_WAREHOUSE,
          LocationType.EVENT_WAREHOUSE,
          LocationType.BOOTH,
          LocationType.BAR,
        ] as LocationType[]
      ).includes(location.type)
    )
      throw new BadRequestException(
        'Cash is only available for warehouse, booth and bar locations',
      );
    if (!this.admin(user) && eventId) {
      const assignment = await tx.locationUserAssignment.findFirst({
        where: {
          companyId: user.companyId,
          eventId,
          locationId,
          userId: user.sub,
          active: true,
          role: { in: [LocationUserRole.WORKER, LocationUserRole.RESPONSIBLE] },
        },
      });
      if (!assignment)
        throw new ForbiddenException(
          'An active cash location assignment is required',
        );
    }
    return location;
  }
  private async lockLocations(tx: Prisma.TransactionClient, ids: string[]) {
    for (const id of [...new Set(ids)].sort())
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM Location WHERE id = ${id} FOR UPDATE`,
      );
  }
  private async sessions(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    eventId: string | null,
    ids: string[],
  ) {
    const where = { id: { in: ids }, companyId: user.companyId, eventId };
    const initial = await tx.cashSession.findMany({ where });
    if (initial.length !== ids.length)
      throw new NotFoundException('Cash session not found');
    await this.lockLocations(
      tx,
      initial.map((session) => session.locationId),
    );
    for (const id of [...ids].sort())
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM CashSession WHERE id = ${id} FOR UPDATE`,
      );
    const sessions = await tx.cashSession.findMany({
      where,
      include: { movements: true, location: true },
    });
    if (
      sessions.length !== ids.length ||
      sessions.some((session) => session.status !== CashSessionStatus.OPEN)
    )
      throw new BadRequestException('Cash boxes must exist and be open');
    for (const session of sessions)
      await this.location(tx, user, eventId, session.locationId);
    return sessions;
  }
  private async crossSessions(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    ids: string[],
  ) {
    const where = { id: { in: ids }, companyId: user.companyId };
    const initial = await tx.cashSession.findMany({ where });
    if (initial.length !== ids.length)
      throw new NotFoundException('Cash session not found');
    await this.lockLocations(
      tx,
      initial.map((session) => session.locationId),
    );
    for (const id of [...ids].sort())
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM CashSession WHERE id = ${id} FOR UPDATE`,
      );
    const sessions = await tx.cashSession.findMany({
      where,
      include: { movements: true, location: true },
    });
    if (sessions.some((session) => session.status !== CashSessionStatus.OPEN))
      throw new BadRequestException('Cash boxes must exist and be open');
    for (const session of sessions)
      await this.location(tx, user, session.eventId, session.locationId);
    return sessions;
  }
  private async assertNotClosed(
    tx: Prisma.TransactionClient,
    eventId: string | null,
    locationId: string,
  ) {
    if (
      eventId &&
      (await tx.locationClosure.findFirst({ where: { eventId, locationId } }))
    )
      throw new BadRequestException('This location is already closed');
  }
  private assertFunds(
    session: {
      openingAmount: Prisma.Decimal | number;
      movements: Array<{
        type: CashMovementType;
        amount: Prisma.Decimal | number;
      }>;
    },
    amount: number,
  ) {
    const available = this.expected(
      Number(session.openingAmount),
      session.movements,
    );
    if (Math.round(available * 100) < Math.round(amount * 100))
      throw new BadRequestException({
        message: 'Insufficient cash funds',
        available,
        requested: amount,
      });
  }
  private sign(type: CashMovementType) {
    return (
      [
        CashMovementType.REFUND,
        CashMovementType.CASH_OUT,
        CashMovementType.WITHDRAWAL,
        CashMovementType.EXPENSE,
        CashMovementType.FINAL_SETTLEMENT,
      ] as CashMovementType[]
    ).includes(type)
      ? -1
      : 1;
  }
  private expected(
    openingAmount: number,
    movements: Array<{
      type: CashMovementType;
      amount: Prisma.Decimal | number;
    }>,
  ) {
    return (
      openingAmount +
      movements
        .filter(
          (movement) =>
            !(
              [
                CashMovementType.INITIAL_CASH,
                CashMovementType.FINAL_SETTLEMENT,
              ] as CashMovementType[]
            ).includes(movement.type),
        )
        .reduce(
          (sum, movement) =>
            sum + this.sign(movement.type) * Number(movement.amount),
          0,
        )
    );
  }
  private async availableClean(
    tx: Prisma.TransactionClient,
    eventId: string,
    locationId: string,
    cupTypeId: string,
  ) {
    const location = await tx.location.findUniqueOrThrow({
      where: { id: locationId },
    });
    const movements = await tx.stockMovement.findMany({
      where: {
        companyId: location.companyId,
        ...(location.eventId === null ? {} : { eventId }),
        status: StockMovementStatus.POSTED,
        OR: [
          { sourceLocationId: locationId },
          { destinationLocationId: locationId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      select: {
        createdAt: true,
        sourceLocationId: true,
        destinationLocationId: true,
        type: true,
        items: {
          where: { cupTypeId },
          select: { cupTypeId: true, quantity: true, condition: true },
        },
      },
    });
    return Math.max(
      0,
      balanceFor(movements, locationId).get(
        `${cupTypeId}:${StockCondition.CLEAN}`,
      ) ?? 0,
    );
  }
  private async audit(
    user: AuthUser,
    eventId: string,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    await this.prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        eventId,
        userId: user.sub,
        action,
        entityType: 'CashSession',
        entityId,
        metadata,
      },
    });
  }
  private include() {
    return {
      location: true,
      openedBy: { select: { id: true, name: true, email: true } },
      closedBy: { select: { id: true, name: true, email: true } },
      movements: {
        orderBy: { createdAt: 'asc' as const },
        include: { createdBy: { select: { id: true, name: true } } },
      },
    };
  }

  async open(user: AuthUser, eventId: string | null, dto: OpenCashSessionDto) {
    const session = await this.prisma.$transaction(
      async (tx) => {
        await this.operator(tx, user, eventId);
        await this.lockLocations(tx, [dto.locationId]);
        const location = await this.location(tx, user, eventId, dto.locationId);
        await this.assertNotClosed(tx, eventId, location.id);
        const existing = await tx.cashSession.findFirst({
          where: {
            companyId: user.companyId,
            eventId,
            locationId: location.id,
            status: CashSessionStatus.OPEN,
          },
        });
        if (existing)
          throw new ConflictException(
            'There is already an open cash session for this location',
          );
        const created = await tx.cashSession.create({
          data: {
            companyId: user.companyId,
            eventId,
            locationId: location.id,
            openedByUserId: user.sub,
            openingAmount: dto.openingAmount,
            notes: dto.notes?.trim(),
            movements: {
              create: {
                companyId: user.companyId,
                eventId,
                locationId: location.id,
                createdByUserId: user.sub,
                type: CashMovementType.INITIAL_CASH,
                amount: dto.openingAmount,
                concept: 'Apertura y fondo para cambio',
                notes: dto.notes?.trim(),
              },
            },
          },
          include: this.include(),
        });
        await tx.auditLog.create({
          data: {
            companyId: user.companyId,
            eventId,
            userId: user.sub,
            action: 'CASH_SESSION_OPENED',
            entityType: 'CashSession',
            entityId: created.id,
            metadata: {
              locationId: location.id,
              openingAmount: dto.openingAmount,
            },
          },
        });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return this.view(session);
  }
  async list(
    user: AuthUser,
    eventId: string | null,
    status?: CashSessionStatus,
  ) {
    if (eventId) await this.events.assertAccess(user, eventId);
    const sessions = await this.prisma.cashSession.findMany({
      where: {
        companyId: user.companyId,
        eventId,
        ...(status ? { status } : {}),
      },
      orderBy: { openedAt: 'desc' },
      include: this.include(),
    });
    return sessions.map((session) => this.view(session));
  }
  async detail(user: AuthUser, eventId: string | null, id: string) {
    if (eventId) await this.events.assertAccess(user, eventId);
    const session = await this.prisma.cashSession.findFirst({
      where: { id, companyId: user.companyId, eventId },
      include: this.include(),
    });
    if (!session) throw new NotFoundException('Cash session not found');
    return this.view(session);
  }
  async transfer(
    user: AuthUser,
    eventId: string | null,
    dto: CreateCashTransferDto,
  ) {
    if (dto.originSessionId === dto.destinationSessionId)
      throw new BadRequestException(
        'Origin and destination cash boxes must be different',
      );
    const transfer = await this.prisma.$transaction(
      async (tx) => {
        await this.operator(tx, user, eventId);
        const sessions = await this.sessions(tx, user, eventId, [
          dto.originSessionId,
          dto.destinationSessionId,
        ]);
        const origin = sessions.find(
          (session) => session.id === dto.originSessionId,
        )!;
        const destination = sessions.find(
          (session) => session.id === dto.destinationSessionId,
        )!;
        for (const session of sessions)
          await this.assertNotClosed(tx, eventId, session.locationId);
        this.assertFunds(origin, dto.amount);
        const created = await tx.cashTransfer.create({
          data: {
            companyId: user.companyId,
            eventId,
            originSessionId: origin.id,
            destinationSessionId: destination.id,
            createdByUserId: user.sub,
            amount: dto.amount,
            concept: dto.concept.trim(),
            notes: dto.notes?.trim(),
            movements: {
              create: [
                {
                  companyId: user.companyId,
                  eventId,
                  locationId: origin.locationId,
                  cashSessionId: origin.id,
                  createdByUserId: user.sub,
                  type: CashMovementType.CASH_OUT,
                  amount: dto.amount,
                  concept: `Transferencia a ${destination.location.name}: ${dto.concept.trim()}`,
                  notes: dto.notes?.trim(),
                },
                {
                  companyId: user.companyId,
                  eventId,
                  locationId: destination.locationId,
                  cashSessionId: destination.id,
                  createdByUserId: user.sub,
                  type: CashMovementType.CASH_IN,
                  amount: dto.amount,
                  concept: `Transferencia desde ${origin.location.name}: ${dto.concept.trim()}`,
                  notes: dto.notes?.trim(),
                },
              ],
            },
          },
          include: { movements: true },
        });
        await tx.auditLog.create({
          data: {
            companyId: user.companyId,
            eventId,
            userId: user.sub,
            action: 'CASH_TRANSFER_CREATED',
            entityType: 'CashTransfer',
            entityId: created.id,
            metadata: {
              originSessionId: origin.id,
              destinationSessionId: destination.id,
              amount: dto.amount,
            },
          },
        });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return {
      ...transfer,
      amount: Number(transfer.amount),
      movements: transfer.movements.map((movement) => ({
        ...movement,
        amount: Number(movement.amount),
      })),
    };
  }
  async centralTransfer(user: AuthUser, dto: CreateCashTransferDto) {
    if (dto.originSessionId === dto.destinationSessionId)
      throw new BadRequestException(
        'Origin and destination cash boxes must be different',
      );
    const transfer = await this.prisma.$transaction(
      async (tx) => {
        await this.operator(tx, user, null);
        const sessions = await this.crossSessions(tx, user, [
          dto.originSessionId,
          dto.destinationSessionId,
        ]);
        const origin = sessions.find(
          (session) => session.id === dto.originSessionId,
        )!;
        const destination = sessions.find(
          (session) => session.id === dto.destinationSessionId,
        )!;
        if (!!origin.eventId === !!destination.eventId)
          throw new BadRequestException(
            'A central transfer must connect the nave and an event cash box',
          );
        await this.assertNotClosed(tx, origin.eventId, origin.locationId);
        await this.assertNotClosed(
          tx,
          destination.eventId,
          destination.locationId,
        );
        this.assertFunds(origin, dto.amount);
        const transferEventId = origin.eventId ?? destination.eventId;
        const created = await tx.cashTransfer.create({
          data: {
            companyId: user.companyId,
            eventId: transferEventId,
            originSessionId: origin.id,
            destinationSessionId: destination.id,
            createdByUserId: user.sub,
            amount: dto.amount,
            concept: dto.concept.trim(),
            notes: dto.notes?.trim(),
            movements: {
              create: [
                {
                  companyId: user.companyId,
                  eventId: origin.eventId,
                  locationId: origin.locationId,
                  cashSessionId: origin.id,
                  createdByUserId: user.sub,
                  type: CashMovementType.CASH_OUT,
                  amount: dto.amount,
                  concept: `Transferencia a ${destination.location.name}: ${dto.concept.trim()}`,
                  notes: dto.notes?.trim(),
                },
                {
                  companyId: user.companyId,
                  eventId: destination.eventId,
                  locationId: destination.locationId,
                  cashSessionId: destination.id,
                  createdByUserId: user.sub,
                  type: CashMovementType.CASH_IN,
                  amount: dto.amount,
                  concept: `Transferencia desde ${origin.location.name}: ${dto.concept.trim()}`,
                  notes: dto.notes?.trim(),
                },
              ],
            },
          },
          include: { movements: true },
        });
        await tx.auditLog.create({
          data: {
            companyId: user.companyId,
            eventId: transferEventId,
            userId: user.sub,
            action: 'CENTRAL_CASH_TRANSFER_CREATED',
            entityType: 'CashTransfer',
            entityId: created.id,
            metadata: {
              originSessionId: origin.id,
              destinationSessionId: destination.id,
              amount: dto.amount,
            },
          },
        });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return {
      ...transfer,
      amount: Number(transfer.amount),
      movements: transfer.movements.map((movement) => ({
        ...movement,
        amount: Number(movement.amount),
      })),
    };
  }
  async addMovement(
    user: AuthUser,
    eventId: string | null,
    id: string,
    dto: CreateCashMovementDto,
  ) {
    if (
      (
        [
          CashMovementType.INITIAL_CASH,
          CashMovementType.FINAL_SETTLEMENT,
        ] as CashMovementType[]
      ).includes(dto.type)
    )
      throw new BadRequestException(
        'Use the opening or closing operation for this movement type',
      );
    const isCupOperation =
      dto.type === CashMovementType.REFUND ||
      dto.type === CashMovementType.SALE;
    if (isCupOperation && !eventId)
      throw new BadRequestException(
        'Cup sales and refunds belong to an event cash box',
      );
    const operationEventId = eventId;
    if (isCupOperation && !operationEventId)
      throw new BadRequestException('Cup operations require an event');
    if (isCupOperation && (!dto.cupTypeId || !dto.cupQuantity))
      throw new BadRequestException(
        'A vessel type and quantity are required for a vessel operation',
      );
    if (!isCupOperation && (dto.cupTypeId || dto.cupQuantity))
      throw new BadRequestException(
        'Vessel details are only valid for a vessel refund',
      );

    await this.prisma.$transaction(
      async (tx) => {
        await this.operator(tx, user, eventId);
        const [session] = await this.sessions(tx, user, eventId, [id]);
        await this.assertNotClosed(tx, eventId, session.locationId);
        if (this.sign(dto.type) < 0) this.assertFunds(session, dto.amount);
        let stockMovementId: string | undefined;
        if (isCupOperation) {
          const cup = await tx.cupType.findFirst({
            where: {
              id: dto.cupTypeId,
              companyId: user.companyId,
              active: true,
              deletedAt: null,
            },
          });
          if (!cup)
            throw new BadRequestException('Vessel type not found or inactive');
          if (dto.type === CashMovementType.SALE) {
            const available = await this.availableClean(
              tx,
              operationEventId!,
              session.locationId,
              cup.id,
            );
            if (available < dto.cupQuantity!)
              throw new BadRequestException({
                message: 'Insufficient clean stock for this sale',
                cupTypeId: cup.id,
                condition: StockCondition.CLEAN,
                available,
                requested: dto.cupQuantity,
              });
          }
          const stockMovement = await tx.stockMovement.create({
            data: {
              companyId: user.companyId,
              eventId: operationEventId,
              ...(dto.type === CashMovementType.SALE
                ? { sourceLocationId: session.locationId }
                : { destinationLocationId: session.locationId }),
              createdByUserId: user.sub,
              type:
                dto.type === CashMovementType.SALE
                  ? StockMovementType.SALE
                  : StockMovementType.RETURN,
              status: StockMovementStatus.POSTED,
              notes: `${dto.type === CashMovementType.SALE ? 'Venta' : 'Devolución'} en caja: ${dto.concept.trim()}`,
              items: {
                create: {
                  cupTypeId: cup.id,
                  quantity: dto.cupQuantity!,
                  condition:
                    dto.type === CashMovementType.SALE
                      ? StockCondition.CLEAN
                      : StockCondition.DIRTY,
                },
              },
            },
          });
          stockMovementId = stockMovement.id;
        }
        const movement = await tx.cashMovement.create({
          data: {
            companyId: user.companyId,
            eventId: operationEventId,
            locationId: session.locationId,
            cashSessionId: session.id,
            stockMovementId,
            createdByUserId: user.sub,
            type: dto.type,
            amount: dto.amount,
            concept: dto.concept.trim(),
            notes: dto.notes?.trim(),
          },
        });
        await tx.auditLog.create({
          data: {
            companyId: user.companyId,
            eventId: operationEventId,
            userId: user.sub,
            action: 'CASH_MOVEMENT_CREATED',
            entityType: 'CashSession',
            entityId: session.id,
            metadata: {
              type: dto.type,
              amount: dto.amount,
              movementId: movement.id,
              stockMovementId,
              cupTypeId: dto.cupTypeId,
              cupQuantity: dto.cupQuantity,
            },
          },
        });
        return movement;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return this.detail(user, eventId, id);
  }
  async close(
    user: AuthUser,
    eventId: string | null,
    id: string,
    dto: CloseCashSessionDto,
  ) {
    const closed = await this.prisma.$transaction(
      async (tx) => {
        await this.operator(tx, user, eventId);
        const [session] = await this.sessions(tx, user, eventId, [id]);
        const expected = this.expected(
          Number(session.openingAmount),
          session.movements,
        );
        const difference = dto.closingAmount - expected;
        const updated = await tx.cashSession.update({
          where: { id },
          data: {
            status: CashSessionStatus.CLOSED,
            closedAt: new Date(),
            closedByUserId: user.sub,
            closingAmount: dto.closingAmount,
            difference,
            notes: dto.notes?.trim(),
          },
        });
        await tx.cashMovement.create({
          data: {
            companyId: user.companyId,
            eventId,
            locationId: session.locationId,
            cashSessionId: id,
            createdByUserId: user.sub,
            type: CashMovementType.FINAL_SETTLEMENT,
            amount: dto.closingAmount,
            concept: 'Cierre y arqueo de caja',
            notes: dto.notes?.trim(),
          },
        });
        await tx.auditLog.create({
          data: {
            companyId: user.companyId,
            eventId,
            userId: user.sub,
            action: 'CASH_SESSION_CLOSED',
            entityType: 'CashSession',
            entityId: id,
            metadata: {
              expected,
              closingAmount: dto.closingAmount,
              difference,
            },
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return this.detail(user, eventId, closed.id);
  }
  private view(
    session: Prisma.CashSessionGetPayload<{
      include: ReturnType<CashService['include']>;
    }>,
  ) {
    const expected = this.expected(
      Number(session.openingAmount),
      session.movements,
    );
    return {
      ...session,
      openingAmount: Number(session.openingAmount),
      expectedAmount: expected,
      closingAmount:
        session.closingAmount === null ? null : Number(session.closingAmount),
      difference:
        session.difference === null ? null : Number(session.difference),
      movements: session.movements.map((movement) => ({
        ...movement,
        amount: Number(movement.amount),
        signedAmount: this.sign(movement.type) * Number(movement.amount),
      })),
    };
  }
}
