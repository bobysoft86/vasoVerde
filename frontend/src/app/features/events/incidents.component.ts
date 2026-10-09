import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { EventsService } from '../../core/services/events.service';
import { IncidentItem, Location } from '../../core/models/event.model';

@Component({
  selector: 'app-incidents',
  imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './incidents.component.html',
  styleUrl: './incidents.component.scss',
})
export class IncidentsComponent {
  private readonly api = inject(EventsService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  readonly items = signal<IncidentItem[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly assignees = signal<Array<{ id: string; name: string }>>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly success = signal('');
  readonly isManager = signal(false);
  readonly showForm = signal(false);
  readonly kindFilter = signal('ALL');
  readonly draft = signal({ kind: 'INCIDENT', type: 'OPERATIONAL', priority: 'NORMAL', title: '', description: '', locationId: '' });
  readonly comments = signal<Record<string, string>>({});
  readonly saving = signal(false);

  constructor() {
    const user = this.auth.currentUser();
    const isAdmin = user?.globalRole === 'ADMIN' || user?.globalRole === 'SUPER_ADMIN';
    this.isManager.set(isAdmin);
    this.api.eventMembers(this.eventId).subscribe({
      next: (members) => {
        const role = members.find((member) => member.userId === user?.id)?.role;
        const canManage = isAdmin || role === 'EVENT_MANAGER';
        this.isManager.set(canManage);
        if (canManage) this.api.incidentAssignees(this.eventId).subscribe({ next: (rows) => this.assignees.set(rows) });
      },
    });
    this.api.locations(this.eventId).subscribe({ next: (rows) => this.locations.set(rows), error: () => undefined });
    this.reload();
  }

  visibleItems() {
    const filter = this.kindFilter();
    return this.items().filter((item) => filter === 'ALL' || item.kind === filter);
  }

  reload() {
    this.loading.set(true);
    this.api.incidents(this.eventId).subscribe({
      next: (rows) => { this.items.set(rows); this.loading.set(false); },
      error: () => { this.error.set('No se pudieron cargar los avisos.'); this.loading.set(false); },
    });
  }

  setDraft(key: keyof ReturnType<typeof this.draft>, value: string) {
    this.draft.update((draft) => ({ ...draft, [key]: value }));
  }

  submit() {
    const draft = this.draft();
    if (!draft.title.trim()) return;
    this.saving.set(true); this.error.set(''); this.success.set('');
    this.api.createIncident(this.eventId, { ...draft, locationId: draft.locationId || undefined }).subscribe({
      next: () => {
        this.draft.set({ kind: 'INCIDENT', type: 'OPERATIONAL', priority: 'NORMAL', title: '', description: '', locationId: '' });
        this.showForm.set(false); this.success.set('Se ha enviado correctamente.'); this.saving.set(false); this.reload();
      },
      error: () => { this.error.set('No se pudo enviar. Comprueba tu acceso e inténtalo de nuevo.'); this.saving.set(false); },
    });
  }

  update(item: IncidentItem, data: Record<string, string | null>) {
    this.api.updateIncident(this.eventId, item.id, data).subscribe({ next: () => this.reload(), error: () => this.error.set('No se pudo actualizar. Solo los responsables pueden cambiar la gestión.') });
  }

  addComment(item: IncidentItem) {
    const message = this.comments()[item.id]?.trim();
    if (!message) return;
    this.api.commentIncident(this.eventId, item.id, message).subscribe({
      next: () => { this.comments.update((all) => ({ ...all, [item.id]: '' })); this.reload(); },
      error: () => this.error.set('No se pudo añadir el comentario.'),
    });
  }

  setComment(id: string, value: string) { this.comments.update((all) => ({ ...all, [id]: value })); }
  statusLabel(status: string) { return ({ OPEN: 'Abierta', IN_PROGRESS: 'En curso', RESOLVED: 'Resuelta', CANCELLED: 'Cancelada' } as Record<string, string>)[status] ?? status; }
  typeLabel(type: string) { return ({ STOCK: 'Stock', OPERATIONAL: 'Operativa', CASH: 'Caja', SAFETY: 'Seguridad', OTHER: 'Otra' } as Record<string, string>)[type] ?? type; }
  priorityLabel(priority: string) { return ({ NORMAL: 'Normal', HIGH: 'Alta', URGENT: 'Urgente' } as Record<string, string>)[priority] ?? priority; }
}
