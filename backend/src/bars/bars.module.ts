import { Module } from '@nestjs/common';
import { BarsController } from './bars.controller';
import { BarsService } from './bars.service';
import { EventsModule } from '../events/events.module';
import { LocationsModule } from '../locations/locations.module';
import { AuthModule } from '../auth/auth.module';
@Module({
  imports: [EventsModule, LocationsModule, AuthModule],
  controllers: [BarsController],
  providers: [BarsService],
})
export class BarsModule {}
