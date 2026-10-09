import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CashMovementType, CashSession } from '../../core/models/cash.model';
import { CupType, Location } from '../../core/models/event.model';
import { EventsService } from '../../core/services/events.service';
import { CashService } from '../../core/services/cash.service';

@Component({
  selector: 'app-cash',
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
  templateUrl: './cash.component.html',
  styleUrl: './cash.component.scss',
})
export class CashComponent {
  private readonly api = inject(CashService);
  private readonly events = inject(EventsService);
  private readonly route = inject(ActivatedRoute);
  private readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  readonly sessions = signal<CashSession[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly cups = signal<CupType[]>([]);
  readonly error = signal('');
  openLocationId = '';
  openingAmount = 0;
  selected?: CashSession;
  movementType: CashMovementType = 'REFUND';
  movementAmount = 1;
  movementConcept = 'Devolución de vaso';
  refundCupTypeId = '';
  refundCupQuantity = 1;
  readonly movementTypes: CashMovementType[] = [
    'REFUND',
    'SALE',
    'CASH_IN',
    'COLLECTION',
    'WITHDRAWAL',
    'EXPENSE',
    'CASH_OUT',
    'ADJUSTMENT',
  ];
  readonly labels: Record<string, string> = {
    REFUND: 'Devolución de vaso',
    CASH_IN: 'Entrada de efectivo',
    COLLECTION: 'Recaudación',
    WITHDRAWAL: 'Retirada',
    EXPENSE: 'Gasto',
    CASH_OUT: 'Salida de efectivo',
    ADJUSTMENT: 'Ajuste',
    SALE: 'Venta de vaso',
  };
  constructor() {
    this.load();
    this.events
      .locations(this.eventId)
      .subscribe((locations) =>
        this.locations.set(
          locations.filter((location) =>
            ['CENTRAL_WAREHOUSE', 'EVENT_WAREHOUSE', 'BOOTH', 'BAR'].includes(location.type),
          ),
        ),
      );
    this.events.cupTypes().subscribe((cups) => this.cups.set(cups.filter(cup => cup.active && (!cup.ownerEventId || cup.ownerEventId === this.eventId))));
  }
  load() {
    this.api.sessions(this.eventId).subscribe((sessions) => this.sessions.set(sessions));
  }
  open() {
    if (!this.openLocationId || this.openingAmount < 0) return;
    this.api
      .open(this.eventId, {
        locationId: this.openLocationId,
        openingAmount: Number(this.openingAmount),
      })
      .subscribe({
        next: () => {
          this.openLocationId = '';
          this.openingAmount = 0;
          this.load();
        },
        error: (err) => this.error.set(err?.error?.message || 'No se pudo abrir la caja.'),
      });
  }
  addMovement(session: CashSession) {
    const data = {
      type: this.movementType,
      amount: Number(this.movementAmount),
      concept: this.movementConcept,
      ...(this.movementType === 'REFUND' || this.movementType === 'SALE'
        ? { cupTypeId: this.refundCupTypeId, cupQuantity: Number(this.refundCupQuantity) }
        : {}),
    };
    this.api.movement(this.eventId, session.id, data).subscribe({
      next: () => {
        this.selected = undefined;
        this.refundCupTypeId = '';
        this.refundCupQuantity = 1;
        this.load();
      },
      error: (err) => this.error.set(err?.error?.message || 'No se pudo registrar el movimiento.'),
    });
  }
  close(session: CashSession) {
    const amount = window.prompt(
      `Importe contado en ${session.location.name} (€)`,
      String(session.expectedAmount),
    );
    if (amount === null) return;
    this.api
      .close(this.eventId, session.id, Number(amount))
      .subscribe({
        next: () => this.load(),
        error: (err) => this.error.set(err?.error?.message || 'No se pudo cerrar la caja.'),
      });
  }
}
