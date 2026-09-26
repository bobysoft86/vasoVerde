import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CupTypesController } from './cup-types.controller';
import { CupTypesService } from './cup-types.service';
@Module({
  imports: [AuthModule],
  controllers: [CupTypesController],
  providers: [CupTypesService, JwtAuthGuard],
})
export class CupTypesModule {}
