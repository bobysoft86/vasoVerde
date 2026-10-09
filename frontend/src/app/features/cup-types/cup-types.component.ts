import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { EventsService } from '../../core/services/events.service';
import { CupType, EventModel } from '../../core/models/event.model';

@Component({
  selector: 'app-cup-types',
  imports: [
    MatSelectModule,
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  templateUrl: './cup-types.component.html',
  styleUrl: './cup-types.component.scss',
})
export class CupTypesComponent {
  private readonly api = inject(EventsService);
  private readonly fb = inject(FormBuilder);
  readonly items = signal<CupType[]>([]);
  readonly events = signal<EventModel[]>([]);
  readonly error = signal('');
  bases() { return this.items().filter(cup => !cup.ownerEventId && !cup.baseTypeId && cup.active); }
  readonly showForm = signal(false);
  readonly editing = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    ownerEventId: [''],
    baseTypeId: [''],
    code: ['', Validators.required],
    capacityMl: [330, [Validators.required, Validators.min(1)]],
  });
  constructor() {
    this.api.list().subscribe(value => this.events.set(value));
    this.load();
  }
  load() {
    this.api.cupTypes().subscribe((value) => this.items.set(value));
  }
  edit(item: CupType) {
    this.editing.set(item.id);
    this.form.patchValue({ name: item.name, code: item.code, capacityMl: item.capacityMl || 330, ownerEventId: item.ownerEventId || '', baseTypeId: item.baseTypeId || '' });
    this.showForm.set(true);
  }
  toggle(item: CupType) {
    this.api.updateCupType(item.id, { active: !item.active }).subscribe(() => this.load());
  }
  save() {
    if (this.form.invalid) return;
    const id = this.editing();
    const request = id
      ? this.api.updateCupType(id, this.form.getRawValue())
      : this.api.createCupType(this.form.getRawValue());
    this.error.set('');
    request.subscribe({ next: () => {
      this.form.reset({ name: '', code: '', capacityMl: 330 });
      this.editing.set(null);
      this.showForm.set(false);
      this.load();
    }, error: err => this.error.set(err?.error?.message || 'No se pudo guardar') });
  }
}
