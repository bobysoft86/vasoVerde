import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CupType, Location } from '../../core/models/event.model';
import { EventsService } from '../../core/services/events.service';

type Condition = 'CLEAN' | 'DIRTY' | 'DAMAGED';

@Component({
  selector: 'app-location-closures',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './location-closures.component.html',
  styleUrl: './location-closures.component.scss',
})
export class LocationClosuresComponent {
  private readonly api = inject(EventsService);
  private readonly route = inject(ActivatedRoute);
  private readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  readonly sources = signal<Location[]>([]);
  readonly destinations = signal<Location[]>([]);
  readonly cups = signal<CupType[]>([]);
  readonly error = signal('');
  readonly success = signal(false);
  counts: Record<string, Record<Condition, number>> = {};
  sourceId = '';
  destinationId = '';
  notes = '';
  saving = false;
  constructor() {
    this.api.locations(this.eventId).subscribe((locations) => {
      this.sources.set(locations.filter((location) => ['BAR', 'BOOTH'].includes(location.type)));
      this.destinations.set(
        locations.filter((location) =>
          ['CENTRAL_WAREHOUSE', 'EVENT_WAREHOUSE', 'BOOTH'].includes(location.type),
        ),
      );
    });
    this.api.cupTypes().subscribe((cups) => {
      this.cups.set(cups);
      for (const cup of cups) this.counts[cup.id] = { CLEAN: 0, DIRTY: 0, DAMAGED: 0 };
    });
  }
  save() {
    const items = this.cups().flatMap((cup) =>
      (['CLEAN', 'DIRTY', 'DAMAGED'] as Condition[])
        .filter((condition) => Number(this.counts[cup.id]?.[condition]) > 0)
        .map((condition) => ({
          cupTypeId: cup.id,
          condition,
          quantity: Number(this.counts[cup.id][condition]),
        })),
    );
    if (!this.sourceId || !this.destinationId) {
      this.error.set('Selecciona origen y destino.');
      return;
    }
    this.saving = true;
    this.error.set('');
    this.api
      .closeLocation(this.eventId, this.sourceId, {
        destinationLocationId: this.destinationId,
        items,
        notes: this.notes,
        generateDeliveryNote: items.length > 0,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.success.set(true);
        },
        error: (err) => {
          this.saving = false;
          this.error.set(err?.error?.message || 'No se pudo cerrar la ubicación.');
        },
      });
  }
}
