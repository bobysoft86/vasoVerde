import { Request } from 'express';
import { GlobalRole } from '@prisma/client';

export interface AuthUser {
  sub: string;
  companyId: string;
  email: string;
  globalRole: GlobalRole;
  sessionId?: string;
}

export type AuthenticatedRequest = Request & { user: AuthUser };
