import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { EventsService } from '../../core/services/events.service';
import { EventModel } from '../../core/models/event.model';
@Component({
  selector: 'app-events-list',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './events-list.component.html',
  styleUrl: './events-list.component.scss',
})
export class EventsListComponent {
  private readonly api = inject(EventsService);
  readonly events = signal<EventModel[]>([]);
  readonly loading = signal(true);
  constructor() {
    this.load();
  }
  load(search = '') {
    this.loading.set(true);
    this.api
      .list(search)
      .subscribe({
        next: (data) => this.events.set(data),
        error: () => this.events.set([]),
        complete: () => this.loading.set(false),
      });
  }
  search(value: string) {
    this.load(value);
  }
}
