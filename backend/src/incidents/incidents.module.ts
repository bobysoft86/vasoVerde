import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  imports: [AuthModule, EventsModule, PrismaModule],
  controllers: [IncidentsController],
  providers: [IncidentsService, JwtAuthGuard],
})
export class IncidentsModule {}
