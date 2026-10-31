import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { EventsService } from '../../core/services/events.service';
import { AuthService } from '../../core/services/auth.service';
import { CupType, Location, StockItem, StockResponse } from '../../core/models/event.model';

@Component({
  selector: 'app-stock',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  templateUrl: './stock.component.html',
  styleUrl: './stock.component.scss',
})
export class StockComponent {
  private readonly api = inject(EventsService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  readonly stock = signal<StockResponse | null>(null);
  readonly locations = signal<Location[]>([]);
  readonly selected = signal<{ location: Location; items: StockItem[] } | null>(null);
  readonly thresholds = signal<Array<{ locationId: string; cupTypeId: string; minimum: number }>>([]);
  readonly defaultMinimum = signal(100);
  readonly isManager = signal(false);
  readonly thresholdDraft = signal<Record<string, string>>({});
  readonly notice = signal('');
  readonly savingThreshold = signal(false);
  readonly cups = signal<CupType[]>([]);
  readonly countDraft = signal<Record<string, string>>({});
  readonly countHistory = signal<any[]>([]);
  readonly savingCount = signal(false);
  countNotes = '';
  readonly conditions = ['CLEAN', 'DIRTY', 'DAMAGED'];
  constructor() {
    const user = this.auth.currentUser();
    const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user?.globalRole ?? '');
    this.isManager.set(isAdmin);
    this.api.eventMembers(this.eventId).subscribe((members) => {
      if (isAdmin || members.some((member) => member.userId === user?.id && member.role === 'EVENT_MANAGER')) this.isManager.set(true);
    });
    this.api.stock(this.eventId).subscribe((value) => this.stock.set(value));
    this.api.locations(this.eventId).subscribe((value) => this.locations.set(value));
    this.loadThresholds();
    this.api.cupTypes().subscribe((rows) => this.cups.set(rows.filter((cup) => !cup.ownerEventId || cup.ownerEventId === this.eventId)));
    this.api.stockCounts(this.eventId).subscribe((rows) => this.countHistory.set(rows));
  }
  loadThresholds() {
    this.api.stockThresholds(this.eventId).subscribe(({ defaultMinimum, items }) => {
      this.defaultMinimum.set(defaultMinimum); this.thresholds.set(items);
    });
  }
  minimum(locationId: string, cupTypeId: string) {
    return this.thresholds().find((item) => item.locationId === locationId && item.cupTypeId === cupTypeId)?.minimum ?? this.defaultMinimum();
  }
  setThresholdDraft(cupTypeId: string, value: string) {
    this.thresholdDraft.update((draft) => ({ ...draft, [cupTypeId]: value }));
  }
  saveThreshold(cupTypeId: string) {
    const locationId = this.selected()?.location.id;
    const minimum = Number(this.thresholdDraft()[cupTypeId]);
    if (!locationId || !Number.isInteger(minimum) || minimum < 0) { this.notice.set('Indica un mínimo entero igual o superior a cero.'); return; }
    this.savingThreshold.set(true); this.notice.set('');
    this.api.setStockThreshold(this.eventId, locationId, cupTypeId, minimum).subscribe({
      next: () => { this.savingThreshold.set(false); this.notice.set('Mínimo actualizado.'); this.loadThresholds(); },
      error: () => { this.savingThreshold.set(false); this.notice.set('No se pudo guardar el mínimo.'); },
    });
  }
  selectLocation(id: string) {
    if (!id) {
      this.selected.set(null);
      return;
    }
    this.api.locationStock(this.eventId, id).subscribe((value) => {
      this.selected.set(value);
      const draft: Record<string, string> = {};
      for (const cup of this.cups()) for (const condition of this.conditions) draft[`${cup.id}:${condition}`] = '';
      this.countDraft.set(draft);
    });
  }
  expected(cupTypeId: string, condition: string) {
    return this.selected()?.items.find((item) => item.cupTypeId === cupTypeId && item.condition === condition)?.quantity ?? 0;
  }
  countKey(cupTypeId: string, condition: string) { return `${cupTypeId}:${condition}`; }
  setCount(key: string, value: string) { this.countDraft.update((draft) => ({ ...draft, [key]: value })); }
  submitCount() {
    const locationId = this.selected()?.location.id;
    if (!locationId) return;
    const draft = this.countDraft();
    const lines = this.cups().flatMap((cup) => this.conditions.map((condition) => ({ cupTypeId: cup.id, condition, counted: Number(draft[this.countKey(cup.id, condition)]) })));
    if (!lines.length || Object.values(draft).some((value) => value === '') || lines.some((line) => !Number.isInteger(line.counted) || line.counted < 0)) { this.notice.set('Completa el recuento con cantidades enteras iguales o superiores a cero.'); return; }
    this.savingCount.set(true); this.notice.set('');
    this.api.createStockCount(this.eventId, locationId, { notes: this.countNotes, lines }).subscribe({
      next: (saved) => { this.savingCount.set(false); this.countNotes = ''; this.countHistory.update((rows) => [saved, ...rows]); this.notice.set(saved.lines.some((line: any) => line.difference !== 0) ? 'Recuento guardado. Hay diferencias que requieren revisión.' : 'Recuento guardado sin diferencias.'); },
      error: () => { this.savingCount.set(false); this.notice.set('No se pudo guardar el recuento. Comprueba que tienes acceso a esta ubicación.'); },
    });
  }
}
