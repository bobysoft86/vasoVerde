import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { HealthService } from '../../core/services/health.service';
import { HealthStatus } from '../../core/models/health.model';
import { DashboardGlobal } from '../../core/models/dashboard.model';
import { DashboardService } from '../../core/services/dashboard.service';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterLink, MatCardModule, MatIconModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent {
  private readonly health = inject(HealthService);
  private readonly dashboard = inject(DashboardService);
  readonly apiStatus = signal('Comprobando');
  readonly databaseStatus = signal('Comprobando');
  readonly data = signal<DashboardGlobal | null>(null);
  readonly loadError = signal(false);
  readonly today = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date());
  readonly stockTotal = computed(() => {
    const stock = this.data()?.stock;
    return stock ? stock.clean + stock.dirty + stock.damaged : 0;
  });
  readonly stockBars = computed(() => {
    const stock = this.data()?.stock;
    const total = this.stockTotal();
    if (!stock) return [];
    return [
      { label: 'Limpios', value: stock.clean, color: 'clean', percent: total ? (stock.clean / total) * 100 : 0 },
      { label: 'Sucios', value: stock.dirty, color: 'dirty', percent: total ? (stock.dirty / total) * 100 : 0 },
      { label: 'Dañados', value: stock.damaged, color: 'damaged', percent: total ? (stock.damaged / total) * 100 : 0 },
    ];
  });
  readonly cashBars = computed(() => {
    const cash = this.data()?.cash;
    const max = Math.max(cash?.collections ?? 0, cash?.expenses ?? 0, 1);
    return cash
      ? [
          { label: 'Recaudación', value: cash.collections, color: 'income', percent: (cash.collections / max) * 100 },
          { label: 'Gastos', value: cash.expenses, color: 'expense', percent: (cash.expenses / max) * 100 },
        ]
      : [];
  });

  constructor() {
    this.health.getStatus().subscribe({
      next: (status: HealthStatus) => {
        this.apiStatus.set(status.status === 'ok' ? 'Conectada' : 'No disponible');
        this.databaseStatus.set(status.database === 'connected' ? 'Conectada' : 'No disponible');
      },
      error: () => {
        this.apiStatus.set('No disponible');
        this.databaseStatus.set('No disponible');
      },
    });
    this.dashboard.global().subscribe({
      next: (data) => this.data.set(data),
      error: () => this.loadError.set(true),
    });
  }
}
