import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { environment } from '../../../environments/environment';

interface ClosureChecklist {
  eventId: string;
  status: string;
  canManage: boolean;
  ready: boolean;
  blockers: { pendingLocations: number; openCashSessions: number; unsignedNotes: number; dirtyStock: number };
  pendingLocations: { id: string; name: string; type: string }[];
  unsignedNotes: { id: string; number: string }[];
}

@Component({
  selector: 'app-event-close',
  imports: [RouterLink, MatButtonModule],
  templateUrl: './event-close.component.html',
  styleUrl: './event-close.component.scss',
})
export class EventCloseComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? this.route.snapshot.paramMap.get('eventId') ?? '';
  readonly checklist = signal<ClosureChecklist | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal(false);
  private readonly url = `${environment.apiUrl}/events/${this.eventId}`;

  constructor() { this.refresh(); }

  refresh(clearError = true) {
    this.loading.set(true);
    if (clearError) this.error.set('');
    this.http.get<ClosureChecklist>(`${this.url}/closure-checklist`).subscribe({
      next: (value) => { this.checklist.set(value); this.loading.set(false); },
      error: () => { this.checklist.set(null); this.loading.set(false); this.error.set('No se pudo cargar el cierre. Vuelve a intentarlo.'); },
    });
  }

  finish() {
    const data = this.checklist();
    if (!data?.ready || !data.canManage || this.saving() || this.loading() || this.isTerminal(data.status)) return;
    this.saving.set(true);
    this.error.set('');
    this.http.post(`${this.url}/finish`, {}).subscribe({
      next: () => { this.saving.set(false); this.success.set(true); this.refresh(); },
      error: () => {
        this.saving.set(false);
        this.error.set('No se pudo finalizar. Revisa los pendientes y tus permisos.');
        this.refresh(false);
      },
    });
  }

  isTerminal(status: string) { return ['FINISHED', 'ARCHIVED', 'CANCELLED'].includes(status); }
}
