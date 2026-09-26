import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { GlobalRole, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

type TokenResponse = {
  accessToken: string;
  user: { id: string; name: string; email: string; globalRole: GlobalRole };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private publicUser(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      globalRole: user.globalRole,
    };
  }
  private async accessToken(user: User) {
    return this.jwt.signAsync(
      {
        sub: user.id,
        companyId: user.companyId,
        email: user.email,
        globalRole: user.globalRole,
      },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>(
          'JWT_ACCESS_EXPIRES_IN',
          '15m',
        ) as JwtSignOptions['expiresIn'],
      },
    );
  }
  private async issueRefreshToken(
    userId: string,
    userAgent?: string,
    ipAddress?: string,
  ) {
    const id = randomUUID();
    const raw = await this.jwt.signAsync(
      { sub: userId, sessionId: id },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>(
          'JWT_REFRESH_EXPIRES_IN',
          '7d',
        ) as JwtSignOptions['expiresIn'],
      },
    );
    const tokenHash = await argon2.hash(raw);
    const expiresAt = new Date(
      Date.now() +
        this.durationMs(
          this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
        ),
    );
    await this.prisma.refreshToken.create({
      data: { id, userId, tokenHash, expiresAt, userAgent, ipAddress },
    });
    return raw;
  }
  private durationMs(value: string) {
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 86400000;
    const n = Number(match[1]);
    return (
      n *
      (
        { s: 1000, m: 60000, h: 3600000, d: 86400000 } as Record<string, number>
      )[match[2]]
    );
  }

  async login(
    dto: LoginDto,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<TokenResponse & { refreshToken: string }> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email, active: true, deletedAt: null },
    });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password)))
      throw new UnauthorizedException('Invalid credentials');
    return {
      accessToken: await this.accessToken(user),
      refreshToken: await this.issueRefreshToken(user.id, userAgent, ipAddress),
      user: this.publicUser(user),
    };
  }

  async refresh(
    raw: string | undefined,
    userAgent?: string,
    ipAddress?: string,
  ) {
    if (!raw)
      throw new UnauthorizedException('Invalid or expired refresh token');
    let payload: { sub: string; sessionId: string };
    try {
      payload = await this.jwt.verifyAsync(raw, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    const session = await this.prisma.refreshToken.findUnique({
      where: { id: payload.sessionId },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      session.user.deletedAt ||
      !session.user.active ||
      !(await argon2.verify(session.tokenHash, raw))
    )
      throw new UnauthorizedException('Invalid or revoked refresh token');
    await this.prisma.refreshToken.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
    const accessToken = await this.accessToken(session.user);
    const refreshToken = await this.issueRefreshToken(
      session.user.id,
      userAgent,
      ipAddress,
    );
    return { accessToken, refreshToken, user: this.publicUser(session.user) };
  }

  async logout(raw?: string) {
    if (!raw) return;
    try {
      const payload = await this.jwt.verifyAsync<{ sessionId: string }>(raw, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        ignoreExpiration: true,
      });
      await this.prisma.refreshToken.updateMany({
        where: { id: payload.sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch {
      /* logout is idempotent */
    }
  }
  async logoutAll(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        company: true,
        eventMemberships: {
          include: { event: true },
          orderBy: { assignedAt: 'asc' },
        },
      },
    });
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      active: user.active,
      globalRole: user.globalRole,
      company: { id: user.company.id, name: user.company.name },
      events: user.eventMemberships.map((m) => ({
        eventId: m.eventId,
        eventName: m.event.name,
        role: m.role,
      })),
    };
  }
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!(await argon2.verify(user.passwordHash, dto.currentPassword)))
      throw new UnauthorizedException('Current password is invalid');
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(dto.newPassword) },
    });
    await this.logoutAll(userId);
  }
}
