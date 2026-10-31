import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-change-password',
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  template: `<mat-card class="password-card"><h1>Cambia tu contraseña</h1><p>Por seguridad, cambia la contraseña temporal antes de continuar.</p>
    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-form-field appearance="outline"><mat-label>Contraseña temporal actual</mat-label><input matInput type="password" formControlName="currentPassword" autocomplete="current-password" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Nueva contraseña</mat-label><input matInput type="password" formControlName="newPassword" autocomplete="new-password" /><mat-hint>Mínimo 8 caracteres</mat-hint></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Repite la contraseña</mat-label><input matInput type="password" formControlName="confirmPassword" autocomplete="new-password" /></mat-form-field>
      <p class="error" role="alert" *ngIf="error()">{{ error() }}</p>
      <p class="success" role="status" *ngIf="done()">Contraseña actualizada. Inicia sesión con tu nueva contraseña.</p>
      <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || loading() || done()">{{ loading() ? 'Guardando…' : 'Actualizar contraseña' }}</button>
      <button *ngIf="done()" mat-button type="button" (click)="goLogin()">Ir al inicio de sesión</button>
    </form></mat-card>`,
  styles: [`.password-card{max-width:520px;margin:48px auto;padding:28px}.password-card form{display:grid;gap:12px}.password-card h1{color:#20382b}.password-card p{color:#68796f}.error{color:#b3261e!important}.success{color:#26714c!important}`],
})
export class ChangePasswordComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly done = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  });
  submit() {
    const { currentPassword, newPassword, confirmPassword } = this.form.getRawValue();
    if (this.form.invalid || newPassword !== confirmPassword) { this.error.set('Comprueba que la nueva contraseña coincide y tiene al menos 8 caracteres.'); return; }
    this.loading.set(true); this.error.set('');
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => { this.loading.set(false); this.done.set(true); },
      error: (err) => { this.loading.set(false); this.error.set(err?.error?.message || 'No se pudo cambiar la contraseña.'); },
    });
  }
  goLogin() { this.auth.logout().subscribe(() => void this.router.navigateByUrl('/login')); }
}
