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

/** A normalized address returned by Geoapify's Reverse Geocoding API. */
export interface GeoapifyReverseResult {
  /** Geoapify's normalized classification, e.g. `natural.water` or `building`. */
  category?: string;
  /** Some reverse results include several matching classifications. */
  categories?: readonly string[];
  result_type?: string;
  name?: string;
  street?: string;
  suburb?: string;
  district?: string;
  county?: string;
  city?: string;
  postcode?: string;
  state?: string;
  formatted?: string;
  address_line1?: string;
  address_line2?: string;
  datasource?: {
    sourcename?: string;
    attribution?: string;
    license?: string;
    /** Original OSM tags when Geoapify can identify the containing feature. */
    raw?: Record<string, unknown>;
  };
}

export interface GeoapifyReverseResponse {
  results?: GeoapifyReverseResult[];
}
