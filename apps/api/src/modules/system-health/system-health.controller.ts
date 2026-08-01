import { Controller, Get } from '@nestjs/common';

import { SystemHealthService } from './system-health.service';

@Controller('system/health')
export class SystemHealthController {
  constructor(private readonly systemHealth: SystemHealthService) {}

  @Get('live')
  getLiveness() {
    return this.systemHealth.getLiveness();
  }

  @Get('ready')
  getReadiness() {
    return this.systemHealth.getReadiness();
  }
}
