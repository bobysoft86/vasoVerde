import { DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, Subject, catchError, finalize, merge, switchMap, timer } from 'rxjs';

/** Component-owned polling: no queued writes, and no timers/listeners after navigation. */
export class OperationalState {
  readonly destroyRef = inject(DestroyRef);
  readonly offline = signal(typeof navigator !== 'undefined' && !navigator.onLine);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly readError = signal('');
  private readonly refreshes = new Subject<void>();

  constructor() {
    if (typeof window === 'undefined') return;
    const connectionChanged = () => {
      this.offline.set(!navigator.onLine);
      this.refresh();
    };
    window.addEventListener('online', connectionChanged);
    window.addEventListener('offline', connectionChanged);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('online', connectionChanged);
      window.removeEventListener('offline', connectionChanged);
    });
  }

  watch<T>(read: () => Observable<T>, receive: (value: T) => void) {
    merge(timer(0, 15_000), this.refreshes).pipe(
      switchMap(() => {
        if (this.offline() || this.busy()) {
          this.loading.set(false);
          return EMPTY;
        }
        return read().pipe(
          catchError(() => {
            this.readError.set('No se pudieron actualizar los datos. Reintentando automáticamente.');
            return EMPTY;
          }),
          finalize(() => this.loading.set(false)),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe((value) => {
      this.readError.set('');
      receive(value);
    });
  }

  refresh() { this.refreshes.next(); }

  beginWrite() {
    if (this.busy() || this.offline() || this.loading() || this.readError()) return false;
    this.busy.set(true);
    this.refresh(); // Cancel pending reads before a write can change their result.
    return true;
  }

  endWrite() {
    this.busy.set(false);
    if (!this.destroyRef.destroyed) this.refresh();
  }
}
