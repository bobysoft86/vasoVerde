import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { EventsService } from '../../core/services/events.service';
import { Booth } from '../../core/models/event.model';
@Component({
  selector: 'app-booths',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  templateUrl: './booths.component.html',
  styleUrl: './booths.component.scss',
})
export class BoothsComponent {
  private readonly api = inject(EventsService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly booths = signal<Booth[]>([]);
  readonly loading = signal(true);
  readonly showForm = signal(false);
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    code: ['', [Validators.required]],
    description: [''],
  });
  private eventId = '';
  constructor() {
    this.eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
    this.load();
  }
  load() {
    this.api
      .booths(this.eventId)
      .subscribe({ next: (v) => this.booths.set(v), complete: () => this.loading.set(false) });
  }
  save() {
    if (this.form.invalid) return;
    this.api.createBooth(this.eventId, this.form.getRawValue()).subscribe(() => {
      this.form.reset();
      this.showForm.set(false);
      this.load();
    });
  }
}
