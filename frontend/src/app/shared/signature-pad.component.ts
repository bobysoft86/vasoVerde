import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-signature-pad',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './signature-pad.component.html',
  styleUrl: './signature-pad.component.scss',
})
export class SignaturePadComponent {
  @ViewChild('canvas', { static: true }) private readonly canvas!: ElementRef<HTMLCanvasElement>;
  readonly hasDrawing = signal(false);
  private drawing = false;
  private context() {
    const context = this.canvas.nativeElement.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');
    return context;
  }
  private point(event: PointerEvent) {
    const rect = this.canvas.nativeElement.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * this.canvas.nativeElement.width) / rect.width,
      y: ((event.clientY - rect.top) * this.canvas.nativeElement.height) / rect.height,
    };
  }
  start(event: PointerEvent) {
    this.canvas.nativeElement.setPointerCapture(event.pointerId);
    const point = this.point(event);
    const context = this.context();
    context.beginPath();
    context.moveTo(point.x, point.y);
    this.drawing = true;
  }
  draw(event: PointerEvent) {
    if (!this.drawing) return;
    const point = this.point(event);
    const context = this.context();
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.strokeStyle = '#173f2b';
    context.lineTo(point.x, point.y);
    context.stroke();
    this.hasDrawing.set(true);
  }
  stop() {
    this.drawing = false;
  }
  clear() {
    this.context().clearRect(
      0,
      0,
      this.canvas.nativeElement.width,
      this.canvas.nativeElement.height,
    );
    this.hasDrawing.set(false);
  }
  blob() {
    return new Promise<Blob>((resolve, reject) =>
      this.canvas.nativeElement.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('Could not create signature'))),
        'image/png',
      ),
    );
  }
}
