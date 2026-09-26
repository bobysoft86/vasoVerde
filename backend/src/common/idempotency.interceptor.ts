import { BadRequestException, CallHandler, ConflictException, ExecutionContext, HttpException, Injectable, NestInterceptor, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { defer, lastValueFrom } from 'rxjs';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from './types/auth-request';

export function protectedWrite(method: string, path: string): boolean {
  return method === 'POST' && /\/(?:stock(?:-movements)?|cash|warehouse)(?:\/|$)|\/(?:close|finish)$/.test(path);
}

export function canonicalBody(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalBody).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalBody((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();
    const path = request.path.replace(/\/+$/, '');
    if (!protectedWrite(request.method, path)) return next.handle();
    return defer(async () => {
      const key = request.headers['idempotency-key'];
      if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
        throw new BadRequestException('A valid Idempotency-Key (16–128 letters, digits, _ or -) is required');
      }
      if (!request.user?.companyId || !request.user?.sub) throw new UnauthorizedException();
      const scopeHash = hash(JSON.stringify([request.user.companyId, request.user.sub, request.method, path, key]));
      // Include query parameters so a changed query cannot silently reuse a response.
      const bodyHash = hash(canonicalBody({ body: request.body ?? null, query: request.query }));
      try {
        await this.prisma.idempotencyRecord.create({ data: {
          scopeHash, bodyHash, companyId: request.user.companyId, userId: request.user.sub,
          method: request.method, path, state: 'PENDING',
        } });
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002') throw error;
        const existing = await this.prisma.idempotencyRecord.findUniqueOrThrow({ where: { scopeHash } });
        if (existing.bodyHash !== bodyHash) throw new ConflictException({ code: 'IDEMPOTENCY_BODY_MISMATCH', message: 'This key belongs to a different request' });
        if (existing.state !== 'COMPLETED') throw new ConflictException({ code: 'IDEMPOTENCY_UNRESOLVED', message: 'Operation is in progress or its outcome is unknown. Reconcile before creating a new operation.' });
        response.status(existing.statusCode!);
        const body: unknown = JSON.parse(existing.responseBody!);
        if (existing.statusCode! >= 400) throw new HttpException(body as object, existing.statusCode!);
        return body;
      }

      // Reservation and business writes use separate transactions. Never reclaim a
      // pending key: a crash may have occurred after the business transaction committed.
      let body: unknown;
      try {
        body = await lastValueFrom(next.handle());
      } catch (error) {
        // Only definitive client errors are safe to record as finished. Server errors
        // leave the reservation unresolved, even when a partial write is possible.
        if (error instanceof HttpException && error.getStatus() >= 400 && error.getStatus() < 500) {
          const result = error.getResponse();
          await this.complete(scopeHash, error.getStatus(), typeof result === 'string'
            ? { statusCode: error.getStatus(), message: result } : result);
        }
        throw error;
      }
      await this.complete(scopeHash, response.statusCode, body ?? null);
      return body;
    });
  }

  private async complete(scopeHash: string, statusCode: number, body: unknown) {
    await this.prisma.idempotencyRecord.update({ where: { scopeHash }, data: {
      state: 'COMPLETED', statusCode, responseBody: JSON.stringify(body),
    } });
  }
}
