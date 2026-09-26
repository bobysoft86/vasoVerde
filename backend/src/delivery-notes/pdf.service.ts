import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { StorageService } from './storage.service';

type PdfNote = {
  number: string;
  type: string;
  status: string;
  issuedAt: Date | null;
  createdAt: Date;
  notes: string | null;
  event: { name: string; code: string; location: string | null } | null;
  createdBy: { name: string };
  stockMovement: {
    sourceLocation: { name: string } | null;
    destinationLocation: { name: string } | null;
    items: Array<{
      cupType: { name: string; code: string };
      condition: string;
      quantity: number;
    }>;
  } | null;
  signatures: Array<{
    type: string;
    signerName: string;
    signedAt: Date;
    imagePath: string;
  }>;
};

@Injectable()
export class DeliveryNotePdfService {
  constructor(private readonly storage: StorageService) {}

  async generate(note: PdfNote) {
    const document = new PDFDocument({
      size: 'A4',
      margin: 48,
      info: { Title: `Albarán ${note.number}` },
    });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve, reject) => {
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
    });

    document
      .fontSize(21)
      .fillColor('#1f5f43')
      .text('VASO VERDE', { continued: true });
    document
      .fontSize(12)
      .fillColor('#333')
      .text(`  ALBARÁN ${note.number}`, { align: 'right' });
    document
      .moveDown(0.5)
      .fontSize(10)
      .text(`Tipo: ${note.type}    Estado: ${note.status}`);
    document.text(
      `Fecha: ${(note.issuedAt ?? note.createdAt).toLocaleString('es-ES')}`,
    );
    document
      .moveDown()
      .fontSize(13)
      .fillColor('#1f5f43')
      .text(note.event?.name ?? 'Evento');
    document
      .fontSize(10)
      .fillColor('#333')
      .text(
        `Código: ${note.event?.code ?? '-'}${note.event?.location ? ` · ${note.event.location}` : ''}`,
      );
    document
      .moveDown()
      .text(`Origen: ${note.stockMovement?.sourceLocation?.name ?? 'Entrada'}`);
    document.text(
      `Destino: ${note.stockMovement?.destinationLocation?.name ?? 'Salida'}`,
    );
    document.text(`Creado por: ${note.createdBy?.name ?? '-'}`);
    document.moveDown().fontSize(11).fillColor('#1f5f43').text('LÍNEAS');
    document.moveDown(0.3).fillColor('#333');
    const headers = ['Tipo de vaso', 'Código', 'Estado', 'Cantidad'];
    const xs = [48, 250, 360, 475];
    document.font('Helvetica-Bold');
    headers.forEach((header, index) =>
      document.text(header, xs[index], document.y, {
        width: index === 0 ? 190 : 105,
      }),
    );
    document.moveDown(1).font('Helvetica');
    for (const item of note.stockMovement?.items ?? []) {
      const y = document.y;
      document.text(item.cupType.name, xs[0], y, { width: 190 });
      document.text(item.cupType.code, xs[1], y, { width: 100 });
      document.text(item.condition, xs[2], y, { width: 100 });
      document.text(String(item.quantity), xs[3], y, { width: 70 });
      document.moveDown(0.8);
    }
    if (note.notes) document.moveDown().text(`Observaciones: ${note.notes}`);
    document.moveDown().fontSize(11).fillColor('#1f5f43').text('FIRMAS');
    document.moveDown(0.5);
    const signatures = note.signatures ?? [];
    for (const signature of signatures) {
      const y = document.y;
      document
        .fillColor('#333')
        .fontSize(10)
        .text(
          `${signature.type === 'DELIVERED_BY' ? 'ENTREGA' : 'RECEPCIÓN'}: ${signature.signerName}`,
          48,
          y,
        );
      document.text(signature.signedAt.toLocaleString('es-ES'), 48, y + 15);
      try {
        const image = await this.storage.read(signature.imagePath);
        document.image(image, 300, y - 4, { fit: [210, 58] });
      } catch {
        throw new NotFoundException('Signature file not found');
      }
      document.moveDown(3.5);
    }
    document
      .fontSize(8)
      .fillColor('#777')
      .text(`Documento generado por Vaso Verde · ${note.number}`, 48, 790, {
        align: 'center',
      });
    document.end();
    return finished;
  }
}
