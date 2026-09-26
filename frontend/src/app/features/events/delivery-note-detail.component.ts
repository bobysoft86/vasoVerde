import { CommonModule } from '@angular/common';
import { Component, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DeliveryNote, SignatureType } from '../../core/models/event.model';
import { EventsService } from '../../core/services/events.service';
import { SignaturePadComponent } from '../../shared/signature-pad.component';

@Component({
  selector: 'app-delivery-note-detail',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    SignaturePadComponent,
  ],
  templateUrl: './delivery-note-detail.component.html',
  styleUrl: './delivery-note-detail.component.scss',
})
export class DeliveryNoteDetailComponent {
  private readonly api = inject(EventsService);
  private readonly route = inject(ActivatedRoute);
  private readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  private readonly id = this.route.snapshot.paramMap.get('id')!;
  @ViewChild('pad') private readonly pad?: SignaturePadComponent;
  readonly note = signal<DeliveryNote | null>(null);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  signatureType: SignatureType = 'DELIVERED_BY';
  signerName = '';
  readonly labels: Record<string, string> = {
    DRAFT: 'Borrador',
    PENDING_SIGNATURE: 'Pendiente de firma',
    SIGNED: 'Firmado',
    CANCELLED: 'Cancelado',
  };
  constructor() {
    this.load();
  }
  load() {
    this.api.deliveryNote(this.eventId, this.id).subscribe((note) => {
      this.note.set(note);
      this.selectNextSignature(note);
    });
  }
  hasSignature(note: DeliveryNote, type: SignatureType) {
    return note.signatures.some((signature) => signature.type === type);
  }
  selectNextSignature(note: DeliveryNote) {
    this.signatureType = this.hasSignature(note, 'DELIVERED_BY') ? 'RECEIVED_BY' : 'DELIVERED_BY';
  }
  sign() {
    const note = this.note();
    if (!note || !this.pad || !this.signerName.trim() || !this.pad.hasDrawing()) {
      this.error.set('Indica el nombre y realiza la firma.');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.pad
      .blob()
      .then((file) =>
        this.api
          .signDeliveryNote(this.eventId, this.id, {
            type: this.signatureType,
            signerName: this.signerName.trim(),
            file,
          })
          .subscribe({
            next: () => {
              this.signerName = '';
              this.pad?.clear();
              this.message.set('Firma guardada.');
              this.load();
            },
            error: (err) => this.error.set(err?.error?.message || 'No se pudo guardar la firma.'),
            complete: () => this.saving.set(false),
          }),
      )
      .catch(() => {
        this.saving.set(false);
        this.error.set('No se pudo preparar la firma.');
      });
  }
  download() {
    const note = this.note();
    if (!note) return;
    this.api.downloadDeliveryNote(this.eventId, this.id).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${note.number}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }
  email() {
    this.api
      .emailDeliveryNote(this.eventId, this.id, { to: [] })
      .subscribe({
        next: () => this.message.set('Albarán enviado.'),
        error: (err) => this.error.set(err?.error?.message || 'No se pudo enviar el email.'),
      });
  }
}
