import type { DuluxColour } from './types';

/**
 * Curated shortlist of Brisbane Rendering's most-specified exterior colours.
 * Each carries a hex + plain-English description that we feed to the render
 * engine — naming the Dulux colour alone is NOT reliable (Gemini renders
 * "Dieskau" wrong without a hex anchor), so we describe the target precisely.
 */
export const DULUX_COLOURS: DuluxColour[] = [
  {
    id: 'tranquil-retreat',
    name: 'Dulux Tranquil Retreat',
    hex: '#c7c3b4',
    description: 'a soft, warm grey-green greige — muted and natural, not white',
    popular: true,
  },
  {
    id: 'lexicon-quarter',
    name: 'Dulux Lexicon Quarter',
    hex: '#eef0ef',
    description: 'a crisp, cool off-white with the faintest grey-blue undertone',
    popular: true,
  },
  {
    id: 'natural-white',
    name: 'Dulux Natural White',
    hex: '#efe9db',
    description: 'a soft, warm off-white with a gentle creamy undertone',
    popular: true,
  },
  {
    id: 'dieskau',
    name: 'Dulux Dieskau',
    hex: '#cbc9c5',
    description: 'a soft, warm mid-grey with a gentle greige undertone',
    popular: true,
  },
];

export const DEFAULT_COLOUR_ID = 'tranquil-retreat';

export function getColour(id: string): DuluxColour {
  return DULUX_COLOURS.find((c) => c.id === id) ?? DULUX_COLOURS[0];
}
