import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { CurrencyPipe } from '@angular/common';
import './app.config';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('formats event cash values with the Spanish locale', () => {
    const amount = new CurrencyPipe('es-ES').transform(1234.5, 'EUR', 'symbol', '1.2-2', 'es-ES');
    expect(amount).toContain('1.234,50');
  });
});
