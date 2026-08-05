import { Controller, Get } from '@nestjs/common';
import { HEALTH_RESPONSE, type HealthResponse } from '@planner-fin/shared';

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return HEALTH_RESPONSE;
  }
}
