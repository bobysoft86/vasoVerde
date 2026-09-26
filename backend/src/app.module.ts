import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { EventsModule } from './events/events.module';
import { BoothsModule } from './booths/booths.module';
import { BarsModule } from './bars/bars.module';
import { CupTypesModule } from './cup-types/cup-types.module';
import { StockModule } from './stock/stock.module';
import { DeliveryNotesModule } from './delivery-notes/delivery-notes.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { CashModule } from './cash/cash.module';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { IdempotencyInterceptor } from './common/idempotency.interceptor';

@Module({
  providers: [{ provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor }],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
      validate: validateEnvironment,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    EventsModule,
    BoothsModule,
    BarsModule,
    CupTypesModule,
    StockModule,
    DeliveryNotesModule,
    DashboardModule,
    CashModule,
  ],
})
export class AppModule {}
