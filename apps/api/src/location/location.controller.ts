import { Controller, Get, Logger, Optional, Query, UseGuards } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { VerifyTokenGuard } from '../auth/verify-token.guard';
import { GeoapifyClient } from '../geoapify/geoapify.client';
import type { GeoapifyReverseResult } from '../geoapify/geoapify-place';
import { LocationEligibilityService, type LocationEligibility } from './location-eligibility';
import { type LocationQuery, locationQuerySchema } from './location.schema';

@Controller()
export class LocationController {
  private readonly logger = new Logger(LocationController.name);

  constructor(
    private readonly geoapify: GeoapifyClient,
    @Optional() private readonly locations?: LocationEligibilityService,
  ) {}

  @Get('location')
  @UseGuards(VerifyTokenGuard)
  async location(@Query(new ZodValidationPipe(locationQuerySchema)) query: LocationQuery) {
    let result: GeoapifyReverseResult | null = null;
    let eligibility: LocationEligibility = { status: 'unknown' };
    try {
      if (this.locations !== undefined) {
        const lookup = await this.locations.lookup(query);
        result = lookup.result;
        eligibility = lookup.eligibility;
      } else {
        result = await this.geoapify.reverseGeocode(query);
      }
    } catch (error) {
      // Address lookup is helpful context, not a prerequisite for analysis.
      this.logger.warn(error instanceof Error ? error.message : 'Reverse geocoding failed');
    }

    return {
      location: query,
      ...(this.locations !== undefined && { eligibility }),
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
