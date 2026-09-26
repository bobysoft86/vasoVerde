import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LocationsService } from '../locations/locations.service';
import { EventsService } from '../events/events.service';
import { CreateBarDto } from './dto/create-bar.dto';
import { UpdateBarDto } from './dto/update-bar.dto';
import { AuthUser } from '../common/types/auth-request';
@Injectable()
export class BarsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService,
    private readonly events: EventsService,
  ) {}
  async list(
    user: AuthUser,
    eventId: string,
    search?: string,
    boothId?: string,
    active?: boolean,
  ) {
    await this.events.assertAccess(user, eventId);
    return this.prisma.bar.findMany({
      where: {
        eventId,
        deletedAt: null,
        ...(boothId ? { boothId } : {}),
        ...(active === undefined ? {} : { active }),
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
        booth: { select: { id: true, name: true } },
        clientUser: {
          select: { id: true, name: true, email: true, globalRole: true },
        },
        locations: true,
      },
      orderBy: { name: 'asc' },
    });
  }
  async get(user: AuthUser, eventId: string, id: string) {
    await this.events.assertAccess(user, eventId);
    const bar = await this.prisma.bar.findFirst({
      where: { id, eventId },
      include: {
        booth: true,
        clientUser: {
          select: { id: true, name: true, email: true, globalRole: true },
        },
        locations: true,
      },
    });
    if (!bar) throw new NotFoundException('Bar not found');
    return bar;
  }
  async create(user: AuthUser, eventId: string, dto: CreateBarDto) {
    await this.events.assertManager(user, eventId);
    const event = await this.events.assertAccess(user, eventId);
    const code = dto.code.trim().toUpperCase();
    if (await this.prisma.bar.findFirst({ where: { eventId, code } }))
      throw new ConflictException('Bar code already exists');
    await this.validateBooth(eventId, dto.boothId);
    const clientUserId = await this.validateClientUser(
      user.companyId,
      dto.clientUserId,
    );
    const bar = await this.prisma.bar.create({
      data: {
        eventId,
        boothId: dto.boothId,
        clientUserId,
        name: dto.name.trim(),
        code,
        description: dto.description,
      },
    });
    await this.locations.syncBar(bar, event.companyId);
    return bar;
  }
  async update(user: AuthUser, eventId: string, id: string, dto: UpdateBarDto) {
    await this.events.assertManager(user, eventId);
    const event = await this.events.assertAccess(user, eventId);
    const current = await this.get(user, eventId, id);
    const code = dto.code?.trim().toUpperCase();
    if (
      code &&
      code !== current.code &&
      (await this.prisma.bar.findFirst({
        where: { eventId, code, NOT: { id } },
      }))
    )
      throw new ConflictException('Bar code already exists');
    await this.validateBooth(eventId, dto.boothId);
    const clientUserId = await this.validateClientUser(
      user.companyId,
      dto.clientUserId,
    );
    const bar = await this.prisma.bar.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code,
        description: dto.description,
        boothId: dto.boothId,
        clientUserId,
        active: dto.active,
        deletedAt:
          dto.active === false
            ? new Date()
            : dto.active === true
              ? null
              : undefined,
      },
    });
    await this.locations.syncBar(bar, event.companyId);
    return bar;
  }
  private async validateBooth(eventId: string, boothId?: string | null) {
    if (!boothId) return;
    const booth = await this.prisma.booth.findFirst({
      where: { id: boothId, eventId, active: true, deletedAt: null },
    });
    if (!booth)
      throw new NotFoundException('Booth does not belong to this event');
  }
  private async validateClientUser(companyId: string, userId?: string | null) {
    if (!userId) return null;
    const client = await this.prisma.user.findFirst({
      where: { id: userId, companyId, active: true, deletedAt: null },
      select: { id: true, globalRole: true },
    });
    if (!client || client.globalRole !== GlobalRole.CLIENT)
      throw new BadRequestException('Assigned bar user must have CLIENT role');
    return client.id;
  }
}
