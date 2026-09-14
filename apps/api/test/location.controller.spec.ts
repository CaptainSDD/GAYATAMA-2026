import type { GeoapifyClient } from '../src/geoapify/geoapify.client';
import { LocationController } from '../src/location/location.controller';

describe('LocationController', () => {
  it('maps Indonesian address levels without running an analysis', async () => {
    const geoapify = {
      reverseGeocode: jest.fn().mockResolvedValue({
        name: 'Masjid Al-Mukhlisin',
        street: 'Jalan Belimbing I',
        suburb: 'Peterongan',
        county: 'Semarang Selatan',
        city: 'Kota Semarang',
        postcode: '50242',
        state: 'Jawa Tengah',
        formatted: 'Jalan Belimbing I, Peterongan, Kota Semarang 50242',
        datasource: {
          attribution: '© OpenStreetMap contributors',
          license: 'Open Database License',
        },
      }),
    };
    const controller = new LocationController(geoapify as unknown as GeoapifyClient);

    await expect(controller.location({ lat: -7.005, lng: 110.435 })).resolves.toMatchObject({
      address: {
        village: 'Peterongan',
        district: 'Semarang Selatan',
        city: 'Kota Semarang',
        postcode: '50242',
      },
      source: { provider: 'Geoapify' },
    });
  });

  it('keeps location confirmation usable when address lookup is unavailable', async () => {
    const geoapify = { reverseGeocode: jest.fn().mockRejectedValue(new Error('offline')) };
    const controller = new LocationController(geoapify as unknown as GeoapifyClient);

    await expect(controller.location({ lat: -7.005, lng: 110.435 })).resolves.toEqual({
      location: { lat: -7.005, lng: 110.435 },
      address: null,
      source: null,
    });
  });
});
