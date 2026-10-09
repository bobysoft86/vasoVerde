import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { EventsService } from '../../core/services/events.service';
import {
  CentralWarehouseOverview,
  CupType,
  EventModel,
  Location,
  StockCondition,
  StockItem,
} from '../../core/models/event.model';
import { environment } from '../../../environments/environment';
import { CashMovementType, CashSession } from '../../core/models/cash.model';
import { CashService } from '../../core/services/cash.service';

type Operation =
  | 'INITIAL_LOAD'
  | 'DELIVERY'
  | 'RETURN'
  | 'CLEANING_SEND'
  | 'CLEANING_RETURN'
  | 'LOSS'
  | 'BREAKAGE';
interface MovementLine {
  cupTypeId: string;
  quantity: number | null;
  condition: StockCondition;
}

@Component({
  selector: 'app-warehouse',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './warehouse.component.html',
  styleUrl: './warehouse.component.scss',
})
export class WarehouseComponent {
  private readonly api = inject(EventsService);
  private readonly http = inject(HttpClient);
  private readonly cash = inject(CashService);
  private readonly destroyRef = inject(DestroyRef);
  readonly data = signal<CentralWarehouseOverview | null>(null);
  readonly cups = signal<CupType[]>([]);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly loading = signal(false);
  readonly eventLoading = signal(false);
  readonly stockLoading = signal(false);
  readonly success = signal('');
  readonly offline = signal(typeof navigator !== 'undefined' && !navigator.onLine);
  readonly events = signal<EventModel[]>([]);
  readonly eventLocations = signal<Location[]>([]);
  readonly eventStock = signal<StockItem[] | null>(null);
  readonly eventError = signal('');
  readonly stockError = signal('');
  readonly centralCash = signal<CashSession | null>(null);
  readonly cashError = signal('');
  readonly cashSuccess = signal('');
  readonly cashSaving = signal(false);
  readonly transferSessions = signal<CashSession[]>([]);
  readonly settlementSessions = signal<CashSession[]>([]);
  private eventRequest = 0;
  private stockRequest = 0;
  operation: Operation = 'INITIAL_LOAD';
  eventId = '';
  eventLocationId = '';
  adjustmentLocationId = '';
  notes = '';
  cashOpening = 0;
  cashAmount = 0;
  cashConcept = '';
  cashClosing = 0;
  transferEventId = '';
  transferDestinationId = '';
  transferAmount = 0;
  transferConcept = '';
  settlementEventId = '';
  settlementSessionId = '';
  settlementAmount = 0;
  settlementConcept = '';
  cashMovementType: CashMovementType = 'CASH_IN';
  lines: MovementLine[] = [{ cupTypeId: '', quantity: 1, condition: 'CLEAN' }];
  readonly operations: { value: Operation; label: string }[] = [
    { value: 'INITIAL_LOAD', label: 'Recepción de fábrica' },
    { value: 'DELIVERY', label: 'Entrega a almacén de evento' },
    { value: 'RETURN', label: 'Recibir sobrantes de evento' },
    { value: 'CLEANING_SEND', label: 'Enviar sucios a lavado' },
    { value: 'CLEANING_RETURN', label: 'Retorno limpio de lavado' },
    { value: 'LOSS', label: 'Registrar pérdida' },
    { value: 'BREAKAGE', label: 'Registrar rotura' },
  ];
  readonly conditions: StockCondition[] = ['CLEAN', 'DIRTY', 'DAMAGED'];
  readonly labels: Record<string, string> = {
    CENTRAL_WAREHOUSE: 'Nave central',
    CLEANING_AREA: 'Zona de lavado',
    CLEAN: 'Limpio',
    DIRTY: 'Sucio',
    DAMAGED: 'Dañado',
  };

  constructor() {
    this.load();
    this.loadEvents();
  }

  @HostListener('window:offline') onOffline() {
    this.offline.set(true);
  }
  @HostListener('window:online') onOnline() {
    this.offline.set(false);
    this.load();
  }

