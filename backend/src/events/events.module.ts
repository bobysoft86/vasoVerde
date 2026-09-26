import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventAccessGuard } from '../common/guards/event-access.guard';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LocationsModule } from '../locations/locations.module';
@Module({
  imports: [AuthModule, LocationsModule],
  controllers: [EventsController],
  providers: [EventsService, EventAccessGuard, JwtAuthGuard],
  exports: [EventsService, EventAccessGuard, JwtAuthGuard],
})
export class EventsModule {}
