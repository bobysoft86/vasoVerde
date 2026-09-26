import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { DeliveryNotesModule } from '../delivery-notes/delivery-notes.module';
import { LocationsModule } from '../locations/locations.module';
import { EventAccessGuard } from '../common/guards/event-access.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { StockController } from './stock.controller';
import { WarehouseController } from './warehouse.controller';
import { StockService } from './stock.service';
@Module({
  imports: [AuthModule, EventsModule, DeliveryNotesModule, LocationsModule],
  controllers: [StockController, WarehouseController],
  providers: [StockService, EventAccessGuard, JwtAuthGuard],
})
export class StockModule {}
