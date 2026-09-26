import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { DashboardService } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-reports',
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent {
  private readonly dashboard = inject(DashboardService);
  private readonly route = inject(ActivatedRoute);
  private readonly eventId = this.route.parent?.snapshot.paramMap.get('eventId') ?? '';
  error = '';
  downloadStock() {
    this.download(this.dashboard.downloadStockCsv(this.eventId), 'stock-report.csv');
  }
  downloadCash() {
    this.download(this.dashboard.downloadCashCsv(this.eventId), 'cash-report.csv');
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
