import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { EventsService } from '../../core/services/events.service';
import { EventModel } from '../../core/models/event.model';
@Component({
  selector: 'app-event-detail',
  imports: [CommonModule, RouterOutlet, RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './event-detail.component.html',
  styleUrl: './event-detail.component.scss',
})
export class EventDetailComponent {
  private readonly api = inject(EventsService);
  private readonly route = inject(ActivatedRoute);
  readonly event = signal<EventModel | null>(null);
  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('eventId');
      if (id) this.api.get(id).subscribe((event) => this.event.set(event));
    });
  }
}
