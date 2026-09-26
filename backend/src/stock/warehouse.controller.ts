import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/types/auth-request';
import { StockService } from './stock.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { IsOptional, IsString } from 'class-validator';

class WarehouseMovementDto extends CreateStockMovementDto {
  @IsOptional() @IsString() eventId?: string;
}

@ApiTags('warehouse')
@ApiBearerAuth()
@Controller('warehouse')
@UseGuards(JwtAuthGuard)
export class WarehouseController {
  constructor(private readonly stock: StockService) {}

  @Post('movements') movement(@Req() req: AuthenticatedRequest, @Body() dto: WarehouseMovementDto) {
    return this.stock.warehouseMovement(req.user,dto);
  }

  @Get('overview')
  overview(@Req() req: AuthenticatedRequest) {
    return this.stock.centralOverview(req.user);
  }

  @Post('receipts')
  receive(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateStockMovementDto,
  ) {
    return this.stock.receiveCentralStock(req.user, dto);
  }
}
