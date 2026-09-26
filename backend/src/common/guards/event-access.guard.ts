import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedRequest } from '../types/auth-request';

@Injectable()
export class EventAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const eventId = String(request.params.eventId);
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        companyId: request.user.companyId,
        deletedAt: null,
      },
    });
    if (!event) throw new NotFoundException('Event not found');
    if (
      request.user.globalRole === GlobalRole.ADMIN ||
      request.user.globalRole === GlobalRole.SUPER_ADMIN
    )
      return true;
    const membership = await this.prisma.eventUser.findUnique({
      where: { eventId_userId: { eventId, userId: request.user.sub } },
    });
    if (!membership)
      throw new ForbiddenException('You do not have access to this event');
    return true;
  }
}
