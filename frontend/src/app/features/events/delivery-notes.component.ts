import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { EventsService } from '../../core/services/events.service';
import { DeliveryNote } from '../../core/models/event.model';

@Component({
  selector: 'app-delivery-notes',
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './delivery-notes.component.html',
  styleUrl: './delivery-notes.component.scss',
})
export class DeliveryNotesComponent {
  private readonly api = inject(EventsService);
  private readonly route = inject(ActivatedRoute);
  private readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  readonly notes = signal<DeliveryNote[]>([]);
  readonly loading = signal(true);
  readonly labels: Record<string, string> = {
    DRAFT: 'Borrador',
    PENDING_SIGNATURE: 'Pendiente de firma',
    SIGNED: 'Firmado',
    CANCELLED: 'Cancelado',
  };
  constructor() {
    this.api
      .deliveryNotes(this.eventId)
      .subscribe({
        next: (value) => this.notes.set(value.items),
        complete: () => this.loading.set(false),
      });
  }
  download(note: DeliveryNote) {
    this.api.downloadDeliveryNote(this.eventId, note.id).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${note.number}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }
}
