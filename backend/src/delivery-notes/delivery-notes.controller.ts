import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { EventAccessGuard } from '../common/guards/event-access.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { CreateDeliveryNoteDto } from './dto/create-delivery-note.dto';
import { EmailDeliveryNoteDto } from './dto/email-delivery-note.dto';
import { SignDeliveryNoteDto } from './dto/sign-delivery-note.dto';
import { DeliveryNotesService } from './delivery-notes.service';

@ApiTags('delivery-notes')
@ApiBearerAuth()
@Controller('events/:eventId/delivery-notes')
@UseGuards(JwtAuthGuard, EventAccessGuard)
export class DeliveryNotesController {
  constructor(private readonly deliveryNotes: DeliveryNotesService) {}

  @Post()
  create(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Body() dto: CreateDeliveryNoteDto,
  ) {
    return this.deliveryNotes.create(req.user, eventId, dto);
  }

  @Get()
  list(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    return this.deliveryNotes.list(req.user, eventId, query);
  }

  @Get(':id')
  detail(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('id') id: string,
  ) {
    return this.deliveryNotes.detail(req.user, eventId, id);
  }

  @Post(':id/signatures')
  @UseInterceptors(
    FileInterceptor('signature', {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(null, file.mimetype === 'image/png'),
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['signature', 'type', 'signerName'],
      properties: {
        signature: { type: 'string', format: 'binary' },
        type: { type: 'string', enum: ['DELIVERED_BY', 'RECEIVED_BY'] },
        signerName: { type: 'string' },
        userId: { type: 'string' },
      },
    },
  })
  sign(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: SignDeliveryNoteDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.deliveryNotes.sign(req.user, eventId, id, dto, file, req);
  }

  @Get(':id/pdf')
  async pdf(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Res() response: Response,
  ) {
    const file = await this.deliveryNotes.pdfFile(req.user, eventId, id);
    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Content-Length': file.buffer.length,
    });
    response.send(file.buffer);
  }

  @Post(':id/email')
  email(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('id') id: string,
    @Body() dto: EmailDeliveryNoteDto,
  ) {
    return this.deliveryNotes.email(req.user, eventId, id, dto);
  }

  @Post(':id/cancel')
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('eventId') eventId: string,
    @Param('id') id: string,
  ) {
    return this.deliveryNotes.cancel(req.user, eventId, id);
  }
}
