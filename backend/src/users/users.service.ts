import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AdminPasswordDto } from './dto/admin-password.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  private select = {
    id: true,
    name: true,
    email: true,
    phone: true,
    active: true,
    globalRole: true,
    createdAt: true,
    updatedAt: true,
  } as const;
  async findAll(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId, deletedAt: null },
      select: {
        ...this.select,
        eventMemberships: {
          select: {
            eventId: true,
            role: true,
            event: { select: { name: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }
  async findOne(companyId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId, deletedAt: null },
      select: {
        ...this.select,
        eventMemberships: {
          select: {
            eventId: true,
            role: true,
            event: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
  async create(companyId: string, dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findFirst({
      where: { companyId, email },
    });
    if (exists) throw new ConflictException('Email already exists');
    return this.prisma.user.create({
      data: {
        companyId,
        name: dto.name.trim(),
        email,
        passwordHash: await argon2.hash(dto.password),
        phone: dto.phone,
        globalRole: dto.globalRole ?? GlobalRole.USER,
      },
      select: this.select,
    });
  }
  async update(companyId: string, id: string, dto: UpdateUserDto) {
    await this.findOne(companyId, id);
    const email = dto.email?.trim().toLowerCase();
    if (email) {
      const exists = await this.prisma.user.findFirst({
        where: { companyId, email, NOT: { id } },
      });
      if (exists) throw new ConflictException('Email already exists');
    }
    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        email,
        phone: dto.phone,
        globalRole: dto.globalRole,
      },
      select: this.select,
    });
  }
  async setStatus(companyId: string, id: string, active: boolean) {
    await this.findOne(companyId, id);
    return this.prisma.user.update({
      where: { id },
      data: { active },
      select: this.select,
    });
  }
  async setPassword(companyId: string, id: string, dto: AdminPasswordDto) {
    await this.findOne(companyId, id);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash: await argon2.hash(dto.password) },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }
}
