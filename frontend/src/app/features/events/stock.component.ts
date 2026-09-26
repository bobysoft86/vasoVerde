import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { EventsService } from '../../core/services/events.service';
import { Location, StockItem, StockResponse } from '../../core/models/event.model';

@Component({
  selector: 'app-stock',
  imports: [
    CommonModule,
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
  private readonly route = inject(ActivatedRoute);
  private readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  readonly stock = signal<StockResponse | null>(null);
  readonly locations = signal<Location[]>([]);
  readonly selected = signal<{ location: Location; items: StockItem[] } | null>(null);
  constructor() {
    this.api.stock(this.eventId).subscribe((value) => this.stock.set(value));
    this.api.locations(this.eventId).subscribe((value) => this.locations.set(value));
  }
  selectLocation(id: string) {
    if (!id) {
      this.selected.set(null);
      return;
    }
    this.api.locationStock(this.eventId, id).subscribe((value) => this.selected.set(value));
  }
}
