import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EventAccessGuard } from '../common/guards/event-access.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [PrismaModule, AuthModule, EventsModule],
  controllers: [DashboardController],
  providers: [DashboardService, EventAccessGuard, JwtAuthGuard],
})
export class DashboardModule {}
