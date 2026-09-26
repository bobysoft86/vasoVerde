import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AppUser, EventSummary } from '../../core/models/auth.model';
import { UsersService } from '../../core/services/users.service';

@Component({
  selector: 'app-users',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent {
  private readonly api = inject(UsersService);
  private readonly fb = inject(FormBuilder);
  readonly users = signal<AppUser[]>([]);
  readonly events = signal<EventSummary[]>([]);
  readonly query = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly editing = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly columns = ['name', 'role', 'status', 'events', 'actions'];
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    password: ['', [Validators.required, Validators.minLength(8)]],
    globalRole: ['USER'],
  });
  constructor() {
    this.load();
  }
  filteredUsers() {
    const q = this.query().toLowerCase();
    return this.users().filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(q));
  }
  load() {
    this.loading.set(true);
    this.api
      .list()
      .subscribe({
        next: (users) => this.users.set(users),
        error: () => this.users.set([]),
        complete: () => this.loading.set(false),
      });
  }
  startCreate() {
    this.editingId.set(null);
    this.form.reset({ name: '', email: '', phone: '', password: '', globalRole: 'USER' });
    this.form.controls.password.setValidators([Validators.required, Validators.minLength(8)]);
    this.form.controls.password.updateValueAndValidity();
    this.editing.set(true);
  }
  edit(user: AppUser) {
    this.editingId.set(user.id);
    this.form.reset({
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      password: '',
      globalRole: user.globalRole,
    });
    this.form.controls.password.clearValidators();
    this.form.controls.password.updateValueAndValidity();
    this.editing.set(true);
  }
  cancel() {
    this.editing.set(false);
  }
  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    const value = this.form.getRawValue();
    const request = this.editingId()
      ? this.api.update(this.editingId()!, {
          name: value.name,
          email: value.email,
          phone: value.phone,
          globalRole: value.globalRole,
        })
      : this.api.create(value);
    request.subscribe({
      next: () => {
        this.load();
        this.cancel();
      },
      error: () => {},
      complete: () => this.saving.set(false),
    });
  }
  toggle(user: AppUser) {
    this.api.setStatus(user.id, !user.active).subscribe(() => this.load());
  }
}
