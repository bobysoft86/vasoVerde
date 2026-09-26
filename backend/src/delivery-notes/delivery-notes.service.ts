import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DeliveryNoteStatus,
  DeliveryNoteType,
  GlobalRole,
  Prisma,
  StockMovementType,
} from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { EventsService } from '../events/events.service';
import { AuthUser } from '../common/types/auth-request';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeliveryNoteDto } from './dto/create-delivery-note.dto';
import { EmailDeliveryNoteDto } from './dto/email-delivery-note.dto';
import { SignDeliveryNoteDto } from './dto/sign-delivery-note.dto';
import { DeliveryNotePdfService } from './pdf.service';
import { StorageService } from './storage.service';

type Db = Prisma.TransactionClient | PrismaService;

const eligibleTypes = new Set<StockMovementType>([
  StockMovementType.DELIVERY,
  StockMovementType.RETURN,
  StockMovementType.TRANSFER,
  StockMovementType.CLEANING_SEND,
  StockMovementType.CLEANING_RETURN,
]);

@Injectable()
export class DeliveryNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly storage: StorageService,
    private readonly pdf: DeliveryNotePdfService,
  ) {}

  private isAdmin(user: AuthUser) {
    return (
      user.globalRole === GlobalRole.ADMIN ||
      user.globalRole === GlobalRole.SUPER_ADMIN
    );
  }

  private async assertAccess(user: AuthUser, eventId: string) {
    return this.events.assertAccess(user, eventId);
  }

  private typeFor(movementType: StockMovementType) {
    if (movementType === StockMovementType.DELIVERY)
      return DeliveryNoteType.DELIVERY;
    if (movementType === StockMovementType.RETURN)
      return DeliveryNoteType.RETURN;
    return DeliveryNoteType.TRANSFER;
  }

  private include() {
    return {
      event: true,
      createdBy: { select: { id: true, name: true, email: true } },
      stockMovement: {
        include: {
          sourceLocation: {
            include: {
              bar: {
                include: {
                  clientUser: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
          destinationLocation: {
            include: {
              bar: {
                include: {
                  clientUser: { select: { id: true, name: true, email: true } },
                },
              },
            },
          },
          createdBy: { select: { id: true, name: true, email: true } },
          items: { include: { cupType: true } },
        },
      },
      signatures: { orderBy: { signedAt: 'asc' as const } },
      emailLogs: { orderBy: { sentAt: 'desc' as const } },
    };
  }

  private async audit(
    db: Db,
    user: AuthUser,
    eventId: string,
    action: string,
    entityId: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    await db.auditLog.create({
      data: {
        companyId: user.companyId,
        eventId,
        userId: user.sub,
        action,
        entityType: 'DeliveryNote',
        entityId,
        metadata,
      },
    });
  }

  private async nextNumber(
    tx: Prisma.TransactionClient,
    companyId: string,
    eventId: string,
    eventCode: string,
  ) {
    const sequence = await tx.documentSequence.upsert({
      where: {
        companyId_eventId_documentType: {
          companyId,
          eventId,
          documentType: 'DELIVERY_NOTE',
        },
      },
      create: {
        companyId,
        eventId,
        documentType: 'DELIVERY_NOTE',
        nextValue: 2,
      },
      update: { nextValue: { increment: 1 } },
    });
    const value = sequence.nextValue - 1;
    return `${eventCode}-ALB-${String(value).padStart(6, '0')}`;
  }

  async create(user: AuthUser, eventId: string, dto: CreateDeliveryNoteDto, transaction?: Prisma.TransactionClient) {
    await this.assertAccess(user, eventId);
    const db = transaction ?? this.prisma;
    const movement = await db.stockMovement.findFirst({
      where: {
        id: dto.stockMovementId,
        companyId: user.companyId,
        eventId,
        status: 'POSTED',
      },
      include: { deliveryNote: true },
    });
    if (!movement)
      throw new NotFoundException('Stock movement not found for this event');
    if (!eligibleTypes.has(movement.type))
      throw new BadRequestException(
        'This movement type cannot have a delivery note',
      );
    if (movement.deliveryNote)
      throw new ConflictException('This movement already has a delivery note');
    const event = await this.events.detail(user, eventId);
    const write = async (tx: Prisma.TransactionClient) => {
      const number = await this.nextNumber(
        tx,
        user.companyId,
        eventId,
        event.code,
      );
      const created = await tx.deliveryNote.create({
        data: {
          companyId: user.companyId,
          eventId,
          stockMovementId: movement.id,
          number,
          type: this.typeFor(movement.type),
          status: DeliveryNoteStatus.PENDING_SIGNATURE,
          notes: dto.notes?.trim() || movement.notes,
          createdByUserId: user.sub,
        },
        include: this.include(),
      });
      await this.audit(tx, user, eventId, 'DELIVERY_NOTE_CREATED', created.id, {
        number,
        stockMovementId: movement.id,
      });
      return created;
    };
    return transaction ? write(transaction) : this.prisma.$transaction(write);
  }

  async list(
    user: AuthUser,
    eventId: string,
    query: Record<string, string | undefined>,
  ) {
    await this.assertAccess(user, eventId);
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const pageSize = Math.min(
      100,
      Math.max(1, Number(query.pageSize ?? 20) || 20),
    );
    const where: Prisma.DeliveryNoteWhereInput = {
      companyId: user.companyId,
      eventId,
      ...(query.type ? { type: query.type as DeliveryNoteType } : {}),
      ...(query.status ? { status: query.status as DeliveryNoteStatus } : {}),
      ...(query.number ? { number: { contains: query.number } } : {}),
      ...(query.createdByUserId
        ? { createdByUserId: query.createdByUserId }
        : {}),
      ...(query.sourceLocationId || query.destinationLocationId
        ? {
            stockMovement: {
              sourceLocationId: query.sourceLocationId,
              destinationLocationId: query.destinationLocationId,
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { number: { contains: query.search } },
              { notes: { contains: query.search } },
            ],
          }
        : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            createdAt: {
              gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
              lte: query.dateTo ? new Date(query.dateTo) : undefined,
            },
          }
        : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.deliveryNote.findMany({
        where,
        include: {
          stockMovement: {
            include: { sourceLocation: true, destinationLocation: true },
          },
          createdBy: { select: { id: true, name: true, email: true } },
          signatures: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.deliveryNote.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        ...item,
        signed: item.status === DeliveryNoteStatus.SIGNED,
        signatureCount: item.signatures.length,
      })),
      total,
      page,
      pageSize,
    };
  }

  async detail(user: AuthUser, eventId: string, id: string) {
    await this.assertAccess(user, eventId);
    const note = await this.prisma.deliveryNote.findFirst({
      where: { id, eventId, companyId: user.companyId },
      include: this.include(),
    });
    if (!note) throw new NotFoundException('Delivery note not found');
    return {
      ...note,
      pdfAvailable: Boolean(note.pdfPath),
      signed: note.status === DeliveryNoteStatus.SIGNED,
    };
  }

  async sign(
    user: AuthUser,
    eventId: string,
    id: string,
    dto: SignDeliveryNoteDto,
    file: Express.Multer.File,
    request: {
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
    },
  ) {
    await this.assertAccess(user, eventId);
    if (!file || file.mimetype !== 'image/png' || file.size > 2 * 1024 * 1024)
      throw new BadRequestException('Signature must be a PNG image up to 2MB');
    const current = await this.prisma.deliveryNote.findFirst({
      where: { id, eventId, companyId: user.companyId },
      include: { signatures: true },
    });
    if (!current) throw new NotFoundException('Delivery note not found');
    if (current.status === DeliveryNoteStatus.SIGNED)
      throw new ConflictException('Signed delivery notes are immutable');
    if (current.status === DeliveryNoteStatus.CANCELLED)
      throw new BadRequestException('Cancelled delivery note cannot be signed');
    if (current.signatures.some((signature) => signature.type === dto.type))
      throw new ConflictException('This signature type already exists');
    const signerUser = dto.userId
      ? await this.prisma.user.findFirst({
          where: { id: dto.userId, companyId: user.companyId, active: true },
        })
      : null;
    if (dto.userId && !signerUser)
      throw new BadRequestException(
        'Signer user does not belong to this company',
      );
    const imagePath = await this.storage.write(
      'signatures',
      'png',
      file.buffer,
    );
    const signature = await this.prisma.$transaction(async (tx) => {
      const created = await tx.signature.create({
        data: {
          deliveryNoteId: id,
          type: dto.type,
          signerName: dto.signerName.trim(),
          imagePath,
          userId: signerUser?.id ?? (dto.userId === user.sub ? user.sub : null),
          signedAt: new Date(),
          ipAddress: request.ip,
          userAgent: String(request.headers['user-agent'] ?? '') || null,
        },
      });
      const count = current.signatures.length + 1;
      const status =
        count >= 2
          ? DeliveryNoteStatus.SIGNED
          : DeliveryNoteStatus.PENDING_SIGNATURE;
      await tx.deliveryNote.update({
        where: { id },
        data: {
          status,
          issuedAt:
            status === DeliveryNoteStatus.SIGNED ? new Date() : undefined,
        },
      });
      await this.audit(tx, user, eventId, 'DELIVERY_NOTE_SIGNED', id, {
        signatureType: dto.type,
        signerName: dto.signerName.trim(),
        completed: status === DeliveryNoteStatus.SIGNED,
      });
      return created;
    });
    if (current.signatures.length + 1 >= 2) {
      const full = await this.prisma.deliveryNote.findUniqueOrThrow({
        where: { id },
        include: this.include(),
      });
      const pdfPath = await this.storage.write(
        'delivery-notes',
        'pdf',
        await this.pdf.generate(full),
      );
      await this.prisma.deliveryNote.update({
        where: { id },
        data: { pdfPath },
      });
      await this.audit(
        this.prisma,
        user,
        eventId,
        'DELIVERY_NOTE_PDF_GENERATED',
        id,
        { pdfPath },
      );
    }
    return {
      signature,
      status:
        current.signatures.length + 1 >= 2
          ? DeliveryNoteStatus.SIGNED
          : DeliveryNoteStatus.PENDING_SIGNATURE,
    };
  }

  async pdfFile(user: AuthUser, eventId: string, id: string) {
    const note = await this.detail(user, eventId, id);
    if (note.status !== DeliveryNoteStatus.SIGNED)
      throw new BadRequestException('PDF is available after both signatures');
    if (!note.pdfPath) {
      const path = await this.storage.write(
        'delivery-notes',
        'pdf',
        await this.pdf.generate(note),
      );
      await this.prisma.deliveryNote.update({
        where: { id },
        data: { pdfPath: path },
      });
      note.pdfPath = path;
    }
    return {
      buffer: await this.storage.read(note.pdfPath),
      filename: `${note.number}.pdf`,
    };
  }

  async email(
    user: AuthUser,
    eventId: string,
    id: string,
    dto: EmailDeliveryNoteDto,
  ) {
    const note = await this.detail(user, eventId, id);
    if (note.status !== DeliveryNoteStatus.SIGNED)
      throw new BadRequestException(
        'Only signed delivery notes can be emailed',
      );
    const host = process.env.SMTP_HOST;
    if (!host) throw new BadRequestException('Email service not configured');
    const { buffer, filename } = await this.pdfFile(user, eventId, id);
    const assignedClient =
      note.stockMovement?.sourceLocation?.bar?.clientUser ??
      note.stockMovement?.destinationLocation?.bar?.clientUser;
    const recipients = dto.to?.length
      ? dto.to
      : assignedClient?.email
        ? [assignedClient.email]
        : [];
    if (!recipients.length)
      throw new BadRequestException(
        'No recipient email provided and no CLIENT user is assigned to the bar',
      );
    const subject = dto.subject?.trim() || `Albarán ${note.number}`;
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
    for (const recipient of recipients) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: recipient,
          subject,
          text: dto.message || `Adjuntamos el albarán ${note.number}.`,
          attachments: [{ filename, content: buffer }],
        });
        await this.prisma.deliveryNoteEmail.create({
          data: {
            deliveryNoteId: id,
            sentByUserId: user.sub,
            recipient,
            subject,
            status: 'SENT',
          },
        });
        await this.audit(
          this.prisma,
          user,
          eventId,
          'DELIVERY_NOTE_EMAIL_SENT',
          id,
          { recipient },
        );
      } catch (error) {
        await this.prisma.deliveryNoteEmail.create({
          data: {
            deliveryNoteId: id,
            sentByUserId: user.sub,
            recipient,
            subject,
            status: 'FAILED',
            error:
              error instanceof Error ? error.message : 'Unknown email error',
          },
        });
        throw new BadRequestException('Could not send delivery note email');
      }
    }
    return { sent: recipients };
  }

  async cancel(user: AuthUser, eventId: string, id: string) {
    await this.assertAccess(user, eventId);
    const note = await this.prisma.deliveryNote.findFirst({
      where: { id, eventId, companyId: user.companyId },
    });
    if (!note) throw new NotFoundException('Delivery note not found');
    if (note.status === DeliveryNoteStatus.SIGNED)
      throw new ConflictException('Signed delivery notes are immutable');
    if (!this.isAdmin(user) && user.sub !== note.createdByUserId)
      throw new ForbiddenException('Only creator or admin can cancel');
    const cancelled = await this.prisma.deliveryNote.update({
      where: { id },
      data: { status: DeliveryNoteStatus.CANCELLED },
    });
    await this.audit(this.prisma, user, eventId, 'DELIVERY_NOTE_CANCELLED', id);
    return cancelled;
  }
}
