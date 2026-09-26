import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @ApiOperation({ summary: 'Comprueba la API y la conexión con MySQL' })
  @ApiResponse({ status: 200, description: 'Estado de los servicios' })
  check() {
    return this.health.check();
  }
}
