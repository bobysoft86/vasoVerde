import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { UsersService } from '../core/services/users.service';
import { AppUser } from '../core/models/auth.model';

@Component({
  selector: 'app-quick-user-create',
  imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './quick-user-create.component.html',
  styleUrl: './quick-user-create.component.scss',
})
export class QuickUserCreateComponent {
  private readonly users = inject(UsersService);
  @Input({ required: true }) eventId = '';
  @Input() globalRole = 'USER';
  @Input() eventRole = 'OPERATOR';
  @Output() created = new EventEmitter<AppUser>();
  @Output() cancelled = new EventEmitter<void>();
  readonly saving = signal(false);
  readonly error = signal('');
  name = '';
  email = '';
  password = '';
  phone = '';

  submit() {
    if (this.saving() || this.name.trim().length < 2 || !this.email.trim() || this.password.length < 8) return;
    this.saving.set(true);
    this.error.set('');
    this.users.createForEvent(this.eventId, {
      name: this.name.trim(), email: this.email.trim(), password: this.password,
      phone: this.phone.trim() || undefined, globalRole: this.globalRole, eventRole: this.eventRole,
    }).subscribe({
      next: (user) => { this.saving.set(false); this.created.emit(user); },
      error: (err) => {
        this.saving.set(false);
        const message = err?.error?.message;
        this.error.set(Array.isArray(message) ? message.join(' · ') : message || 'No se pudo crear el usuario.');
      },
    });
  }
}
