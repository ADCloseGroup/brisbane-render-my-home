'use client';

/**
 * Thin GA4 wrapper. Safe to call even if GA isn't loaded (no-op).
 * Event names match the funnel the brief asks to track.
 */
type GtagParams = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export type FunnelEvent =
  | 'rmh_start'
  | 'rmh_address_search'
  | 'rmh_property_image'
  | 'rmh_map_pin'
  | 'rmh_upload'
  | 'rmh_storeys_detected'
  | 'rmh_generate_start'
  | 'rmh_generate_complete'
  | 'rmh_colour_select'
  | 'rmh_option_toggle'
  | 'rmh_estimate_shown'
  | 'rmh_lead_gate_view'
  | 'rmh_lead_submit'
  | 'rmh_quote_requested'
  | 'rmh_image_download'
  | 'rmh_abandon';

export function track(event: FunnelEvent, params: GtagParams = {}): void {
  if (typeof window === 'undefined') return;
  window.gtag?.('event', event, params);
}
