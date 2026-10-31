import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../core/services/dashboard.service';
import { CurrencyPipe } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { EventsService } from '../../core/services/events.service';

@Component({
  selector: 'app-reports',
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule, FormsModule, CurrencyPipe],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  private readonly dashboard = inject(DashboardService);
  private readonly events = inject(EventsService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  error = '';
  dateFrom = '';
  dateTo = '';
  cash: { balance: number; collections: number; expenses: number; withdrawals: number; adjustments: number; differences: number; sessions: { open: number; closed: number } } | null = null;
  loading = false;
  canSeeFinancial = false;
  constructor() {
    const user = this.auth.currentUser();
    this.canSeeFinancial = ['ADMIN', 'SUPER_ADMIN'].includes(user?.globalRole ?? '');
    this.events.eventMembers(this.eventId).subscribe((members) => {
      this.canSeeFinancial = this.canSeeFinancial || members.some((member) => member.userId === user?.id && member.role === 'EVENT_MANAGER');
      if (this.canSeeFinancial) this.loadCash();
    });
  }
  loadCash() {
    this.loading = true; this.error = '';
    this.dashboard.cashReport(this.eventId, this.dateFrom || undefined, this.dateTo || undefined).subscribe({
      next: (value) => { this.cash = value; this.loading = false; },
      error: (err) => { this.error = err?.error?.message || 'No se pudo cargar el resumen de caja.'; this.loading = false; },
    });
  }
  downloadStock() {
    this.download(this.dashboard.downloadStockCsv(this.eventId), 'stock-report.csv');
  }
  downloadCash() {
    this.download(this.dashboard.downloadCashCsv(this.eventId, this.dateFrom || undefined, this.dateTo || undefined), 'cash-report.csv');
  }
  private download(request: ReturnType<DashboardService['downloadStockCsv']>, name: string) {
    request.subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = name;
        anchor.click();
        URL.revokeObjectURL(url);
      },
      error: (err) => (this.error = err?.error?.message || 'No se pudo exportar el informe.'),
    });
  }
}
