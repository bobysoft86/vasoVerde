import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CashMovementType,
  EventRole,
  GlobalRole,
  LocationType,
  Prisma,
  StockCondition,
  StockMovementStatus,
  StockMovementType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { AuthUser } from '../common/types/auth-request';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { CloseLocationDto } from './dto/close-location.dto';
import { DeliveryNotesService } from '../delivery-notes/delivery-notes.service';
import { LocationsService } from '../locations/locations.service';
import { balanceFor, reserveStock } from './stock-ledger';

type Db = Prisma.TransactionClient | PrismaService;
type Balance = Map<string, number>;

function eligibleForDeliveryNote(type: StockMovementType) {
  return (
    type === StockMovementType.DELIVERY ||
    type === StockMovementType.RETURN ||
    type === StockMovementType.TRANSFER ||
    type === StockMovementType.CLEANING_SEND ||
    type === StockMovementType.CLEANING_RETURN
  );
}

@Injectable()
export class StockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly deliveryNotes: DeliveryNotesService,
    private readonly locationService: LocationsService,
  ) {}

  private assertAdmin(user: AuthUser) {
    if (
      user.globalRole !== GlobalRole.ADMIN &&
      user.globalRole !== GlobalRole.SUPER_ADMIN
    )
      throw new ForbiddenException(
        'Se requiere permiso de administración de nave',
      );
  }

  private async lockEvent(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    eventId: string | null,
  ) {
    if (!eventId) return;
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM Event WHERE id = ${eventId} FOR UPDATE`,
    );
    const event = await tx.event.findFirst({
      where: { id: eventId, companyId: user.companyId, deletedAt: null },
    });
    if (!event || ['FINISHED', 'ARCHIVED', 'CANCELLED'].includes(event.status))
      throw new BadRequestException('El evento está cerrado para operaciones');
  }

  private async assertAssignedOperation(
    user: AuthUser,
    eventId: string | null,
    dto: CreateStockMovementDto,
    source?: string,
    destination?: string,
  ) {
    if (
      [GlobalRole.ADMIN, GlobalRole.SUPER_ADMIN].includes(
        user.globalRole as 'ADMIN' | 'SUPER_ADMIN',
      )
    )
      return;
    if (!eventId) return this.assertAdmin(user);
    // A bar operator controls deliveries TO their bar and collections FROM it.
    const controlled =
      dto.type === StockMovementType.DELIVERY
        ? destination
        : (source ?? destination);
    const assignment = await this.prisma.locationUserAssignment.findFirst({
      where: {
        companyId: user.companyId,
        eventId,
        userId: user.sub,
        locationId: controlled,
        active: true,
        role: { in: ['WORKER', 'RESPONSIBLE'] },
      },
    });
    if (!controlled || !assignment)
      throw new ForbiddenException('No estás asignado a esta ubicación');
  }

  async operationalLocations(user: AuthUser, eventId: string) {
    const locations = await this.locations(user, eventId);
    const eligible = locations.filter(
      (l) =>
        l.active &&
        ['BAR', 'BOOTH', 'EVENT_WAREHOUSE', 'CENTRAL_WAREHOUSE'].includes(
          l.type,
        ),
    );
    if (
      user.globalRole === GlobalRole.ADMIN ||
      user.globalRole === GlobalRole.SUPER_ADMIN
    )
      return eligible;
    const assignments = await this.prisma.locationUserAssignment.findMany({
      where: {
        companyId: user.companyId,
        eventId,
        userId: user.sub,
        active: true,
        role: { in: ['WORKER', 'RESPONSIBLE'] },
      },
    });
    return eligible.filter((l) =>
      assignments.some((a) => a.locationId === l.id),
    );
  }

  async warehouseMovement(
    user: AuthUser,
    dto: CreateStockMovementDto & { eventId?: string },
  ) {
    this.assertAdmin(user);
    await this.locationService.ensureCompanyLocations(user.companyId);
    const ids = [dto.sourceLocationId, dto.destinationLocationId].filter(
      (id): id is string => !!id,
    );
    const locations = await this.prisma.location.findMany({
      where: { id: { in: ids }, companyId: user.companyId },
    });
    if (
      !locations.some(
        (l) =>
          l.eventId === null &&
          ['CENTRAL_WAREHOUSE', 'CLEANING_AREA'].includes(l.type),
      )
    )
      throw new BadRequestException(
        'La operación debe incluir la nave o la zona de lavado',
      );
    if (
      ![
        'DELIVERY',
        'TRANSFER',
        'RETURN',
        'CLEANING_SEND',
        'CLEANING_RETURN',
        'LOSS',
        'BREAKAGE',
      ].includes(dto.type)
    )
      throw new BadRequestException('Tipo de operación de nave no admitido');
    return this.create(user, dto.eventId || null, dto);
  }

  private canOperate(user: AuthUser, role?: EventRole) {
    return (
      user.globalRole === GlobalRole.ADMIN ||
      user.globalRole === GlobalRole.SUPER_ADMIN ||
      (!!role && role !== EventRole.VIEWER)
    );
  }
  private async assertOperator(user: AuthUser, eventId: string) {
    const event = await this.events.assertAccess(user, eventId);
    if (['FINISHED', 'ARCHIVED', 'CANCELLED'].includes(event.status))
      throw new BadRequestException('El evento está cerrado para operaciones');
    if (
      user.globalRole === GlobalRole.ADMIN ||
      user.globalRole === GlobalRole.SUPER_ADMIN
    )
      return event;
    const membership = await this.prisma.eventUser.findUnique({
      where: { eventId_userId: { eventId, userId: user.sub } },
    });
    if (!this.canOperate(user, membership?.role))
      throw new ForbiddenException('Read-only event access');
    return event;
  }
  async locations(user: AuthUser, eventId: string) {
    await this.events.assertAccess(user, eventId);
    await this.locationService.ensureCompanyLocations(user.companyId);
    const [booths, bars] = await Promise.all([
      this.prisma.booth.findMany({
        where: { eventId },
        select: {
          id: true,
          eventId: true,
          name: true,
          code: true,
          active: true,
        },
      }),
      this.prisma.bar.findMany({
        where: { eventId },
        select: {
          id: true,
          eventId: true,
          name: true,
          code: true,
          active: true,
        },
      }),
    ]);
    await Promise.all([
      ...booths.map((booth) =>
        this.locationService.syncBooth(booth, user.companyId),
      ),
      ...bars.map((bar) => this.locationService.syncBar(bar, user.companyId)),
    ]);
    return this.prisma.location.findMany({
      where: {
        companyId: user.companyId,
        OR: [
          { eventId },
          {
            eventId: null,
            type: {
              in: [LocationType.CENTRAL_WAREHOUSE, LocationType.CLEANING_AREA],
            },
          },
        ],
        deletedAt: null,
      },
      orderBy: [{ eventId: 'asc' }, { name: 'asc' }],
    });
  }

  private async movementsForLocation(
    db: Db,
    eventId: string,
    locationId: string,
  ) {
    return db.stockMovement.findMany({
      where: {
        status: StockMovementStatus.POSTED,
        OR: [
          { sourceLocationId: locationId },
          { destinationLocationId: locationId },
        ],
      },
      select: {
        sourceLocationId: true,
        destinationLocationId: true,
        type: true,
        createdAt: true,
        items: { select: { cupTypeId: true, quantity: true, condition: true } },
      },
    });
  }
  private readonly balanceFor = balanceFor;
  private async assertLocations(
    user: AuthUser,
    eventId: string | null,
    sourceId?: string,
    destinationId?: string,
  ) {
    const ids = [sourceId, destinationId].filter((id): id is string =>
      Boolean(id),
    );
    const locations = await this.prisma.location.findMany({
      where: { id: { in: ids }, companyId: user.companyId },
    });
    if (locations.length !== ids.length)
      throw new BadRequestException('Location does not belong to this company');
    for (const location of locations)
      if (location.eventId !== null && location.eventId !== eventId)
        throw new BadRequestException('Location does not belong to this event');
    for (const location of locations)
      if (!location.active || location.deletedAt)
        throw new BadRequestException(`Location ${location.name} is inactive`);
    return {
      source: locations.find((location) => location.id === sourceId),
      destination: locations.find((location) => location.id === destinationId),
    };
  }
  private direction(
    type: StockMovementType,
    sourceId?: string,
    destinationId?: string,
  ) {
    if (
      type === StockMovementType.INITIAL_LOAD ||
      (type === StockMovementType.ADJUSTMENT && !sourceId && !!destinationId)
    )
      return 'in';
    if (type === StockMovementType.RETURN && !sourceId && !!destinationId)
      return 'in';
    if (type === StockMovementType.SALE && !!sourceId && !destinationId)
      return 'out';
    if (
      type === StockMovementType.LOSS ||
      type === StockMovementType.BREAKAGE ||
      (type === StockMovementType.ADJUSTMENT && !!sourceId && !destinationId)
    )
      return 'out';
    return 'both';
  }
  async create(
    user: AuthUser,
    eventId: string | null,
    dto: CreateStockMovementDto,
  ) {
    if (eventId) await this.assertOperator(user, eventId);
    else this.assertAdmin(user);
    if (dto.type === StockMovementType.INITIAL_LOAD)
      throw new BadRequestException(
        'Initial stock must be received through the central warehouse',
      );
    if (!dto.items?.length)
      throw new BadRequestException('Movement must contain at least one item');
    const keys = new Set<string>();
    for (const item of dto.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0)
        throw new BadRequestException('Quantity must be a positive integer');
      const key = `${item.cupTypeId}:${item.condition}`;
      if (keys.has(key))
        throw new BadRequestException(
          'Duplicate cup type and condition in movement',
        );
      keys.add(key);
    }
    if (
      dto.sourceLocationId &&
      dto.sourceLocationId === dto.destinationLocationId
    )
      throw new BadRequestException('Source and destination must be different');
    const direction = this.direction(
      dto.type,
      dto.sourceLocationId,
      dto.destinationLocationId,
    );
    if (
      direction === 'in' &&
      (!dto.destinationLocationId || dto.sourceLocationId)
    )
      throw new BadRequestException('This movement requires destination only');
    if (
      direction === 'out' &&
      (!dto.sourceLocationId || dto.destinationLocationId)
    )
      throw new BadRequestException('This movement requires source only');
    if (
      direction === 'both' &&
      (!dto.sourceLocationId || !dto.destinationLocationId)
    )
      throw new BadRequestException(
        'This movement requires source and destination',
      );
    const { source, destination } = await this.assertLocations(
      user,
      eventId,
      dto.sourceLocationId,
      dto.destinationLocationId,
    );
    await this.assertAssignedOperation(
      user,
      eventId,
      dto,
      source?.id,
      destination?.id,
    );
    if (dto.chargeable && (dto.type !== StockMovementType.DELIVERY || destination?.type !== LocationType.BAR))
      throw new BadRequestException('Solo las entregas a barras pueden generar un cargo');
    if (dto.chargeable && (!dto.chargeAmount || dto.chargeAmount <= 0 || !dto.cashSessionId))
      throw new BadRequestException('Una entrega con cargo requiere importe y caja de la barra');
    if (!dto.chargeable && (dto.chargeAmount || dto.cashSessionId))
      throw new BadRequestException('El importe y la caja solo se usan en entregas con cargo');
    if (
      ['LOSS', 'BREAKAGE', 'ADJUSTMENT'].includes(dto.type) &&
      !dto.notes?.trim()
    )
      throw new BadRequestException('Indica el motivo de la baja o ajuste');
    if (dto.type === StockMovementType.ADJUSTMENT) this.assertAdmin(user);
    if (dto.items.some((item) => item.condition === StockCondition.LOST))
      throw new BadRequestException(
        'Selecciona el estado físico del vaso antes de la operación',
      );
    if (source && eventId) {
      const closure = await this.prisma.locationClosure.findFirst({
        where: { eventId, locationId: source.id },
      });
      if (closure)
        throw new BadRequestException('This location is already closed');
    }
    if (
      (dto.type === StockMovementType.CLEANING_SEND &&
        dto.items.some((item) => item.condition !== StockCondition.DIRTY)) ||
      (dto.type === StockMovementType.CLEANING_RETURN &&
        dto.items.some((item) => item.condition !== StockCondition.CLEAN))
    )
      throw new BadRequestException('Invalid condition for cleaning movement');
    if (
      dto.type === StockMovementType.CLEANING_SEND &&
      destination?.type !== LocationType.CLEANING_AREA
    )
      throw new BadRequestException(
        'Cleaning sends must go to the washing area',
      );
    if (
      dto.type === StockMovementType.CLEANING_RETURN &&
      source?.type !== LocationType.CLEANING_AREA
    )
      throw new BadRequestException(
        'Cleaning returns must start at the washing area',
      );
    if (
      dto.type === StockMovementType.CLEANING_RETURN &&
      destination?.type === LocationType.CLEANING_AREA
    )
      throw new BadRequestException(
        'Cleaning returns must leave the washing area',
      );
    const cups = await this.prisma.cupType.findMany({
      where: {
        id: { in: dto.items.map((item) => item.cupTypeId) },
        companyId: user.companyId,
        deletedAt: null,
        active: true,
      },
    });
    if (cups.length !== new Set(dto.items.map((item) => item.cupTypeId)).size)
      throw new BadRequestException(
        'Cup type does not belong to this company or is inactive',
      );
    const movement = await this.prisma.$transaction(
      async (tx) => {
        await this.lockEvent(tx, user, eventId);
        const sourceIds = [source?.id, destination?.id]
          .filter((id): id is string => !!id)
          .sort();
        if (sourceIds.length)
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM Location WHERE id IN (${Prisma.join(sourceIds)}) ORDER BY id FOR UPDATE`,
          );
        if (
          await tx.locationClosure.findFirst({
            where: { locationId: { in: sourceIds } },
          })
        )
          throw new BadRequestException(
            'Una de las ubicaciones ya está cerrada',
          );
        if (source) {
          const balance = this.balanceFor(
            await this.movementsForLocation(tx, eventId ?? '', source.id),
            source.id,
          );
          reserveStock(
            balance,
            dto.type,
            dto.items,
            source.type === LocationType.BAR,
          );
        }
        const created = await tx.stockMovement.create({
          data: {
            companyId: user.companyId,
            eventId,
            sourceLocationId: source?.id,
            destinationLocationId: destination?.id,
            createdByUserId: user.sub,
            type: dto.type,
            status: StockMovementStatus.POSTED,
            chargeable: !!dto.chargeable,
            chargeAmount: dto.chargeable ? dto.chargeAmount : undefined,
            notes: dto.notes,
            items: {
              create: dto.items.map((item) => ({
                cupTypeId: item.cupTypeId,
                quantity: item.quantity,
                condition: item.condition,
              })),
            },
          },
          include: {
            sourceLocation: true,
            destinationLocation: true,
            createdBy: { select: { id: true, name: true, email: true } },
            items: { include: { cupType: true } },
          },
        });
        if (dto.chargeable) {
          const session = await tx.cashSession.findFirst({
            where: {
              id: dto.cashSessionId,
              companyId: user.companyId,
              eventId,
              locationId: destination!.id,
              status: 'OPEN',
            },
          });
          if (!session) throw new BadRequestException('La caja seleccionada no está abierta en esta barra');
          await tx.cashMovement.create({
            data: {
              companyId: user.companyId,
              eventId,
              locationId: destination!.id,
              cashSessionId: session.id,
              stockMovementId: created.id,
              createdByUserId: user.sub,
              type: CashMovementType.COLLECTION,
              amount: dto.chargeAmount!,
              concept: `Cargo por entrega a ${destination!.name}`,
              notes: dto.notes,
            },
          });
        }
        if (
          eventId &&
          dto.generateDeliveryNote &&
          eligibleForDeliveryNote(dto.type)
        ) {
          const deliveryNote = await this.deliveryNotes.create(
            user,
            eventId,
            { stockMovementId: created.id, notes: dto.notes },
            tx,
          );
          return { ...created, deliveryNote };
        }
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return movement;
  }
  async closeLocation(
    user: AuthUser,
    eventId: string,
    locationId: string,
    dto: CloseLocationDto,
  ) {
    await this.assertOperator(user, eventId);
    const { source, destination } = await this.assertLocations(
      user,
      eventId,
      locationId,
      dto.destinationLocationId,
    );
    if (!source || !destination)
      throw new BadRequestException('Invalid closure locations');
    if (source.id === destination.id)
      throw new BadRequestException('El destino debe ser diferente al origen');
    await this.assertAssignedOperation(
      user,
      eventId,
      { type: StockMovementType.RETURN, items: dto.items },
      source.id,
      destination.id,
    );
    if (source.type !== LocationType.BAR && source.type !== LocationType.BOOTH)
      throw new BadRequestException(
        'Only bars and booths can be closed this way',
      );
    const existing = await this.prisma.locationClosure.findFirst({
      where: { eventId, locationId: source.id },
    });
    if (existing)
      throw new BadRequestException('This location is already closed');
    const keys = new Set<string>();
    for (const item of dto.items) {
      const key = `${item.cupTypeId}:${item.condition}`;
      if (keys.has(key))
        throw new BadRequestException(
          'Duplicate cup type and condition in closure',
        );
      keys.add(key);
    }
    const cups = await this.prisma.cupType.findMany({
      where: {
        id: { in: dto.items.map((item) => item.cupTypeId) },
        companyId: user.companyId,
        active: true,
        deletedAt: null,
      },
    });
    if (cups.length !== new Set(dto.items.map((item) => item.cupTypeId)).size)
      throw new BadRequestException(
        'Cup type does not belong to this company or is inactive',
      );
    const movement = await this.prisma.$transaction(
      async (tx) => {
        await this.lockEvent(tx, user, eventId);
        const locationIds = [source.id, destination.id].sort();
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM Location WHERE id IN (${Prisma.join(locationIds)}) ORDER BY id FOR UPDATE`,
        );
        if (
          await tx.locationClosure.findFirst({
            where: { locationId: { in: locationIds } },
          })
        )
          throw new BadRequestException(
            'Una de las ubicaciones ya está cerrada',
          );
        if (source.type !== LocationType.BAR)
          reserveStock(
            this.balanceFor(
              await this.movementsForLocation(tx, eventId, source.id),
              source.id,
            ),
            StockMovementType.RETURN,
            dto.items,
          );
        const created = await tx.stockMovement.create({
          data: {
            companyId: user.companyId,
            eventId,
            sourceLocationId: source.id,
            destinationLocationId: destination.id,
            createdByUserId: user.sub,
            type: StockMovementType.RETURN,
            status: StockMovementStatus.POSTED,
            notes: dto.notes?.trim() || `Cierre de ${source.name}`,
            items: {
              create: dto.items.map((item) => ({
                cupTypeId: item.cupTypeId,
                quantity: item.quantity,
                condition: item.condition,
              })),
            },
          },
          include: {
            sourceLocation: true,
            destinationLocation: true,
            createdBy: { select: { id: true, name: true, email: true } },
            items: { include: { cupType: true } },
          },
        });
        const balanceAfterReturn = this.balanceFor(
          await this.movementsForLocation(tx, eventId, source.id),
          source.id,
        );
        const residualItems = [...balanceAfterReturn.entries()]
          .filter(([, quantity]) => quantity > 0)
          .map(([key, quantity]) => {
            const [cupTypeId, condition] = key.split(':');
            return {
              cupTypeId,
              quantity,
              condition: condition as StockCondition,
            };
          });
        let lossMovementId: string | undefined;
        if (residualItems.length) {
          const loss = await tx.stockMovement.create({
            data: {
              companyId: user.companyId,
              eventId,
              sourceLocationId: source.id,
              createdByUserId: user.sub,
              type: StockMovementType.LOSS,
              status: StockMovementStatus.POSTED,
              notes: `Diferencia de cierre de ${source.name}`,
              items: { create: residualItems },
            },
          });
          lossMovementId = loss.id;
        }
        await tx.locationClosure.create({
          data: {
            companyId: user.companyId,
            eventId,
            locationId: source.id,
            destinationLocationId: destination.id,
            stockMovementId: created.id,
            closedByUserId: user.sub,
            notes: dto.notes?.trim(),
          },
        });
        await tx.auditLog.create({
          data: {
            companyId: user.companyId,
            eventId,
            userId: user.sub,
            action: 'LOCATION_CLOSED',
            entityType: 'Location',
            entityId: source.id,
            metadata: {
              destinationLocationId: destination.id,
              stockMovementId: created.id,
              lossMovementId,
            },
          },
        });
        if ((dto.generateDeliveryNote ?? true) && dto.items.length > 0) {
          const deliveryNote = await this.deliveryNotes.create(
            user,
            eventId,
            { stockMovementId: created.id, notes: dto.notes },
            tx,
          );
          return { ...created, deliveryNote };
        }
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
    );
    return movement;
  }
  async stockAtLocation(user: AuthUser, eventId: string, locationId: string) {
    await this.events.assertAccess(user, eventId);
    const location = await this.prisma.location.findFirst({
      where: {
        id: locationId,
        companyId: user.companyId,
        OR: [
          { eventId },
          {
            eventId: null,
            type: {
              in: [LocationType.CENTRAL_WAREHOUSE, LocationType.CLEANING_AREA],
            },
          },
        ],
      },
    });
    if (!location) throw new NotFoundException('Location not found');
    const balance = this.balanceFor(
      await this.movementsForLocation(this.prisma, eventId, locationId),
      locationId,
    );
    return {
      location: { id: location.id, name: location.name, type: location.type },
      items: await this.balanceItems(balance),
    };
  }

  async centralOverview(user: AuthUser) {
    this.assertAdmin(user);
    const { warehouse, cleaningArea } =
      await this.locationService.ensureCompanyLocations(user.companyId);
    const locations = [warehouse, cleaningArea];
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        companyId: user.companyId,
        status: StockMovementStatus.POSTED,
        OR: [
          {
            sourceLocationId: { in: locations.map((location) => location.id) },
          },
          {
            destinationLocationId: {
              in: locations.map((location) => location.id),
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sourceLocation: { select: { id: true, name: true, type: true } },
        destinationLocation: { select: { id: true, name: true, type: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        items: { include: { cupType: true } },
      },
    });
    return {
      locations: await Promise.all(
        locations.map(async (location) => ({
          id: location.id,
          name: location.name,
          type: location.type,
          items: await this.balanceItems(
            this.balanceFor(
              movements.map((movement) => ({
                sourceLocationId: movement.sourceLocationId,
                destinationLocationId: movement.destinationLocationId,
                type: movement.type,
                createdAt: movement.createdAt,
                items: movement.items,
              })),
              location.id,
            ),
          ),
        })),
      ),
      movements: movements.slice(0, 50),
    };
  }

  async receiveCentralStock(user: AuthUser, dto: CreateStockMovementDto) {
    if (
      user.globalRole !== GlobalRole.ADMIN &&
      user.globalRole !== GlobalRole.SUPER_ADMIN
    )
      throw new ForbiddenException('Administrative permissions required');
    if (!dto.items?.length || dto.sourceLocationId || dto.destinationLocationId)
      throw new BadRequestException(
        'A factory receipt only contains cup lines',
      );
    if (dto.items.some((item) => item.condition !== StockCondition.CLEAN))
      throw new BadRequestException('Factory receipts must contain clean cups');
    const keys = new Set<string>();
    for (const item of dto.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0)
        throw new BadRequestException('Quantity must be a positive integer');
      const key = `${item.cupTypeId}:${item.condition}`;
      if (keys.has(key)) throw new BadRequestException('Duplicate cup line');
      keys.add(key);
    }
    const { warehouse } = await this.locationService.ensureCompanyLocations(
      user.companyId,
    );
    const cups = await this.prisma.cupType.findMany({
      where: {
        id: { in: dto.items.map((item) => item.cupTypeId) },
        companyId: user.companyId,
        active: true,
        deletedAt: null,
      },
    });
    if (cups.length !== new Set(dto.items.map((item) => item.cupTypeId)).size)
      throw new BadRequestException(
        'Cup type does not belong to this company or is inactive',
      );
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM Location WHERE id = ${warehouse.id} FOR UPDATE`,
      );
      return tx.stockMovement.create({
        data: {
          companyId: user.companyId,
          eventId: null,
          destinationLocationId: warehouse.id,
          createdByUserId: user.sub,
          type: StockMovementType.INITIAL_LOAD,
          status: StockMovementStatus.POSTED,
          notes: dto.notes?.trim() || 'Recepción de fábrica',
          items: { create: dto.items },
        },
        include: {
          destinationLocation: true,
          createdBy: { select: { id: true, name: true, email: true } },
          items: { include: { cupType: true } },
        },
      });
    });
  }
  private async balanceItems(balance: Balance) {
    const ids = [
      ...new Set([...balance.keys()].map((key) => key.split(':')[0])),
    ];
    const cups = await this.prisma.cupType.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    const names = new Map(cups.map((cup) => [cup.id, cup.name]));
    return [...balance.entries()]
      .filter(([, quantity]) => quantity !== 0)
      .map(([key, quantity]) => {
        const [cupTypeId, condition] = key.split(':');
        return {
          cupTypeId,
          cupTypeName: names.get(cupTypeId) ?? 'Unknown',
          condition,
          quantity,
        };
      });
  }
  async eventStock(user: AuthUser, eventId: string, includeLocations = false) {
    await this.events.assertAccess(user, eventId);
    const locations = await this.prisma.location.findMany({
      where: { companyId: user.companyId, eventId, deletedAt: null },
      select: { id: true, name: true, type: true },
    });
    const movements = await this.prisma.stockMovement.findMany({
      where: {
        companyId: user.companyId,
        eventId,
        status: StockMovementStatus.POSTED,
      },
      select: {
        sourceLocationId: true,
        destinationLocationId: true,
        type: true,
        createdAt: true,
        items: { select: { cupTypeId: true, quantity: true, condition: true } },
      },
    });
    const totals: Balance = new Map();
    for (const location of locations) {
      const balance = this.balanceFor(
        movements.filter(
          (movement) =>
            movement.sourceLocationId === location.id ||
            movement.destinationLocationId === location.id,
        ),
        location.id,
      );
      for (const [key, quantity] of balance)
        if (quantity > 0) totals.set(key, (totals.get(key) ?? 0) + quantity);
    }
    const items = await this.balanceItems(totals);
    const grouped = new Map<
      string,
      {
        cupTypeId: string;
        cupTypeName: string;
        clean: number;
        dirty: number;
        damaged: number;
        total: number;
      }
    >();
    for (const item of items) {
      const current = grouped.get(item.cupTypeId) ?? {
        cupTypeId: item.cupTypeId,
        cupTypeName: item.cupTypeName,
        clean: 0,
        dirty: 0,
        damaged: 0,
        total: 0,
      };
      if (item.condition === 'CLEAN') current.clean += item.quantity;
      if (item.condition === 'DIRTY') current.dirty += item.quantity;
      if (item.condition === 'DAMAGED') current.damaged += item.quantity;
      current.total += item.quantity;
      grouped.set(item.cupTypeId, current);
    }
    const response: {
      totals: typeof items;
      summary: typeof grouped extends Map<string, infer V> ? V[] : never;
      locations?: unknown[];
    } = { totals: items, summary: [...grouped.values()] };
    if (includeLocations)
      response.locations = await Promise.all(
        locations.map((location) =>
          this.stockAtLocation(user, eventId, location.id),
        ),
      );
    return response;
  }
  async list(
    user: AuthUser,
    eventId: string,
    query: {
      type?: StockMovementType;
      sourceLocationId?: string;
      destinationLocationId?: string;
      cupTypeId?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    await this.events.assertAccess(user, eventId);
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
    const where: Prisma.StockMovementWhereInput = {
      companyId: user.companyId,
      eventId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.sourceLocationId
        ? { sourceLocationId: query.sourceLocationId }
        : {}),
      ...(query.destinationLocationId
        ? { destinationLocationId: query.destinationLocationId }
        : {}),
      ...(query.cupTypeId
        ? { items: { some: { cupTypeId: query.cupTypeId } } }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.stockMovement.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          sourceLocation: true,
          destinationLocation: true,
          createdBy: { select: { id: true, name: true, email: true } },
          items: { include: { cupType: true } },
        },
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }
  async detail(user: AuthUser, eventId: string, movementId: string) {
    await this.events.assertAccess(user, eventId);
    const movement = await this.prisma.stockMovement.findFirst({
      where: { id: movementId, companyId: user.companyId, eventId },
      include: {
        sourceLocation: true,
        destinationLocation: true,
        createdBy: { select: { id: true, name: true, email: true } },
        items: { include: { cupType: true } },
      },
    });
    if (!movement) throw new NotFoundException('Stock movement not found');
    return movement;
  }
}
