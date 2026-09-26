import { Injectable } from '@nestjs/common';
import { LocationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureCompanyLocations(companyId: string) {
    const central = await this.prisma.location.findFirst({
      where: { companyId, type: LocationType.CENTRAL_WAREHOUSE },
      orderBy: { createdAt: 'asc' },
    });
    const warehouse = central
      ? await this.prisma.location.update({
          where: { id: central.id },
          data: {
            eventId: null,
            name: 'Nave central',
            code: 'LOC-CENTRAL',
            active: true,
            deletedAt: null,
          },
        })
      : await this.prisma.location.create({
          data: {
            companyId,
            name: 'Nave central',
            code: 'LOC-CENTRAL',
            type: LocationType.CENTRAL_WAREHOUSE,
          },
        });
    const cleaning = await this.prisma.location.findFirst({
      where: { companyId, type: LocationType.CLEANING_AREA },
      orderBy: { createdAt: 'asc' },
    });
    const cleaningArea = cleaning
      ? await this.prisma.location.update({
          where: { id: cleaning.id },
          data: {
            eventId: null,
            name: 'Zona de lavado',
            code: 'LOC-CLEANING',
            active: true,
            deletedAt: null,
          },
        })
      : await this.prisma.location.create({
          data: {
            companyId,
            name: 'Zona de lavado',
            code: 'LOC-CLEANING',
            type: LocationType.CLEANING_AREA,
          },
        });
    return { warehouse, cleaningArea };
  }
  async ensureEventWarehouse(
    event: { id: string; companyId: string; name: string; code: string },
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const code = `EVENT-${event.code}`;
    const existing = await tx.location.findFirst({
      where: { eventId: event.id, type: LocationType.EVENT_WAREHOUSE },
    });
    if (existing)
      return tx.location.update({
        where: { id: existing.id },
        data: {
          name: `Almacén ${event.name}`,
          code,
          active: true,
          deletedAt: null,
        },
      });
    return tx.location.create({
      data: {
        companyId: event.companyId,
        eventId: event.id,
        name: `Almacén ${event.name}`,
        code,
        type: LocationType.EVENT_WAREHOUSE,
      },
    });
  }
  async syncBooth(
    booth: {
      id: string;
      eventId: string;
      name: string;
      code: string;
      active: boolean;
    },
    companyId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const existing = await tx.location.findFirst({
      where: { boothId: booth.id },
    });
    const data = {
      companyId,
      eventId: booth.eventId,
      boothId: booth.id,
      name: booth.name,
      code: `BOOTH-${booth.eventId}-${booth.code}`,
      type: LocationType.BOOTH,
      active: booth.active,
      deletedAt: booth.active ? null : new Date(),
    };
    return existing
      ? tx.location.update({ where: { id: existing.id }, data })
      : tx.location.create({ data });
  }
  async syncBar(
    bar: {
      id: string;
      eventId: string;
      name: string;
      code: string;
      active: boolean;
    },
    companyId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const existing = await tx.location.findFirst({ where: { barId: bar.id } });
    const data = {
      companyId,
      eventId: bar.eventId,
      barId: bar.id,
      name: bar.name,
      code: `BAR-${bar.code}`,
      type: LocationType.BAR,
      active: bar.active,
      deletedAt: bar.active ? null : new Date(),
    };
    return existing
      ? tx.location.update({ where: { id: existing.id }, data })
      : tx.location.create({ data });
  }
}
