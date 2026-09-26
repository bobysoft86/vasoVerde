import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DeliveryNotesController } from './delivery-notes.controller';
import { DeliveryNotesService } from './delivery-notes.service';
import { DeliveryNotePdfService } from './pdf.service';
import { StorageService } from './storage.service';

@Module({
  imports: [PrismaModule, EventsModule, AuthModule],
  controllers: [DeliveryNotesController],
  providers: [DeliveryNotesService, StorageService, DeliveryNotePdfService],
  exports: [DeliveryNotesService],
})
export class DeliveryNotesModule {}
