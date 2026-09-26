import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { EventsService } from '../../core/services/events.service';
import { EventModel } from '../../core/models/event.model';

@Component({
  selector: 'app-event-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.scss',
})
export class EventFormComponent {
  private readonly api = inject(EventsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly saving = signal(false);
  readonly eventId = this.route.snapshot.paramMap.get('eventId');
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    description: [''],
    location: [''],
    status: ['DRAFT', Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
  });
  constructor() {
    if (this.eventId) this.api.get(this.eventId).subscribe((event) => this.fill(event));
  }
  private fill(event: EventModel) {
    this.form.patchValue({
      name: event.name,
      code: event.code,
      description: event.description || '',
      location: event.location || '',
      status: event.status,
      startDate: event.startDate.slice(0, 10),
      endDate: event.endDate.slice(0, 10),
    });
  }
  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const request = this.eventId
      ? this.api.update(this.eventId, this.form.getRawValue())
      : this.api.create(this.form.getRawValue());
    request.subscribe({
      next: (event) => void this.router.navigate(['/events', event.id]),
      error: () => this.saving.set(false),
    });
  }
}
