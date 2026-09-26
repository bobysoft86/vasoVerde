import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-main-layout',
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.scss',
})
export class MainLayoutComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly isMobile = signal(typeof window !== 'undefined' && window.innerWidth < 800);
  constructor() {
    if (typeof window !== 'undefined')
      window.addEventListener('resize', () => this.isMobile.set(window.innerWidth < 800));
  }
  isAdmin() {
    const role = this.auth.currentUser()?.globalRole;
    return role === 'ADMIN' || role === 'SUPER_ADMIN';
  }
  logout() {
    this.auth.logout().subscribe(() => void this.router.navigateByUrl('/login'));
  }
}
