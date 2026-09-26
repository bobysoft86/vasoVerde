import { balanceFor } from '../stock/stock-ledger';
import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  CashMovementType,
  DeliveryNoteStatus,
  EventRole,
  EventStatus,
  GlobalRole,
  IncidentStatus,
  StockCondition,
  StockMovementType,
} from '@prisma/client';
import { EventsService } from '../events/events.service';
import { AuthUser } from '../common/types/auth-request';
import { PrismaService } from '../prisma/prisma.service';

type Balance = Map<string, number>;
type Movement = {
  id: string;
  sourceLocationId: string | null;
  destinationLocationId: string | null;
  type: StockMovementType;
  createdAt: Date;
  notes: string | null;
  createdBy: { name: string };
  items: Array<{
    cupTypeId: string;
    quantity: number;
    condition: StockCondition;
    cupType: { id: string; name: string; code: string };
  }>;
};

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
  ) {}

  private isAdmin(user: AuthUser) {
    return (
      user.globalRole === GlobalRole.ADMIN ||
      user.globalRole === GlobalRole.SUPER_ADMIN
    );
  }
  private async assertFinancialAccess(user: AuthUser, eventId?: string) {
    if (this.isAdmin(user)) return;
    if (!eventId)
      throw new ForbiddenException('Financial dashboard permissions required');
    const membership = await this.prisma.eventUser.findUnique({
      where: { eventId_userId: { eventId, userId: user.sub } },
    });
    if (membership?.role !== EventRole.EVENT_MANAGER)
      throw new ForbiddenException('Financial dashboard permissions required');
  }
  private async movements(
    companyId: string,
    eventId?: string,
    range?: { from?: Date; to?: Date },
  ) {
    return this.prisma.stockMovement.findMany({
      where: {
        companyId,
        ...(eventId ? { eventId } : {}),
        status: 'POSTED',
        ...(range?.from || range?.to
          ? { createdAt: { gte: range.from, lte: range.to } }
          : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        sourceLocationId: true,
        destinationLocationId: true,
        type: true,
        createdAt: true,
        notes: true,
        createdBy: { select: { name: true } },
        items: {
          include: {
            cupType: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
  }
  private readonly balanceFor = balanceFor;
  private balanceRows(
    balance: Balance,
    names: Map<string, { name: string; code: string }>,
  ) {
    return [...balance.entries()]
      .filter(([, quantity]) => quantity !== 0)
      .map(([key, quantity]) => {
        const [cupTypeId, condition] = key.split(':');
        return {
          cupTypeId,
          cupTypeName: names.get(cupTypeId)?.name ?? 'Desconocido',
          cupTypeCode: names.get(cupTypeId)?.code ?? '',
          condition,
          quantity,
        };
      });
  }
  private stockSnapshot(
    locations: Array<{ id: string; name: string; type: string }>,
    movements: Movement[],
  ) {
    const names = new Map<string, { name: string; code: string }>();
    for (const movement of movements)
      for (const item of movement.items)
        names.set(item.cupTypeId, item.cupType);
    const byLocation = locations.map((location) => {
      const items = this.balanceRows(
        this.balanceFor(movements, location.id),
        names,
      );
      return {
        location,
        items,
        total: items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0),
      };
    });
    const byCup = new Map<
      string,
      {
        cupTypeId: string;
        cupTypeName: string;
        cupTypeCode: string;
        clean: number;
        dirty: number;
        damaged: number;
        total: number;
      }
    >();
    for (const row of byLocation)
      for (const item of row.items) {
        const current = byCup.get(item.cupTypeId) ?? {
          cupTypeId: item.cupTypeId,
          cupTypeName: item.cupTypeName,
          cupTypeCode: item.cupTypeCode,
          clean: 0,
          dirty: 0,
          damaged: 0,
          total: 0,
        };
        if (item.condition === 'CLEAN')
          current.clean += Math.max(0, item.quantity);
        if (item.condition === 'DIRTY')
          current.dirty += Math.max(0, item.quantity);
        if (item.condition === 'DAMAGED')
          current.damaged += Math.max(0, item.quantity);
        current.total = current.clean + current.dirty + current.damaged;
        byCup.set(item.cupTypeId, current);
      }
    const clean = byLocation
      .flatMap((row) => row.items)
      .filter((item) => item.condition === 'CLEAN')
      .reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
    const dirty = byLocation
      .flatMap((row) => row.items)
      .filter((item) => item.condition === 'DIRTY')
      .reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
    const damaged = byLocation
      .flatMap((row) => row.items)
      .filter((item) => item.condition === 'DAMAGED')
      .reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
    return {
      clean,
      dirty,
      damaged,
      total: clean + dirty + damaged,
      circulation: byLocation
        .filter(
          (row) => row.location.type === 'BOOTH' || row.location.type === 'BAR',
        )
        .reduce((sum, row) => sum + row.total, 0),
      byCup: [...byCup.values()],
      byLocation,
    };
  }
  private async cash(
    companyId: string,
    eventId?: string,
    range?: { from?: Date; to?: Date },
  ) {
    const [movements, sessions] = await Promise.all([
      this.prisma.cashMovement.findMany({
        where: {
          companyId,
          ...(eventId ? { eventId } : {}),
          ...(range?.from || range?.to
            ? { createdAt: { gte: range.from, lte: range.to } }
            : {}),
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.cashSession.findMany({
        where: {
          companyId,
          ...(eventId ? { eventId } : {}),
          ...(range?.from || range?.to
            ? { openedAt: { gte: range.from, lte: range.to } }
            : {}),
        },
        select: { status: true, difference: true },
      }),
    ]);
    const amount = (types: CashMovementType[]) =>
      movements
        .filter((movement) => types.includes(movement.type))
        .reduce((sum, movement) => sum + Number(movement.amount), 0);
    return {
      balance: movements.reduce(
        (sum, movement) =>
          sum +
          (['CASH_IN', 'COLLECTION', 'INITIAL_CASH', 'ADJUSTMENT'].includes(
            movement.type,
          )
            ? Number(movement.amount)
            : -Number(movement.amount)),
        0,
      ),
      collections: amount([CashMovementType.COLLECTION]),
      expenses: amount([CashMovementType.EXPENSE]),
      withdrawals: amount([CashMovementType.WITHDRAWAL]),
      adjustments: amount([CashMovementType.ADJUSTMENT]),
      differences: sessions.reduce(
        (sum, session) => sum + Number(session.difference ?? 0),
        0,
      ),
      sessions: {
        available: true,
        open: sessions.filter((session) => session.status === 'OPEN').length,
        closed: sessions.filter((session) => session.status === 'CLOSED')
          .length,
      },
      movements: movements.length,
    };
  }
  private range(query: Record<string, string | undefined>) {
    return {
      from: query.dateFrom ? new Date(query.dateFrom) : undefined,
      to: query.dateTo ? new Date(`${query.dateTo}T23:59:59.999Z`) : undefined,
    };
  }

  async global(user: AuthUser) {
    if (!this.isAdmin(user))
      throw new ForbiddenException('Administrative permissions required');
    const [events, locations, movements, pending, incidents] =
      await Promise.all([
        this.prisma.event.findMany({
          where: { companyId: user.companyId, deletedAt: null },
          select: { status: true },
        }),
        this.prisma.location.findMany({
          where: {
            companyId: user.companyId,
            eventId: { not: null },
            deletedAt: null,
          },
          select: { id: true, name: true, type: true },
        }),
        this.movements(user.companyId),
        this.prisma.deliveryNote.count({
          where: {
            companyId: user.companyId,
            status: DeliveryNoteStatus.PENDING_SIGNATURE,
          },
        }),
        this.prisma.incident.count({
          where: {
            companyId: user.companyId,
            status: { in: [IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS] },
          },
        }),
      ]);
    const stock = this.stockSnapshot(locations, movements);
    return {
      events: {
        active: events.filter((event) => event.status === EventStatus.ACTIVE)
          .length,
        planned: events.filter((event) => event.status === EventStatus.PLANNED)
          .length,
        finished: events.filter(
          (event) => event.status === EventStatus.FINISHED,
        ).length,
      },
      stock: {
        clean: stock.clean,
        dirty: stock.dirty,
        damaged: stock.damaged,
        inCirculation: stock.circulation,
      },
      deliveryNotes: { pendingSignature: pending },
      incidents: { open: incidents },
      cash: await this.cash(user.companyId),
      alerts: [
        {
          type: 'PENDING_DELIVERY_NOTES',
          severity: pending ? 'INFO' : 'INFO',
          title: 'Albaranes pendientes',
          message: pending
            ? `${pending} albarán(es) pendientes de firma.`
            : 'No hay albaranes pendientes.',
          entityType: 'DELIVERY_NOTE',
          entityId: '',
        },
      ],
    };
  }

  async event(
    user: AuthUser,
    eventId: string,
    query: Record<string, string | undefined> = {},
  ) {
    const event = await this.events.assertAccess(user, eventId);
    const [locations, movements, notes, incidents, noteCount] =
      await Promise.all([
        this.prisma.location.findMany({
          where: { companyId: user.companyId, eventId, deletedAt: null },
          select: { id: true, name: true, type: true, active: true },
        }),
        this.movements(user.companyId, eventId, this.range(query)),
        this.prisma.deliveryNote.findMany({
          where: { companyId: user.companyId, eventId },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            number: true,
            status: true,
            type: true,
            createdAt: true,
            signatures: { select: { type: true } },
          },
        }),
        this.prisma.incident.findMany({
          where: {
            companyId: user.companyId,
            eventId,
            status: { in: [IncidentStatus.OPEN, IncidentStatus.IN_PROGRESS] },
          },
          select: { id: true, title: true, status: true, locationId: true },
        }),
        this.prisma.deliveryNote.count({
          where: { companyId: user.companyId, eventId },
        }),
      ]);
    const stock = this.stockSnapshot(locations, movements);
    const losses = movements
      .filter((movement) => movement.type === StockMovementType.LOSS)
      .flatMap((movement) => movement.items)
      .reduce((sum, item) => sum + item.quantity, 0);
    const breakages = movements
      .filter((movement) => movement.type === StockMovementType.BREAKAGE)
      .flatMap((movement) => movement.items)
      .reduce((sum, item) => sum + item.quantity, 0);
    const alerts = this.alertsFromStock(stock, notes);
    const recentActivity = [
      ...movements
        .slice(-10)
        .reverse()
        .map((movement) => ({
          type: 'STOCK_MOVEMENT',
          id: movement.id,
          at: movement.createdAt,
          title: `${movement.createdBy.name} registró ${movement.type}`,
          detail: movement.notes ?? 'Movimiento de stock',
        })),
      ...notes.slice(0, 10).map((note) => ({
        type: 'DELIVERY_NOTE',
        id: note.id,
        at: note.createdAt,
        title: `Albarán ${note.number}`,
        detail: note.status,
      })),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 15);
    const financial =
      this.isAdmin(user) ||
      (
        await this.prisma.eventUser.findUnique({
          where: { eventId_userId: { eventId, userId: user.sub } },
          select: { role: true },
        })
      )?.role === EventRole.EVENT_MANAGER;
    return {
      event: {
        id: event.id,
        name: event.name,
        code: event.code,
        status: event.status,
      },
      structure: {
        booths: await this.prisma.booth.count({
          where: { eventId, deletedAt: null },
        }),
        bars: await this.prisma.bar.count({
          where: { eventId, deletedAt: null },
        }),
        users: await this.prisma.eventUser.count({ where: { eventId } }),
      },
      stock: { ...stock, losses, breakages },
      deliveryNotes: {
        total: noteCount,
        pendingSignature: notes.filter(
          (note) => note.status === DeliveryNoteStatus.PENDING_SIGNATURE,
        ).length,
        signed: notes.filter(
          (note) => note.status === DeliveryNoteStatus.SIGNED,
        ).length,
        cancelled: notes.filter(
          (note) => note.status === DeliveryNoteStatus.CANCELLED,
        ).length,
        pending: notes
          .filter(
            (note) => note.status === DeliveryNoteStatus.PENDING_SIGNATURE,
          )
          .map((note) => ({
            ...note,
            missingSignatures: ['DELIVERED_BY', 'RECEIVED_BY'].filter(
              (type) =>
                !note.signatures.some((signature) => signature.type === type),
            ),
          })),
      },
      cash: financial
        ? await this.cash(user.companyId, eventId, this.range(query))
        : null,
      alerts,
      recentActivity,
      incidents,
    };
  }
  private alertsFromStock(
    stock: ReturnType<DashboardService['stockSnapshot']>,
    notes: Array<{
      id: string;
      number: string;
      status: DeliveryNoteStatus;
      signatures: Array<{ type: string }>;
    }>,
  ) {
    const threshold = Number(process.env.LOW_STOCK_THRESHOLD ?? 100);
    const alerts = stock.byLocation.flatMap((row) =>
      row.items
        .filter(
          (item) =>
            item.condition === 'CLEAN' &&
            item.quantity > 0 &&
            item.quantity < threshold,
        )
        .map((item) => ({
          type: 'LOW_STOCK',
          severity: item.quantity < threshold / 2 ? 'CRITICAL' : 'WARNING',
          title: 'Stock bajo',
          message: `${row.location.name} tiene ${item.quantity} ${item.cupTypeName} limpios.`,
          entityType: 'LOCATION',
          entityId: row.location.id,
        })),
    );
    alerts.push(
      ...notes
        .filter((note) => note.status === DeliveryNoteStatus.PENDING_SIGNATURE)
        .map((note) => ({
          type: 'PENDING_DELIVERY_NOTE',
          severity: 'INFO',
          title: 'Albarán pendiente de firma',
          message: `${note.number} tiene firmas pendientes.`,
          entityType: 'DELIVERY_NOTE',
          entityId: note.id,
        })),
    );
    return alerts;
  }
  async alerts(user: AuthUser, eventId: string) {
    return (await this.event(user, eventId)).alerts;
  }
  async reportStock(
    user: AuthUser,
    eventId: string,
    query: Record<string, string | undefined>,
  ) {
    const data = await this.event(user, eventId, query);
    return {
      event: data.event,
      stock: data.stock,
      generatedAt: new Date(),
      formula:
        'El stock actual se calcula por entradas/salidas posted y las devoluciones consumen cualquier condición disponible.',
    };
  }
  async reportMovements(
    user: AuthUser,
    eventId: string,
    query: Record<string, string | undefined>,
  ) {
    await this.events.assertAccess(user, eventId);
    const movements = await this.movements(
      user.companyId,
      eventId,
      this.range(query),
    );
    return {
      items: movements
        .filter((movement) => !query.type || movement.type === query.type)
        .filter(
          (movement) =>
            !query.locationId ||
            movement.sourceLocationId === query.locationId ||
            movement.destinationLocationId === query.locationId,
        )
        .filter(
          (movement) =>
            !query.cupTypeId ||
            movement.items.some((item) => item.cupTypeId === query.cupTypeId),
        ),
      total: movements.length,
    };
  }
  async reportCash(
    user: AuthUser,
    eventId: string,
    query: Record<string, string | undefined>,
  ) {
    await this.assertFinancialAccess(user, eventId);
    return this.cash(user.companyId, eventId, this.range(query));
  }
  async reportDeliveryNotes(user: AuthUser, eventId: string) {
    await this.events.assertAccess(user, eventId);
    const notes = await this.prisma.deliveryNote.findMany({
      where: { companyId: user.companyId, eventId },
      select: { type: true, status: true },
    });
    return {
      total: notes.length,
      delivery: notes.filter((note) => note.type === 'DELIVERY').length,
      return: notes.filter((note) => note.type === 'RETURN').length,
      transfer: notes.filter((note) => note.type === 'TRANSFER').length,
      signed: notes.filter((note) => note.status === 'SIGNED').length,
      pending: notes.filter((note) => note.status === 'PENDING_SIGNATURE')
        .length,
      cancelled: notes.filter((note) => note.status === 'CANCELLED').length,
    };
  }
  async csvStock(
    user: AuthUser,
    eventId: string,
    query: Record<string, string | undefined>,
  ) {
    const report = await this.reportStock(user, eventId, query);
    const rows = [
      ['Tipo de vaso', 'Código', 'Limpios', 'Sucios', 'Dañados', 'Total'],
      ...report.stock.byCup.map((item) => [
        item.cupTypeName,
        item.cupTypeCode,
        item.clean,
        item.dirty,
        item.damaged,
        item.total,
      ]),
    ];
    return this.csv(rows);
  }
  async csvCash(
    user: AuthUser,
    eventId: string,
    query: Record<string, string | undefined>,
  ) {
    const report = await this.reportCash(user, eventId, query);
    return this.csv([
      ['Métrica', 'Importe'],
      ['Saldo', report.balance],
      ['Recaudación', report.collections],
      ['Gastos', report.expenses],
      ['Retiradas', report.withdrawals],
      ['Ajustes', report.adjustments],
      ['Diferencias', report.differences],
    ]);
  }
  private csv(rows: Array<Array<string | number>>) {
    return `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\r\n')}\r\n`;
  }
}
