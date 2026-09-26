import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { EventsService } from '../../core/services/events.service';
import { StockMovement } from '../../core/models/event.model';

@Component({
  selector: 'app-movements',
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule],
  templateUrl: './movements.component.html',
  styleUrl: './movements.component.scss',
})
export class MovementsComponent {
  private readonly api = inject(EventsService);
  private readonly route = inject(ActivatedRoute);
  private readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  readonly movements = signal<StockMovement[]>([]);
  readonly loading = signal(true);
  constructor() {
    this.api
      .movements(this.eventId)
      .subscribe({
        next: (value) => this.movements.set(value.items),
        complete: () => this.loading.set(false),
      });
  }
}
