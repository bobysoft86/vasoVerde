import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { UsersService } from '../../core/services/users.service';
import { AppUser } from '../../core/models/auth.model';

interface Assignment {
  userId: string;
  role: string;
  user: { id: string; name: string; email: string; active: boolean };
}
@Component({
  selector: 'app-event-users',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
  ],
  templateUrl: './event-users.component.html',
  styleUrl: './event-users.component.scss',
})
export class EventUsersComponent {
  private readonly api = inject(UsersService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  readonly assignments = signal<Assignment[]>([]);
  readonly users = signal<AppUser[]>([]);
  readonly form = this.fb.nonNullable.group({
    userId: ['', Validators.required],
    role: ['OPERATOR', Validators.required],
  });
  constructor() {
    this.load();
    this.api
      .candidates(this.eventId)
      .subscribe({
        next: (value) => this.users.set(value as AppUser[]),
        error: () => this.users.set([]),
      });
  }
  availableUsers() {
    const assigned = new Set(this.assignments().map((item) => item.userId));
    return this.users().filter((user) => !assigned.has(user.id) && user.active);
  }
  load() {
    this.api
      .assignments(this.eventId)
      .subscribe({ next: (value) => this.assignments.set(value as Assignment[]) });
  }
  assign() {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.api.assign(this.eventId, value.userId, value.role).subscribe(() => {
      this.form.reset({ userId: '', role: 'OPERATOR' });
      this.load();
    });
  }
  remove(userId: string) {
    this.api.remove(this.eventId, userId).subscribe(() => this.load());
  }
}
