import {
  HttpErrorResponse,
  HttpEvent,
  HttpInterceptorFn,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { defer, finalize, Observable, shareReplay, switchMap, tap } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const active = new Map<string, Observable<HttpEvent<unknown>>>();

export const idempotencyInterceptor: HttpInterceptorFn = (req, next) => {
  const path = req.url.split('?')[0].replace(/\/+$/, '');
  if (
    req.method !== 'POST' ||
    !req.url.startsWith(`${environment.apiUrl}/`) ||
    !/\/(?:stock(?:-movements)?|cash|warehouse)(?:\/|$)|\/(?:close|finish)$/.test(path)
  )
    return next(req);
  const user = inject(AuthService).currentUser();
  // Hash the serialized JSON, matching the actual wire representation (including dates).
  const serializedBody = req.serializeBody();
  let body: unknown = serializedBody;
  if (typeof serializedBody === 'string') {
    try {
      body = JSON.parse(serializedBody || 'null');
    } catch {
      body = serializedBody;
    }
  }
  const identity = canonical([
    user?.company?.id,
    user?.id,
    req.method,
    req.urlWithParams,
    body,
    req.headers.get('Idempotency-Key'),
  ]);
  return defer(() => crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity))).pipe(
    switchMap((digest) => {
      const fingerprint =
        'vasoverde.idempotency.' +
        Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      const pending = active.get(fingerprint);
      if (pending) return pending;
      // Persist BEFORE sending. Storage failures fail closed; no mutation is sent
      // without a recoverable key. No timers, offline queue, or automatic retry.
      const key =
        req.headers.get('Idempotency-Key') ||
        localStorage.getItem(fingerprint) ||
        crypto.randomUUID();
      localStorage.setItem(fingerprint, key);
      const clear = () => {
        try {
          localStorage.removeItem(fingerprint);
        } catch {
          /* retain safely */
        }
      };
      const shared = defer(() => next(req.clone({ setHeaders: { 'Idempotency-Key': key } }))).pipe(
        tap({
          next: (event) => {
            if (event instanceof HttpResponse) clear();
          },
          error: (error: unknown) => {
            if (
              error instanceof HttpErrorResponse &&
              error.status >= 400 &&
              error.status < 500 &&
              error.status !== 408 &&
              error.error?.code !== 'IDEMPOTENCY_UNRESOLVED' &&
              error.error?.code !== 'IDEMPOTENCY_BODY_MISMATCH'
            )
              clear();
          },
        }),
        finalize(() => active.delete(fingerprint)),
        // A disappearing UI subscriber must not cancel an already dispatched write.
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      active.set(fingerprint, shared);
      return shared;
    }),
  );
};
