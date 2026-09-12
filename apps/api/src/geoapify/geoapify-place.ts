/** A feature from a Geoapify Places API (`/v2/places`) GeoJSON response. */
export interface GeoapifyPlace {
  properties?: {
    name?: string;
    lat?: number;
    lon?: number;
    place_id?: string;
    /** Every category the place belongs to, e.g. `['catering', 'catering.cafe']`. */
    categories?: string[];
    /**
     * Geoapify keeps the original OpenStreetMap object under `datasource.raw`,
     * which lets the API reuse its OSM tag normaliser instead of a second,
     * divergent mapping.
     */
    datasource?: { sourcename?: string; raw?: Record<string, unknown> };
  };
  geometry?: { coordinates?: number[] };
}

export interface GeoapifyPlacesResponse {
  features?: GeoapifyPlace[];
}
