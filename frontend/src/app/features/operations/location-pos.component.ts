import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, finalize, forkJoin } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { CashService } from '../../core/services/cash.service';
import { EventsService } from '../../core/services/events.service';
import { CashMovementType, CashSession } from '../../core/models/cash.model';
import { CupType, Location, StockResponse } from '../../core/models/event.model';
import { OperationalState } from './operational-state';

interface BarSettlementPreview {
  closed: boolean;
  settlementId: string | null;
  settlementStatus: 'CONFIRMED' | 'PENDING' | null;
  lines: Array<{ cupTypeId: string; cupTypeName: string; delivered: number; collected: number; difference: number; unitPrice: number; missingAmount: number }>;
  totalDelivered: number;
  totalCollected: number;
  prepaidAmount: number;
  missingAmount: number;
  balanceAmount: number;
  direction: 'COLLECT' | 'REFUND' | 'BALANCED';
}

@Component({
  selector: 'app-location-pos',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatIconModule,
  ],
  templateUrl: './location-pos.component.html',
  styleUrl: './location-pos.component.scss',
})
export class LocationPosComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly events = inject(EventsService);
  private readonly cash = inject(CashService);
  private readonly router = inject(Router);
  readonly state = new OperationalState();
  readonly eventId = this.route.snapshot.paramMap.get('eventId') ?? this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  readonly locationId = this.route.snapshot.paramMap.get('locationId') ?? '';
  readonly location = signal<Location | null>(null);
  readonly eventName = signal('');
  readonly locations = signal<Location[]>([]);
  readonly cups = signal<CupType[]>([]);
  readonly session = signal<CashSession | null>(null);
  readonly error = signal('');
  readonly message = signal('');
  readonly stock = signal<StockResponse | null>(null);
  readonly sessions = signal<CashSession[]>([]);
  readonly barSettlement = signal<BarSettlementPreview | null>(null);
  readonly barClosed = signal(false);
  readonly cashClosed = signal(false);
  readonly closeWizardOpen = signal(false);
  readonly showIncidentForm = signal(false);
  readonly incidentSaving = signal(false);
  readonly incidentNotice = signal('');
  openingAmount = 0;
  cupTypeId = '';
  quantity = 1;
  condition = 'DIRTY';
  barType: 'DELIVERY' | 'RETURN' = 'RETURN';
  sourceId = '';
  destinationId = '';
  deliveryChargeable = false;
  deliveryChargeAmount = 0;
  barCounts: Record<string, { CLEAN: number | null; DIRTY: number | null; DAMAGED: number | null }> = {};
  cashClosingAmount = 0;
  incidentTitle = '';
  incidentDescription = '';
  incidentType = 'OPERATIONAL';
  otherType: CashMovementType = 'CASH_IN';
  otherAmount = 1;
  constructor() {
    this.sourceId = this.locationId;
    if (typeof localStorage !== 'undefined' && this.eventId && this.locationId) {
      try { localStorage.setItem('vv:last-work', JSON.stringify({ eventId: this.eventId, locationId: this.locationId })); } catch { /* storage may be disabled */ }
    }
    this.state.watch(() => forkJoin({
      event: this.events.get(this.eventId),
      locations: this.events.locations(this.eventId),
      cups: this.events.cupTypes(),
      sessions: this.cash.sessions(this.eventId),
      stock: this.events.stock(this.eventId),
    }), (data) => {
      this.eventName.set(data.event.name);
      this.locations.set(data.locations.filter((item) => item.active));
      this.location.set(this.locations().find((item) => item.id === this.locationId) ?? null);
      this.cups.set(data.cups.filter((item) => item.active && (!item.ownerEventId || item.ownerEventId === this.eventId)));
      for (const cup of this.cups()) this.barCounts[cup.id] ??= { CLEAN: null, DIRTY: null, DAMAGED: null };
      this.sessions.set(data.sessions.filter((item) => item.location.id === this.locationId));
      this.session.set(this.sessions().find((item) => item.status === 'OPEN') ?? null);
      this.cashClosed.set(this.sessions().some((item) => item.status === 'CLOSED'));
      this.stock.set(data.stock);
      if (this.location()?.type === 'BAR' && !this.destinationId) {
        const defaultCounterpart = this.counterparts().find((item) => item.type === 'EVENT_WAREHOUSE') ?? this.counterparts()[0];
        if (defaultCounterpart) this.destinationId = defaultCounterpart.id;
      }
      if (!this.location()) this.error.set('Este punto de trabajo no está disponible.');
      if (this.location()?.type === 'BAR') this.loadBarSettlement();
    });
  }
  backLink() { return this.route.parent?.snapshot.paramMap.get('eventId') ? ['/events', this.eventId, 'operate'] : ['/portal']; }
  loadBarSettlement() {
    this.cash.barSettlementPreview(this.eventId, this.locationId).subscribe({
      next: (preview) => {
        const value = preview as BarSettlementPreview;
        this.barClosed.set(value.closed);
        this.barSettlement.set(value);
      },
      error: () => this.barSettlement.set(null),
    });
  }
  theoreticalStock(cupTypeId: string) {
    return Math.max(0, this.barSettlement()?.lines.find((line) => line.cupTypeId === cupTypeId)?.difference ?? 0);
  }
  setDirection(type: 'DELIVERY' | 'RETURN') {
    if (this.state.busy()) return;
    const oldCounterpart = this.barType === 'RETURN' ? this.destinationId : this.sourceId;
    const counterpart = this.counterparts().find((item) => item.id === oldCounterpart) ??
      this.counterparts().find((item) => item.type === 'EVENT_WAREHOUSE') ?? this.counterparts()[0];
    this.barType = type;
    this.condition = type === 'DELIVERY' ? 'CLEAN' : 'DIRTY';
    if (type === 'RETURN') {
      this.deliveryChargeable = false;
      this.deliveryChargeAmount = 0;
    }
    this.sourceId = type === 'RETURN' ? this.locationId : counterpart?.id ?? '';
    this.destinationId = type === 'DELIVERY' ? this.locationId : counterpart?.id ?? '';
  }
  counterparts() {
    return this.locations().filter((item) => item.id !== this.locationId &&
      ['EVENT_WAREHOUSE', 'CENTRAL_WAREHOUSE', 'BOOTH'].includes(item.type));
  }
  selectableSources() {
    const current = this.location();
    return this.barType === 'RETURN' ? (current ? [current] : []) : this.counterparts();
  }
  selectableDestinations() {
    const current = this.location();
    return this.barType === 'DELIVERY' ? (current ? [current] : []) : this.counterparts();
  }
  writesBlocked() {
    return this.state.busy() || this.state.offline() || this.state.loading() ||
      !!this.state.readError() || !this.location();
  }
  validQuantity() {
    return this.cups().some((cup) => cup.id === this.cupTypeId) &&
      Number.isSafeInteger(Number(this.quantity)) && Number(this.quantity) > 0;
  }
  validMoney(value: number, allowZero = false) {
    return value !== null && value !== undefined && Number.isFinite(Number(value)) &&
      (allowZero ? Number(value) >= 0 : Number(value) > 0) &&
      Math.abs(Number(value) * 100 - Math.round(Number(value) * 100)) < 0.000001;
  }
  stockQuantity(locationId: string, condition: string) {
    const stock = this.stock();
    if (!stock?.locations) return null;
    return stock.locations.find((entry) => entry.location.id === locationId)?.items
      .filter((item) => item.cupTypeId === this.cupTypeId && item.condition === condition)
      .reduce((total, item) => total + Number(item.quantity), 0) ?? 0;
  }
  stockLabel(cupTypeId: string, locationId = this.locationId) {
    const values = (['CLEAN', 'DIRTY', 'DAMAGED'] as const).map((condition) =>
      this.stock()?.locations?.find((entry) => entry.location.id === locationId)?.items
        .filter((item) => item.cupTypeId === cupTypeId && item.condition === condition)
        .reduce((total, item) => total + Number(item.quantity), 0) ?? 0,
    );
    return `L ${values[0]} · S ${values[1]} · D ${values[2]}`;
  }
  stockLocationForBarType() { return this.barType === 'DELIVERY' ? this.sourceId : this.locationId; }
  locationName(id: string) { return this.locations().find((item) => item.id === id)?.name ?? ''; }
  showSettlement() { return this.closeWizardOpen() || this.barClosed(); }
  stockActionSummary() {
    const cup = this.cups().find((item) => item.id === this.cupTypeId);
    if (!cup || !this.validQuantity()) return '';
    const action = this.barType === 'DELIVERY' ? 'Entregar' : 'Recoger';
    const condition = this.barType === 'DELIVERY' ? 'limpios' : this.condition === 'CLEAN' ? 'limpios' : this.condition === 'DAMAGED' ? 'dañados' : 'sucios';
    return `${action} ${this.quantity} ${cup.displayName || cup.name} ${condition} ${this.barType === 'DELIVERY' ? 'desde ' + this.locationName(this.sourceId) : 'para ' + this.locationName(this.destinationId)}.`;
  }
  history() {
    return this.sessions().flatMap((session) => session.movements)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);
  }
  private write<T>(request: () => Observable<T>, receive: (value: T) => void, message: string) {
    if (this.writesBlocked() || !this.state.beginWrite()) return;
    this.error.set('');
    this.message.set('');
    request().pipe(
      takeUntilDestroyed(this.state.destroyRef),
      finalize(() => this.state.endWrite()),
    ).subscribe({
      next: (value) => { receive(value); this.message.set(message); },
      error: (err) => this.error.set(err?.error?.message || 'No se pudo guardar la operación. Comprueba el historial antes de reintentar.'),
    });
  }
  openCash() {
    if (this.session() || this.writesBlocked()) return;
    if (!this.validMoney(this.openingAmount, true)) {
      this.error.set('Introduce un fondo inicial válido, con un máximo de dos decimales.');
      return;
    }
    this.write(() => this.cash.open(this.eventId, {
        locationId: this.locationId,
        openingAmount: Number(this.openingAmount),
      }), (value) => { this.session.set(value); this.cashClosed.set(false); }, 'Caja abierta.');
  }
  movement(type: CashMovementType, amount: number, concept: string) {
    const session = this.session();
    if (!session || this.writesBlocked()) return;
    if (!this.validQuantity()) {
      this.error.set('Selecciona un vaso y una cantidad entera mayor que cero.');
      return;
    }
    const available = this.stockQuantity(this.locationId, 'CLEAN');
    if (type === 'SALE' && available !== null && Number(this.quantity) > available) {
      this.error.set('No hay suficientes vasos limpios para esta venta.');
      return;
    }
    if (type === 'REFUND' && amount > Number(session.expectedAmount)) {
      this.error.set('El saldo de caja no cubre esta devolución.');
      return;
    }
    this.write(() => this.cash.movement(this.eventId, session.id, {
        type,
        amount,
        concept,
        cupTypeId: this.cupTypeId,
        cupQuantity: Number(this.quantity),
      }), (value) => {
          this.session.set(value);
          this.quantity = 1;
      }, type === 'SALE' ? 'Venta registrada.' : 'Devolución registrada.');
  }
  sale() {
    this.movement('SALE', Number(this.quantity), 'Venta de vaso');
  }
  refund() {
    this.movement('REFUND', Number(this.quantity), 'Devolución de vaso');
  }
  otherMovement() {
    const session = this.session();
    if (!session || this.writesBlocked()) return;
    if (!['CASH_IN', 'CASH_OUT', 'WITHDRAWAL'].includes(this.otherType) || !this.validMoney(this.otherAmount)) {
      this.error.set('Introduce un importe positivo, con un máximo de dos decimales.');
      return;
    }
    if (this.otherType !== 'CASH_IN' && Number(this.otherAmount) > Number(session.expectedAmount)) {
      this.error.set('El importe supera el saldo esperado de caja.');
      return;
    }
    this.write(() => this.cash.movement(this.eventId, session.id, {
        type: this.otherType,
        amount: Number(this.otherAmount),
        concept: this.otherType === 'CASH_IN' ? 'Entrada de efectivo' : this.otherType === 'WITHDRAWAL' ? 'Retirada / recaudación' : 'Salida de efectivo',
      }), (value) => this.session.set(value), 'Movimiento de caja registrado.');
  }
  closeCash() {
    const current = this.session();
    if (!current || this.writesBlocked()) return;
    const counted = Number(this.cashClosingAmount);
    if (!this.validMoney(counted, true)) {
      this.error.set('Introduce un importe contado válido, igual o mayor que cero.');
      return;
    }
    this.write(() => this.cash.close(this.eventId, current.id, counted),
      () => { this.session.set(null); this.cashClosed.set(true); }, 'Caja cerrada.');
  }
  startCloseWizard() {
    this.error.set('');
    this.cashClosingAmount = Number(this.session()?.expectedAmount ?? 0);
    this.closeWizardOpen.set(true);
  }
  saveStock() {
    if (this.writesBlocked()) return;
    const returning = this.barType === 'RETURN';
    const counterpart = returning ? this.destinationId : this.sourceId;
    if (this.location()?.type !== 'BAR' || !this.validQuantity() ||
        !this.counterparts().some((item) => item.id === counterpart) ||
        (returning ? this.sourceId : this.destinationId) !== this.locationId ||
        this.sourceId === this.destinationId) {
      this.error.set('Selecciona origen, destino y una cantidad entera válida.');
      return;
    }
    if (!returning) this.condition = 'CLEAN';
    const available = this.stockQuantity(this.sourceId, 'CLEAN');
    if (!returning && available !== null && Number(this.quantity) > available) {
      this.error.set('La entrega supera el stock limpio disponible en origen.');
      return;
    }
    if (!returning && this.deliveryChargeable && (!this.session() || !this.validMoney(this.deliveryChargeAmount))) {
      this.error.set('Abre la caja de la barra y registra un importe válido para cobrar la entrega.');
      return;
    }
    this.write(() => this.events.createMovement(this.eventId, {
        type: this.barType,
        sourceLocationId: this.sourceId,
        destinationLocationId: this.destinationId,
        generateDeliveryNote: true,
        chargeable: !returning && this.deliveryChargeable,
        ...(!returning && this.deliveryChargeable ? {
          chargeAmount: Number(this.deliveryChargeAmount),
          cashSessionId: this.session()!.id,
        } : {}),
        items: [
          { cupTypeId: this.cupTypeId, condition: this.condition, quantity: Number(this.quantity) },
        ],
      }), (movement) => {
          this.quantity = 1;
          this.deliveryChargeable = false;
          this.deliveryChargeAmount = 0;
          if (movement.deliveryNote?.id) {
            void this.router.navigate(['/events', this.eventId, 'delivery-notes', movement.deliveryNote.id]);
          }
      }, 'Movimiento guardado. Consulta el albarán en el historial.');
  }
  closeBar() {
    if (this.writesBlocked() || this.location()?.type !== 'BAR' || this.barClosed()) return;
    const allCounts = this.cups().flatMap((cup) => ['CLEAN', 'DIRTY', 'DAMAGED'].map((condition) => ({ cup, condition: condition as 'CLEAN' | 'DIRTY' | 'DAMAGED', count: this.barCounts[cup.id]?.[condition as 'CLEAN' | 'DIRTY' | 'DAMAGED'] })));
    if (allCounts.some(({ count }) => count === null || count === undefined || !Number.isSafeInteger(Number(count)) || Number(count) < 0)) {
      this.error.set('Completa el recuento de vasos limpios, sucios y dañados. Escribe 0 si no hay unidades.');
      return;
    }
    const items = allCounts.flatMap(({ cup, condition, count }) =>
      Number(count) > 0 ? [{ cupTypeId: cup.id, condition, quantity: Number(count) }] : [],
    );
    if (!this.counterparts().some((item) => item.id === this.destinationId)) {
      this.error.set('Selecciona el destino de la recogida final antes de cerrar la barra.');
      return;
    }
    this.write(() => this.events.closeLocation(this.eventId, this.locationId, {
      destinationLocationId: this.destinationId,
      items,
      notes: 'Cierre realizado desde el POS de barra',
      generateDeliveryNote: items.length > 0,
    }), () => {
      this.barClosed.set(true);
      this.loadBarSettlement();
    }, 'Barra cerrada. Revisa ahora la liquidación económica.');
  }
  settleBar() {
    const preview = this.barSettlement();
    const current = this.session();
    if (!preview || this.writesBlocked() || !this.barClosed()) return;
    this.write(() => this.cash.settleBar(this.eventId, { locationId: this.locationId, ...(current ? { cashSessionId: current.id } : {}) }),
      () => this.loadBarSettlement(), 'Liquidación de barra registrada en caja.');
  }
  reportProblem() {
    if (this.writesBlocked() || this.incidentSaving() || !this.incidentTitle.trim()) return;
    this.incidentSaving.set(true); this.incidentNotice.set('');
    this.events.createIncident(this.eventId, {
      kind: 'INCIDENT', type: this.incidentType, priority: 'NORMAL', title: this.incidentTitle.trim(),
      description: this.incidentDescription.trim() || undefined, locationId: this.locationId,
    }).subscribe({
      next: () => { this.incidentSaving.set(false); this.showIncidentForm.set(false); this.incidentTitle = ''; this.incidentDescription = ''; this.incidentNotice.set('Aviso guardado. El responsable puede verlo en el resumen y en Avisos e incidencias.'); },
      error: () => { this.incidentSaving.set(false); this.incidentNotice.set('No se pudo enviar. Comprueba la conexión e inténtalo otra vez.'); },
    });
  }
}
