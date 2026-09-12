/** Browser key for the Maps JavaScript API. Without it the app draws an OpenStreetMap map. */
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '';

/**
 * Google Maps Platform terms forbid using Google data with any other map, so the
 * API is asked for Google business counts only when this page draws a Google map.
 */
export const USE_GOOGLE_MAP = GOOGLE_MAPS_API_KEY !== '';

/** Advanced markers need a map ID. Google's DEMO_MAP_ID is for development; create one for production. */
export const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID?.trim() || 'DEMO_MAP_ID';
