import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { EventsService } from '../../core/services/events.service';
import { UsersService } from '../../core/services/users.service';
import { Bar, Booth } from '../../core/models/event.model';

@Component({
  selector: 'app-bars',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSelectModule,
  ],
  templateUrl: './bars.component.html',
  styleUrl: './bars.component.scss',
})
export class BarsComponent {
  private readonly api = inject(EventsService);
  private readonly users = inject(UsersService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly bars = signal<Bar[]>([]);
  readonly booths = signal<Booth[]>([]);
  readonly clients = signal<Array<{ id: string; name: string; email: string }>>([]);
  readonly loading = signal(true);
  readonly showForm = signal(false);
  private readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    code: ['', Validators.required],
    description: [''],
    boothId: [null as string | null],
    clientUserId: [null as string | null],
  });
  constructor() {
    this.load();
    this.users
      .candidates(this.eventId)
      .subscribe((users) => this.clients.set(users.filter((user) => user.globalRole === 'CLIENT')));
  }
  load() {
    this.api
      .bars(this.eventId)
      .subscribe({
        next: (value) => this.bars.set(value),
        complete: () => this.loading.set(false),
      });
    this.api.booths(this.eventId).subscribe((value) => this.booths.set(value));
  }
  save() {
    if (this.form.invalid) return;
    this.api.createBar(this.eventId, this.form.getRawValue()).subscribe(() => {
      this.form.reset({ name: '', code: '', description: '', boothId: null, clientUserId: null });
      this.showForm.set(false);
      this.load();
    });
  }
}
