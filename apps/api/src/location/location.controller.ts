import { Controller, Get, Logger, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GeoapifyClient } from '../geoapify/geoapify.client';
import type { GeoapifyReverseResult } from '../geoapify/geoapify-place';
import { type LocationQuery, locationQuerySchema } from './location.schema';

@Controller()
export class LocationController {
  private readonly logger = new Logger(LocationController.name);

  constructor(private readonly geoapify: GeoapifyClient) {}

  @Get('location')
  async location(@Query(new ZodValidationPipe(locationQuerySchema)) query: LocationQuery) {
    let result: GeoapifyReverseResult | null = null;
    try {
      result = await this.geoapify.reverseGeocode(query);
    } catch (error) {
      // Address lookup is helpful context, not a prerequisite for analysis.
      this.logger.warn(error instanceof Error ? error.message : 'Reverse geocoding failed');
    }

    return {
      location: query,
      address:
        result === null
          ? null
          : {
              name: result.name ?? null,
              street: result.street ?? null,
              village: result.suburb ?? null,
              district: result.district ?? result.county ?? null,
              city: result.city ?? null,
              postcode: result.postcode ?? null,
              state: result.state ?? null,
              formatted: result.formatted ?? result.address_line2 ?? result.address_line1 ?? null,
            },
      source:
        result === null
          ? null
          : {
              provider: 'Geoapify',
              attribution: result.datasource?.attribution ?? '© OpenStreetMap contributors',
              licence: result.datasource?.license ?? 'Open Database License',
            },
    };
  }
}
