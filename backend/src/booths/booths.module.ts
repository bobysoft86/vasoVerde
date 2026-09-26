import { Module } from '@nestjs/common';
import { BoothsController } from './booths.controller';
import { BoothsService } from './booths.service';
import { EventsModule } from '../events/events.module';
import { LocationsModule } from '../locations/locations.module';
import { AuthModule } from '../auth/auth.module';
@Module({
  imports: [EventsModule, LocationsModule, AuthModule],
  controllers: [BoothsController],
  providers: [BoothsService],
})
export class BoothsModule {}