  load() {
    if (this.loading() || this.saving()) return;
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      data: this.api.centralWarehouse(),
      cups: this.api.cupTypes(),
      cash: this.cash.centralSessions(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ data, cups, cash }) => {
          this.data.set(data);
          this.cups.set(cups.filter((cup) => cup.active));
          this.centralCash.set(
            cash.find((session) => session.status === 'OPEN') || cash[0] || null,
          );
          this.loading.set(false);
          if (!this.adjustmentLocationId) this.adjustmentLocationId = this.central?.id || '';
          if (this.operation === 'RETURN' && this.eventLocationId) this.loadEventStock();
        },
        error: (err) => {
          this.data.set(null);
          this.loading.set(false);
          this.error.set(
            this.message(err, 'No se ha podido cargar el stock. Reintenta antes de registrar.'),
          );
        },
      });
  }

  openCentralCash() {
    if (this.cashSaving() || !this.central || this.cashOpening < 0) return;
    this.cashSaving.set(true);
    this.cashError.set('');
    this.cash
      .centralOpen({ locationId: this.central.id, openingAmount: Number(this.cashOpening) })
      .subscribe({
        next: (session) => {
          this.centralCash.set(session);
          this.cashSaving.set(false);
          this.cashSuccess.set('Caja central abierta.');
        },
        error: (err) => {
          this.cashSaving.set(false);
          this.cashError.set(this.message(err, 'No se pudo abrir la caja central.'));
        },
      });
  }
  addCentralCashMovement() {
    const session = this.centralCash();
    if (this.cashSaving() || !session || this.cashAmount <= 0 || !this.cashConcept.trim()) return;
    this.cashSaving.set(true);
    this.cashError.set('');
    this.cash
      .centralMovement(session.id, {
        type: this.cashMovementType,
        amount: Number(this.cashAmount),
        concept: this.cashConcept.trim(),
      })
      .subscribe({
        next: (updated) => {
          this.centralCash.set(updated);
          this.cashAmount = 0;
          this.cashConcept = '';
          this.cashSaving.set(false);
          this.cashSuccess.set('Movimiento de caja registrado.');
        },
        error: (err) => {
          this.cashSaving.set(false);
          this.cashError.set(this.message(err, 'No se pudo registrar el movimiento.'));
        },
      });
  }
  closeCentralCash() {
    const session = this.centralCash();
    if (this.cashSaving() || !session || this.cashClosing < 0) return;
    this.cashSaving.set(true);
    this.cashError.set('');
    this.cash.centralClose(session.id, Number(this.cashClosing)).subscribe({
      next: (updated) => {
        this.centralCash.set(updated);
        this.cashSaving.set(false);
        this.cashSuccess.set('Caja central cerrada.');
      },
      error: (err) => {
        this.cashSaving.set(false);
        this.cashError.set(this.message(err, 'No se pudo cerrar la caja central.'));
      },
    });
  }
  loadTransferSessions() {
    this.transferDestinationId = '';
    this.transferSessions.set([]);
    if (!this.transferEventId) return;
    this.cash
      .sessions(this.transferEventId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sessions) =>
          this.transferSessions.set(sessions.filter((session) => session.status === 'OPEN')),
        error: (err) =>
          this.cashError.set(this.message(err, 'No se pudieron cargar las cajas del evento.')),
      });
  }
  transferFromCentral() {
    const origin = this.centralCash();
    if (
      this.cashSaving() ||
      !origin ||
      !this.transferDestinationId ||
      this.transferAmount <= 0 ||
      !this.transferConcept.trim()
    )
      return;
    this.cashSaving.set(true);
    this.cashError.set('');
    this.cash
      .centralTransfer({
        originSessionId: origin.id,
        destinationSessionId: this.transferDestinationId,
        amount: Number(this.transferAmount),
        concept: this.transferConcept.trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cashSaving.set(false);
          this.transferAmount = 0;
          this.transferConcept = '';
          this.cashSuccess.set('Fondo transferido a la caja del evento.');
          this.load();
        },
        error: (err) => {
          this.cashSaving.set(false);
          this.cashError.set(this.message(err, 'No se pudo transferir el fondo.'));
        },
      });
  }
  loadSettlementSessions() {
    this.settlementSessionId = '';
    this.settlementAmount = 0;
    this.settlementSessions.set([]);
    if (!this.settlementEventId) return;
    this.cash
      .sessions(this.settlementEventId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sessions) =>
          this.settlementSessions.set(
            sessions.filter((session) => session.status === 'CLOSED' && !session.settledAt),
          ),
        error: (err) =>
          this.cashError.set(this.message(err, 'No se pudieron cargar las cajas pendientes.')),
      });
  }
  changeSettlementSession() {
    const session = this.settlementSessions().find((item) => item.id === this.settlementSessionId);
    this.settlementAmount = session?.closingAmount ?? 0;
  }
  settleEventCash() {
    const destination = this.centralCash();
    if (
      this.cashSaving() ||
      !destination ||
      !this.settlementSessionId ||
      this.settlementAmount <= 0 ||
      !this.settlementConcept.trim()
    )
      return;
    this.cashSaving.set(true);
    this.cashError.set('');
    this.cash
      .centralSettlement({
        originSessionId: this.settlementSessionId,
        destinationSessionId: destination.id,
        amount: Number(this.settlementAmount),
        concept: this.settlementConcept.trim(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cashSaving.set(false);
          this.settlementAmount = 0;
          this.settlementConcept = '';
          this.cashSuccess.set('Caja del evento liquidada en la nave central.');
          this.loadSettlementSessions();
          this.load();
        },
        error: (err) => {
          this.cashSaving.set(false);
          this.cashError.set(this.message(err, 'No se pudo liquidar la caja del evento.'));
        },
      });
  }

  get central() {
    return this.data()?.locations.find((area) => area.type === 'CENTRAL_WAREHOUSE');
  }
  get washing() {
    return this.data()?.locations.find((area) => area.type === 'CLEANING_AREA');
  }
  get needsEvent() {
    return this.operation === 'DELIVERY' || this.operation === 'RETURN';
  }
  selectableCups() {
    return this.cups().filter(cup => !this.needsEvent || !cup.ownerEventId || cup.ownerEventId === this.eventId);
  }
  get adjustment() {
    return this.operation === 'LOSS' || this.operation === 'BREAKAGE';
  }
  get selectableCondition() {
    return this.operation === 'RETURN' || this.adjustment;
  }
  get busy() {
    return (
      this.loading() ||
      this.saving() ||
      (this.needsEvent && (this.eventLoading() || this.stockLoading()))
    );
  }
  get sourceId() {
    if (this.operation === 'INITIAL_LOAD') return '';
    if (this.operation === 'RETURN') return this.eventLocationId;
    if (this.operation === 'CLEANING_RETURN') return this.washing?.id || '';
    if (this.adjustment) return this.adjustmentLocationId;
    return this.central?.id || '';
  }
  get destinationId() {
    if (this.adjustment) return '';
    if (this.operation === 'DELIVERY') return this.eventLocationId;
    if (this.operation === 'CLEANING_SEND') return this.washing?.id || '';
    return this.central?.id || '';
  }
  get sourceItems() {
    return this.operation === 'RETURN'
      ? this.eventStock() || []
      : this.data()?.locations.find((area) => area.id === this.sourceId)?.items || [];
  }
  locationName(id: string) {
    return (
      [...(this.data()?.locations || []), ...this.eventLocations()].find((area) => area.id === id)
        ?.name || 'Pendiente de seleccionar'
    );
  }
  changeOperation() {
    this.error.set('');
    this.success.set('');
    this.notes = '';
    this.lines = [
      {
        cupTypeId: '',
        quantity: 1,
        condition: this.operation === 'CLEANING_SEND' ? 'DIRTY' : 'CLEAN',
      },
    ];
    if (this.needsEvent && !this.events().length) this.loadEvents();
    if (this.operation === 'RETURN' && this.eventLocationId) this.loadEventStock();
  }
  loadEvents() {
    this.eventLoading.set(true);
    this.eventError.set('');
    this.api
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (events) => {
          this.events.set(events);
          this.eventLoading.set(false);
        },
        error: (err) => {
          this.eventLoading.set(false);
          this.eventError.set(this.message(err, 'No se pudieron cargar los eventos.'));
        },
      });
  }
  changeEvent() {
    const request = ++this.eventRequest;
    ++this.stockRequest;
    this.eventLocationId = '';
    this.eventLocations.set([]);
    this.eventStock.set(null);
    this.stockLoading.set(false);
    this.stockError.set('');
    this.eventError.set('');
    this.eventLoading.set(false);
    if (!this.eventId) return;
    this.eventLoading.set(true);
    this.api
      .locations(this.eventId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (locations) => {
          if (request !== this.eventRequest) return;
          this.eventLocations.set(
            locations.filter((location) => location.active && location.type === 'EVENT_WAREHOUSE'),
          );
          this.eventLoading.set(false);
          if (this.eventLocations().length === 1) {
            this.eventLocationId = this.eventLocations()[0].id;
            this.loadEventStock();
          }
        },
        error: (err) => {
          if (request !== this.eventRequest) return;
          this.eventLoading.set(false);
          this.eventError.set(this.message(err, 'No se pudieron cargar los almacenes del evento.'));
        },
      });
  }
  loadEventStock() {
    const request = ++this.stockRequest;
    this.eventStock.set(null);
    this.stockError.set('');
    this.stockLoading.set(false);
    if (this.operation !== 'RETURN' || !this.eventId || !this.eventLocationId) return;
    this.stockLoading.set(true);
    this.api
      .locationStock(this.eventId, this.eventLocationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (request === this.stockRequest) {
            this.eventStock.set(result.items);
            this.stockLoading.set(false);
          }
        },
        error: (err) => {
          if (request === this.stockRequest) {
            this.stockLoading.set(false);
            this.stockError.set(this.message(err, 'No se pudo consultar la disponibilidad.'));
          }
        },
      });
  }
  addLine() {
    this.lines.push({
      cupTypeId: '',
      quantity: 1,
      condition: this.operation === 'CLEANING_SEND' ? 'DIRTY' : 'CLEAN',
    });
  }

  removeLine(index: number) {
    if (this.lines.length > 1) this.lines.splice(index, 1);
  }

  available(line: MovementLine) {
    const condition = this.operation === 'CLEANING_RETURN' ? 'DIRTY' : line.condition;
    return this.sourceItems
      .filter(
        (item) =>
          item.cupTypeId === line.cupTypeId &&
          (this.operation === 'RETURN' || item.condition === condition),
      )
      .reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
  }
  stockLabel(cupTypeId: string) {
    const quantities = (['CLEAN', 'DIRTY', 'DAMAGED'] as StockCondition[]).map((condition) =>
      this.sourceItems
        .filter((item) => item.cupTypeId === cupTypeId && item.condition === condition)
        .reduce((sum, item) => sum + Math.max(0, item.quantity), 0),
    );
    return `L ${quantities[0]} · S ${quantities[1]} · D ${quantities[2]}`;
  }
  requested(line: MovementLine) {
    return this.lines
      .filter(
        (item) =>
          item.cupTypeId === line.cupTypeId &&
          (this.operation === 'RETURN' || item.condition === line.condition),
      )
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }
  get validation(): string {
    if (this.offline())
      return 'Sin conexión: los movimientos requieren conexión y no se guardan en cola.';
    if (this.busy) return 'Espera a que termine la operación en curso.';
    if (!this.data()) return 'Actualiza el stock antes de continuar.';
    if (
      this.needsEvent &&
      (!this.events().some((event) => event.id === this.eventId) ||
        !this.eventLocations().some((location) => location.id === this.eventLocationId))
    )
      return 'Selecciona el evento y su almacén.';
    if (this.operation === 'RETURN' && !this.eventStock())
      return 'Consulta el stock del almacén del evento antes de continuar.';
    if (this.operation !== 'INITIAL_LOAD' && !this.sourceId) return 'Falta el almacén de origen.';
    if (this.adjustment && !this.data()?.locations.some((area) => area.id === this.sourceId))
      return 'Selecciona un origen válido.';
    if (!this.adjustment && !this.destinationId) return 'Falta el almacén de destino.';
    if (this.sourceId && this.sourceId === this.destinationId)
      return 'El origen y el destino deben ser distintos.';
    if (this.adjustment && !this.notes.trim())
      return 'La pérdida o rotura requiere una justificación.';
    const keys = new Set<string>();
    if (!this.lines.length) return 'Añade al menos una línea.';
    for (const line of this.lines) {
      if (!this.selectableCups().some(cup => cup.id === line.cupTypeId))
        return 'Selecciona vasos genéricos o pertenecientes al evento.';
      if (
        !this.cups().some((cup) => cup.id === line.cupTypeId) ||
        !Number.isSafeInteger(line.quantity) ||
        Number(line.quantity) < 1
      )
        return 'Completa cada línea con un vaso activo y una cantidad entera positiva.';
      if (!this.conditions.includes(line.condition))
        return 'Selecciona la condición física del stock.';
      if (
        !this.selectableCondition &&
        line.condition !== (this.operation === 'CLEANING_SEND' ? 'DIRTY' : 'CLEAN')
      )
        return 'Condición no válida para esta operación.';
      const key = `${line.cupTypeId}:${line.condition}`;
      if (keys.has(key))
        return 'No repitas el mismo vaso y condición: agrupa las unidades en una línea.';
      keys.add(key);
      if (this.operation !== 'INITIAL_LOAD' && this.requested(line) > this.available(line))
        return 'La cantidad solicitada supera el stock disponible en origen.';
    }
    return '';
  }
  submit() {
    if (this.saving()) return;
    if (this.validation) {
      this.error.set(this.validation);
      return;
    }
    const receipt = this.operation === 'INITIAL_LOAD';
    const body = {
      type: this.operation,
      ...(this.needsEvent ? { eventId: this.eventId } : {}),
      ...(!receipt && this.sourceId ? { sourceLocationId: this.sourceId } : {}),
      ...(!receipt && this.destinationId ? { destinationLocationId: this.destinationId } : {}),
      notes: this.notes.trim() || undefined,
      generateDeliveryNote: false,
      items: this.lines.map((line) => ({ ...line, quantity: Number(line.quantity) })),
    };
    this.saving.set(true);
    this.error.set('');
    this.success.set('');
    const request = receipt
      ? this.api.receiveCentralStock(body)
      : this.http.post(`${environment.apiUrl}/warehouse/movements`, body);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.notes = '';
        this.lines = [
          {
            cupTypeId: '',
            quantity: 1,
            condition: this.operation === 'CLEANING_SEND' ? 'DIRTY' : 'CLEAN',
          },
        ];
        this.saving.set(false);
        this.success.set('Movimiento registrado correctamente.');
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(this.message(err, 'No se pudo registrar el movimiento.'));
        if (err instanceof HttpErrorResponse && err.status === 0) {
          this.data.set(null);
          this.error.set(
            'No se pudo confirmar el resultado. Actualiza y revisa los últimos movimientos antes de volver a registrar.',
          );
        }
      },
    });
  }
  private message(err: unknown, fallback: string): string {
    if (!(err instanceof HttpErrorResponse)) return fallback;
    const message = err.error?.message;
    return Array.isArray(message)
      ? message.join(' · ')
      : typeof message === 'string'
        ? message
        : fallback;
  }
}
