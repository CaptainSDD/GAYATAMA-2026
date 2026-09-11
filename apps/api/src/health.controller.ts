import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { MODEL_VERSION } from '@gayatama/scoring';

@Controller('health')
@SkipThrottle()
export class HealthController {
  @Get()
  health() {
    return { status: 'ok', modelVersion: MODEL_VERSION, uptime: Math.round(process.uptime()) };
  }
}
