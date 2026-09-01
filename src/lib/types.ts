export interface DuluxColour {
  id: string;
  name: string;
  /** Hex for the UI swatch AND to anchor the render engine to the true colour. */
  hex: string;
  /** Plain-English description fed to the render engine for accuracy. */
  description: string;
  popular?: boolean;
}

/**
 * The only customer-adjustable render option now is the colour. The extra keys
 * are optional legacy fields kept ONLY so any stale copy of the removed
 * FinishToggles component still type-checks (a second editor in this folder
 * keeps racing our deletes). Unused by current code.
 */
export interface RenderOptions {
  colourId: string;
  finish?: 'smooth' | 'textured';
  fullHouse?: boolean;
  featureWall?: boolean;
  fenceIncluded?: boolean;
  letterboxRendered?: boolean;
}

export interface HouseFacts {
  /** Queensland market: single-storey (lowset) or double-storey (highset). */
  storeys: 1 | 2;
  /** Estimated renderable wall area in m² (rough, for internal use). */
  wallAreaM2: number;
  complexity: 'simple' | 'moderate' | 'complex';
}

export interface PriceBand {
  low: number;
  high: number;
  currency: 'AUD';
  disclaimer: string;
}

export type InputSource = 'address_streetview' | 'map_pin' | 'upload';

export interface Lead {
  name: string;
  email: string;
  phone: string;
  suburb: string;
  wantsQuote: boolean;
  address?: string;
  colourId: string;
  finish: string;
  facts?: HouseFacts;
  price?: PriceBand;
  source: InputSource;
  referrer?: string;
  utm?: Record<string, string>;
  device?: string;
  timeSpentMs?: number;
}

export interface GenerateRequest {
  /** data URL or base64 (no prefix). For 'render' the original photo; for 'recolour' the first render. */
  imageBase64: string;
  mimeType: string;
  colourId: string;
  /** 'render' = full render from the original photo. 'recolour' = only swap the colour on an existing render. */
  mode?: 'render' | 'recolour';
}

export interface GenerateResult {
  imageBase64: string;
  mimeType: string;
  mocked: boolean;
  engine: string;
  ms: number;
}
