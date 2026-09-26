import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventsModule } from '../events/events.module';
import { StockModule } from '../stock/stock.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EventAccessGuard } from '../common/guards/event-access.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CashController } from './cash.controller';
import { CashService } from './cash.service';

@Module({
  imports: [PrismaModule, AuthModule, EventsModule, StockModule],
  controllers: [CashController],
  providers: [CashService, EventAccessGuard, JwtAuthGuard],
})
export class CashModule {}
