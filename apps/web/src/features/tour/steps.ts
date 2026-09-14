/** Where the tooltip sits relative to the highlighted element. */
export type Placement = 'top' | 'bottom' | 'left' | 'right';

export interface TourStep {
  id: string;
  /**
   * CSS selector for the element to highlight. Add `data-tour="…"` to it.
   * Omit it for a plain centred card with no spotlight — the welcome step.
   */
  target?: string;
  title: string;
  body: string;
  placement?: Placement;
  /**
   * The step points at a result, which only exists once a location is picked.
   * The tour blocks the page, so the visitor cannot do that themselves — it
   * asks the app to pick the map centre instead.
   */
  requiresLocation?: boolean;
}

/**
 * The whole tour, in order. To add a step, put `data-tour="your-id"` on the
 * element and add an entry here — nothing else needs to change.
 */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    title: 'Selamat datang di LOKABIS',
    body: 'Penilaian kelayakan lokasi usaha berbasis data terbuka. Setiap titik di peta dapat dinilai.',
  },
  {
    id: 'location',
    // Anchored to the card, not to the map: the map now fills the screen, so
    // spotlighting it lit up the whole viewport and dimmed nothing.
    target: '[data-tour="location"]',
    title: 'Titik lokasi',
    // Stated, not commanded: the tour blocks the page, so telling anyone to
    // click the map here would be an instruction they cannot follow.
    body: 'Koordinat yang sedang dinilai tampil di sini.',
    placement: 'right',
  },
  {
    id: 'business-type',
    target: '[data-tour="business-type"]',
    title: 'Jenis usaha',
    body: 'Pilih kategori usaha sesuai kebutuhan Anda.',
    placement: 'right',
  },
  {
    id: 'score',
    target: '[data-tour="score"]',
    title: 'Skor lokasi',
    body: 'Setiap skor disertai rentang ketidakpastian dan tingkat keyakinannya.',
    placement: 'left',
    requiresLocation: true,
  },
  {
    id: 'tabs',
    target: '[data-tour="tabs"]',
    title: 'Empat sudut pandang',
    body: 'Bandingkan ketujuh jenis usaha, lihat kelompok pelanggan, dan periksa kompetitor sekitar.',
    placement: 'left',
    requiresLocation: true,
  },
];
