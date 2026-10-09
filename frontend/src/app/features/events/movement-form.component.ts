import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CupType, Location, StockItem, StockMovementType } from '../../core/models/event.model';
import { EventsService } from '../../core/services/events.service';
import { CashService } from '../../core/services/cash.service';
import { CashSession } from '../../core/models/cash.model';

@Component({
  selector: 'app-movement-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
  ],
  templateUrl: './movement-form.component.html',
  styleUrl: './movement-form.component.scss',
})
export class MovementFormComponent {
  private readonly api = inject(EventsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly cash = inject(CashService);
  private readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  readonly locations = signal<Location[]>([]);
  readonly cups = signal<CupType[]>([]);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly cashSessions = signal<CashSession[]>([]);
  readonly sourceStock = signal<StockItem[]>([]);
  readonly types: StockMovementType[] = [
    'TRANSFER',
    'DELIVERY',
    'RETURN',
    'CLEANING_SEND',
    'CLEANING_RETURN',
    'ADJUSTMENT',
    'LOSS',
    'BREAKAGE',
  ];
  readonly labels: Record<string, string> = {
    INITIAL_LOAD: 'Carga inicial',
    TRANSFER: 'Traslado',
    DELIVERY: 'Entrega',
    RETURN: 'Recogida',
    CLEANING_SEND: 'Envío a limpieza',
    CLEANING_RETURN: 'Retorno de limpieza',
    ADJUSTMENT: 'Ajuste',
    LOSS: 'Pérdida',
    BREAKAGE: 'Rotura',
  };
  readonly form = this.fb.nonNullable.group({
    type: ['DELIVERY' as StockMovementType, Validators.required],
    sourceLocationId: [''],
    destinationLocationId: [''],
    notes: [''],
    generateDeliveryNote: [true],
    chargeable: [false],
    chargeAmount: [0],
    cashSessionId: [''],
    items: this.fb.array([this.item()]),
  });
  get items() {
    return this.form.controls.items as FormArray;
  }
  constructor() {
    this.api.locations(this.eventId).subscribe((value) => this.locations.set(value));
    this.api.cupTypes().subscribe((value) => this.cups.set(value));
    this.cash.sessions(this.eventId).subscribe((value) => this.cashSessions.set(value.filter((session) => session.status === 'OPEN')));
    this.form.controls.sourceLocationId.valueChanges.subscribe(() => this.loadSourceStock());
    this.form.controls.type.valueChanges.subscribe(() => {
      const type = this.form.controls.type.value;
      this.form.controls.sourceLocationId.setValue('');
      this.form.controls.destinationLocationId.setValue('');
      const condition = type === 'CLEANING_SEND' ? 'DIRTY' : 'CLEAN';
      for (const item of this.items.controls) item.get('condition')?.setValue(condition);
      if (type !== 'DELIVERY') {
        this.form.controls.chargeable.setValue(false);
        this.form.controls.chargeAmount.setValue(0);
        this.form.controls.cashSessionId.setValue('');
      }
      this.loadSourceStock();
    });
  }
  loadSourceStock() {
    const locationId = this.form.controls.sourceLocationId.value;
    if (!locationId) {
      this.sourceStock.set([]);
      return;
    }
    this.api.locationStock(this.eventId, locationId).subscribe({
      next: (result) => this.sourceStock.set(result.items),
      error: () => this.sourceStock.set([]),
    });
  }
  stockLabel(cupTypeId: string) {
    const values = (['CLEAN', 'DIRTY', 'DAMAGED'] as const).map((condition) =>
      this.sourceStock()
        .filter((item) => item.cupTypeId === cupTypeId && item.condition === condition)
        .reduce((sum, item) => sum + Math.max(0, item.quantity), 0),
    );
    return `L ${values[0]} · S ${values[1]} · D ${values[2]}`;
  }
  item() {
    return this.fb.nonNullable.group({
      cupTypeId: ['', Validators.required],
      condition: ['CLEAN', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
    });
  }
  addItem() {
    this.items.push(this.item());
  }
  removeItem(index: number) {
    this.items.removeAt(index);
  }
  needsSource() {
    const type = this.form.controls.type.value;
    return !['INITIAL_LOAD'].includes(type);
  }
  canGenerateNote() {
    return ['DELIVERY', 'RETURN', 'TRANSFER', 'CLEANING_SEND', 'CLEANING_RETURN'].includes(
      this.form.controls.type.value,
    );
  }
  isDelivery() { return this.form.controls.type.value === 'DELIVERY'; }
  needsDestination() {
    const type = this.form.controls.type.value;
    return !['LOSS', 'BREAKAGE'].includes(type);
  }
  save() {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.error.set('');
    const value = this.form.getRawValue();
    this.api.createMovement(this.eventId, value).subscribe({
      next: (result) =>
        void this.router.navigate(
          result.deliveryNote?.id
            ? ['/events', this.eventId, 'delivery-notes', result.deliveryNote.id]
            : ['..'],
          result.deliveryNote?.id ? undefined : { relativeTo: this.route },
        ),
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message || 'No se pudo registrar el movimiento.');
      },
    });
  }
}
