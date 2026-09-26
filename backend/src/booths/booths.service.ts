import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LocationsService } from '../locations/locations.service';
import { EventsService } from '../events/events.service';
import { CreateBoothDto } from './dto/create-booth.dto';
import { UpdateBoothDto } from './dto/update-booth.dto';
import { AuthUser } from '../common/types/auth-request';
@Injectable()
export class BoothsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService,
    private readonly events: EventsService,
  ) {}
  async list(
    user: AuthUser,
    eventId: string,
    search?: string,
    active?: boolean,
  ) {
    await this.events.assertAccess(user, eventId);
    return this.prisma.booth.findMany({
      where: {
        eventId,
        deletedAt: null,
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
      include: { _count: { select: { bars: true } } },
      orderBy: { name: 'asc' },
    });
  }
  async get(user: AuthUser, eventId: string, id: string) {
    await this.events.assertAccess(user, eventId);
    const booth = await this.prisma.booth.findFirst({
      where: { id, eventId },
      include: { bars: true, locations: true },
    });
    if (!booth) throw new NotFoundException('Booth not found');
    return booth;
  }
  async create(user: AuthUser, eventId: string, dto: CreateBoothDto) {
    await this.events.assertManager(user, eventId);
    const event = await this.events.assertAccess(user, eventId);
    const code = dto.code.trim().toUpperCase();
    if (await this.prisma.booth.findFirst({ where: { eventId, code } }))
      throw new ConflictException('Booth code already exists');
    const booth = await this.prisma.booth.create({
      data: {
        eventId,
        name: dto.name.trim(),
        code,
        description: dto.description,
      },
    });
    await this.locations.syncBooth(booth, event.companyId);
    return booth;
  }
  async update(
    user: AuthUser,
    eventId: string,
    id: string,
    dto: UpdateBoothDto,
  ) {
    await this.events.assertManager(user, eventId);
    const event = await this.events.assertAccess(user, eventId);
    const current = await this.get(user, eventId, id);
    const code = dto.code?.trim().toUpperCase();
    if (
      code &&
      code !== current.code &&
      (await this.prisma.booth.findFirst({
        where: { eventId, code, NOT: { id } },
      }))
    )
      throw new ConflictException('Booth code already exists');
    const booth = await this.prisma.booth.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code,
        description: dto.description,
        active: dto.active,
        deletedAt:
          dto.active === false
            ? new Date()
            : dto.active === true
              ? null
              : undefined,
      },
    });
    await this.locations.syncBooth(booth, event.companyId);
    return booth;
  }
}
