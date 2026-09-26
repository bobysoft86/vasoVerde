import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, firstValueFrom, Observable, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, AuthUser } from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly token = signal<string | null>(null);
  readonly currentUser = signal<AuthUser | null>(null);
  readonly checkingSession = signal(true);
  readonly isAuthenticated = computed(() => !!this.currentUser());
  private refreshRequest?: Observable<AuthResponse>;

  constructor() {
    void this.restoreSession();
  }
  getAccessToken() {
    return this.token();
  }
  login(email: string, password: string) {
    return this.http
      .post<AuthResponse>(
        `${environment.apiUrl}/auth/login`,
        { email, password },
        { withCredentials: true },
      )
      .pipe(tap((response) => this.setSession(response)));
  }
  refresh() {
    if (!this.refreshRequest)
      this.refreshRequest = this.http
        .post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, {}, { withCredentials: true })
        .pipe(
          tap((response) => this.setSession(response)),
          shareReplay(1),
        );
    return this.refreshRequest.pipe(
      tap({
        complete: () => {
          this.refreshRequest = undefined;
        },
        error: () => {
          this.refreshRequest = undefined;
        },
      }),
    );
  }
  me() {
    return this.http
      .get<AuthUser>(`${environment.apiUrl}/auth/me`)
      .pipe(tap((user) => this.currentUser.set(user)));
  }
  logout() {
    return this.http.post(`${environment.apiUrl}/auth/logout`, {}, { withCredentials: true }).pipe(
      catchError(() => of(null)),
      tap(() => this.clearSession()),
    );
  }
  async restoreSession() {
    try {
      const response = await firstValueFrom(this.refresh());
      this.setSession(response);
    } catch {
      this.clearSession();
    } finally {
      this.checkingSession.set(false);
    }
  }
  private setSession(response: AuthResponse) {
    this.token.set(response.accessToken);
    this.currentUser.set(response.user);
  }
  clearSession() {
    this.token.set(null);
    this.currentUser.set(null);
  }
}
