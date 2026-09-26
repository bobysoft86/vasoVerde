import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CashSession } from '../../core/models/cash.model';
import { CashService } from '../../core/services/cash.service';

@Component({
  selector: 'app-cash-transfer',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './cash-transfer.component.html',
  styleUrl: './cash-transfer.component.scss',
})
export class CashTransferComponent {
  private readonly api = inject(CashService);
  private readonly route = inject(ActivatedRoute);
  private readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  readonly sessions = signal<CashSession[]>([]);
  readonly error = signal('');
  readonly success = signal(false);
  originSessionId = '';
  destinationSessionId = '';
  amount = 0;
  concept = 'Transferencia entre cajas';
  notes = '';
  saving = false;
  constructor() {
    this.api
      .sessions(this.eventId)
      .subscribe((sessions) =>
        this.sessions.set(sessions.filter((session) => session.status === 'OPEN')),
      );
  }
  save() {
    if (
      !this.originSessionId ||
      !this.destinationSessionId ||
      this.originSessionId === this.destinationSessionId ||
      this.amount <= 0
    ) {
      this.error.set('Selecciona dos cajas abiertas distintas e indica un importe válido.');
      return;
    }
    this.saving = true;
    this.error.set('');
    this.api
      .transfer(this.eventId, {
        originSessionId: this.originSessionId,
        destinationSessionId: this.destinationSessionId,
        amount: Number(this.amount),
        concept: this.concept,
        notes: this.notes,
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.success.set(true);
          this.amount = 0;
        },
        error: (err) => {
          this.saving = false;
          this.error.set(err?.error?.message || 'No se pudo transferir el efectivo.');
        },
      });
  }
}
