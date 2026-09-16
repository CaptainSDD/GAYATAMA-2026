import { Controller, Get, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { LocationEligibilityService } from './location-eligibility';
import { type LocationQuery, locationQuerySchema } from './location.schema';

@Controller()
export class LocationController {
  constructor(private readonly locations: LocationEligibilityService) {}

  @Get('location')
  async location(@Query(new ZodValidationPipe(locationQuerySchema)) query: LocationQuery) {
    const { result, eligibility } = await this.locations.lookup(query);

    return {
      location: query,
      eligibility,
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
