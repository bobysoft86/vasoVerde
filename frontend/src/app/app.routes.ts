import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'portal',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/portal/portal.component').then((m) => m.PortalComponent),
      },
      {
        path: 'warehouse',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/warehouse/warehouse.component').then((m) => m.WarehouseComponent),
      },
      {
        path: 'events/new',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/events/event-form.component').then((m) => m.EventFormComponent),
      },
      {
        path: 'events/:eventId/edit',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/events/event-form.component').then((m) => m.EventFormComponent),
      },
      {
        path: 'events/:eventId',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/events/event-detail.component').then((m) => m.EventDetailComponent),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'overview' },
          {
            path: 'overview',
            loadComponent: () =>
              import('./features/events/event-overview.component').then(
                (m) => m.EventOverviewComponent,
              ),
          },
          {
            path: 'booths',
            loadComponent: () =>
              import('./features/events/booths.component').then((m) => m.BoothsComponent),
          },
          {
            path: 'bars',
            loadComponent: () =>
              import('./features/events/bars.component').then((m) => m.BarsComponent),
          },
          {
            path: 'users',
            loadComponent: () =>
              import('./features/events/event-users.component').then((m) => m.EventUsersComponent),
          },
          {
            path: 'assignments',
            loadComponent: () =>
              import('./features/events/location-assignments.component').then(
                (m) => m.LocationAssignmentsComponent,
              ),
          },
          {
            path: 'operate',
            loadComponent: () =>
              import('./features/operations/operations.component').then(
                (m) => m.OperationsComponent,
              ),
          },
          {
            path: 'operate/:locationId',
            loadComponent: () =>
              import('./features/operations/location-pos.component').then(
                (m) => m.LocationPosComponent,
              ),
          },
          {
            path: 'stock',
            loadComponent: () =>
              import('./features/events/stock.component').then((m) => m.StockComponent),
          },
          {
            path: 'movements/new',
            loadComponent: () =>
              import('./features/events/movement-form.component').then(
                (m) => m.MovementFormComponent,
              ),
          },
          {
            path: 'movements',
            loadComponent: () =>
              import('./features/events/movements.component').then((m) => m.MovementsComponent),
          },
          {
            path: 'closures',
            loadComponent: () =>
              import('./features/events/location-closures.component').then(
                (m) => m.LocationClosuresComponent,
              ),
          },
          {
            path: 'delivery-notes',
            loadComponent: () =>
              import('./features/events/delivery-notes.component').then(
                (m) => m.DeliveryNotesComponent,
              ),
          },
          {
            path: 'delivery-notes/:id',
            loadComponent: () =>
              import('./features/events/delivery-note-detail.component').then(
                (m) => m.DeliveryNoteDetailComponent,
              ),
          },
          {
            path: 'reports',
            loadComponent: () =>
              import('./features/events/reports.component').then((m) => m.ReportsComponent),
          },
          {
            path: 'incidents',
            loadComponent: () =>
              import('./features/events/incidents.component').then((m) => m.IncidentsComponent),
          },
          {
            path: 'cash',
            loadComponent: () =>
              import('./features/events/cash.component').then((m) => m.CashComponent),
          },
          {
            path: 'cash-transfers',
            loadComponent: () =>
              import('./features/events/cash-transfer.component').then(
                (m) => m.CashTransferComponent,
              ),
          },
        ],
      },
      {
        path: 'events',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/events/events-list.component').then((m) => m.EventsListComponent),
      },
      {
        path: 'admin/cup-types',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/cup-types/cup-types.component').then((m) => m.CupTypesComponent),
      },
      {
        path: 'admin/users',
        canActivate: [authGuard],
        loadComponent: () =>
          import('./features/users/users.component').then((m) => m.UsersComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
