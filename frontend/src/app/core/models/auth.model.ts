export interface AuthUser {
  id: string;
  name: string;
  email: string;
  active: boolean;
  globalRole: 'SUPER_ADMIN' | 'ADMIN' | 'USER' | 'CLIENT' | 'WORKER' | 'RESPONSIBLE';
  company?: { id: string; name: string };
  events?: Array<{ eventId: string; eventName: string; role: string }>;
}
export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}
export interface AppUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  active: boolean;
  globalRole: string;
  eventMemberships: Array<{
    eventId: string;
    role: string;
    event: { id: string; name: string; code: string };
  }>;
}
export interface EventSummary {
  id: string;
  name: string;
  code: string;
  status: string;
}
