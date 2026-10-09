import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GlobalRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/types/auth-request';
import { CreateCupTypeDto } from './dto/create-cup-type.dto';
import { UpdateCupTypeDto } from './dto/update-cup-type.dto';

@Injectable()
export class CupTypesService {
  constructor(private readonly prisma: PrismaService) {}
  private isAdmin(user: AuthUser) {
    return (
      user.globalRole === GlobalRole.ADMIN ||
      user.globalRole === GlobalRole.SUPER_ADMIN
    );
  }
  async list(companyId: string, active?: boolean) {
    const cups = await this.prisma.cupType.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(active === undefined ? {} : { active }),
      },
      orderBy: { name: 'asc' },
      include: { ownerEvent: { select: { id: true, name: true, code: true } } },
    });
    return cups.map(cup => ({ ...cup, displayName: `${cup.name} · ${cup.ownerEvent?.code || 'Genérico'}` }));
  }
  async get(companyId: string, id: string) {
    const item = await this.prisma.cupType.findFirst({
      where: { id, companyId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Cup type not found');
    return item;
  }
  async create(user: AuthUser, dto: CreateCupTypeDto) {
    if (!this.isAdmin(user))
      throw new ForbiddenException('Administrative permissions required');
    const code = dto.code.trim().toUpperCase();
    if (dto.ownerEventId && !await this.prisma.event.findFirst({ where: { id: dto.ownerEventId, companyId: user.companyId, deletedAt: null } }))
      throw new BadRequestException('Evento no válido');
    if (dto.ownerEventId && !dto.baseTypeId)
      throw new BadRequestException('Selecciona el modelo físico para la serigrafía');
    if (dto.baseTypeId && !await this.prisma.cupType.findFirst({ where: { id: dto.baseTypeId, companyId: user.companyId, ownerEventId: null, baseTypeId: null, active: true, deletedAt: null } }))
      throw new BadRequestException('Modelo físico no válido');
    if (
      await this.prisma.cupType.findFirst({
        where: { companyId: user.companyId, code },
      })
    )
      throw new ConflictException('Cup type code already exists');
    return this.prisma.cupType.create({
      data: {
        companyId: user.companyId,
        ownerEventId: dto.ownerEventId || null,
        baseTypeId: dto.baseTypeId || null,
        name: dto.name.trim(),
        code,
        capacityMl: dto.capacityMl,
        description: dto.description,
        cost: dto.cost === undefined ? undefined : new Prisma.Decimal(dto.cost),
        deposit:
          dto.deposit === undefined
            ? undefined
            : new Prisma.Decimal(dto.deposit),
        externalCode: dto.externalCode,
      },
    });
  }
  async update(user: AuthUser, id: string, dto: UpdateCupTypeDto) {
    if (!this.isAdmin(user))
      throw new ForbiddenException('Administrative permissions required');
    const current = await this.get(user.companyId, id);
    if ((dto.ownerEventId !== undefined && (dto.ownerEventId || null) !== current.ownerEventId) ||
        (dto.baseTypeId !== undefined && (dto.baseTypeId || null) !== current.baseTypeId))
      throw new BadRequestException('La pertenencia y el modelo son permanentes. Crea una nueva referencia de vaso.');
    const code = dto.code?.trim().toUpperCase();
    if (
      code &&
      code !== current.code &&
      (await this.prisma.cupType.findFirst({
        where: { companyId: user.companyId, code, NOT: { id } },
      }))
    )
      throw new ConflictException('Cup type code already exists');
    return this.prisma.cupType.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        code,
        capacityMl: dto.capacityMl,
        description: dto.description,
        active: dto.active,
        deletedAt:
          dto.active === false
            ? new Date()
            : dto.active === true
              ? null
              : undefined,
        cost: dto.cost === undefined ? undefined : new Prisma.Decimal(dto.cost),
        deposit:
          dto.deposit === undefined
            ? undefined
            : new Prisma.Decimal(dto.deposit),
        externalCode: dto.externalCode,
      },
    });
  }
}
