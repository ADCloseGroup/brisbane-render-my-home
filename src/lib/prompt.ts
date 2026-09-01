import type { DuluxColour } from './types';

/**
 * Base render prompt (first render, from the original photo).
 *
 * Tuned to REDUCE hallucination after real failures:
 *  - it was inventing/rendering a FENCE that wasn't there → we now forbid
 *    touching or adding any fence / boundary / garden / retaining wall
 *  - it sometimes redesigned the house → hard identity lock + "change too
 *    little rather than too much"
 *  - keeps the wanted cleanup (cars, bins, blur) but conservatively
 */
export function buildRenderPrompt(colour: DuluxColour): string {
  return [
    `You are a professional architectural photo retoucher making a CONSERVATIVE edit to the SINGLE photo provided.`,
    `Guiding principle: change as LITTLE as possible. It is far better to under-edit than to alter the house.`,
    ``,
    `MOST IMPORTANT — keep the EXACT same house. Preserve its precise architecture, overall shape, footprint,`,
    `number of storeys, rooflines, and the exact size, count and POSITION of every window, door and garage.`,
    `Do NOT redesign, reinterpret, restyle, extend or "improve" the building, and do NOT invent architectural`,
    `detail to fill a blurry or low-quality photo. Reproduce the SAME house that is there.`,
    ``,
    `WHAT TO CHANGE — ONLY the house's own external MASONRY WALLS. Make them look freshly cement-rendered and`,
    `painted in the colour "${colour.name}" (${colour.description}; approximately hex ${colour.hex}), reading`,
    `naturally lighter in sun and darker in shade like real exterior paint. Render only wall surfaces that are`,
    `clearly part of the house structure itself. If you are unsure whether a surface belongs to the house, LEAVE`,
    `IT UNCHANGED.`,
    ``,
    `NEVER TOUCH OR CREATE these (this is critical):`,
    `- Do NOT add, render, paint or recolour any FENCE, front fence, boundary wall, garden wall, retaining wall,`,
    `  pier, gate or letterbox. If a fence or wall exists, leave it EXACTLY as in the original photo. If none`,
    `  exists, do NOT create one.`,
    `- Do NOT add any structure, wall, storey, room, extension, window or door that is not clearly in the photo.`,
    `- Keep unchanged: the roof, gutters, fascia, eaves; all windows, glass and frames; garage doors, front door,`,
    `  timber/metal; the driveway, paths and paving; landscaping; and the sky.`,
    ``,
    `CLEANUP (conservative, optional) — only if it clearly improves the shot, you MAY: remove temporary foreground`,
    `clutter (parked cars, utes, trailers, caravans, boats, wheelie/rubbish bins, hoses, tools, bins), and reduce`,
    `Street View blur/haze so it looks like a clean photo. When you remove an object, fill the gap PLAINLY to`,
    `match the adjacent surface (wall stays wall, lawn stays lawn) — never invent new detail. If something is`,
    `mostly hidden, leave it rather than guess.`,
    ``,
    `HARD CONSTRAINTS:`,
    `1. Output EXACTLY ONE photograph, same dimensions, aspect ratio and framing as the input.`,
    `2. NEVER a before/after, side-by-side, split screen, diptych, grid or collage.`,
    `3. Do not skew, stretch, rotate, crop or shift the viewpoint or lighting.`,
    ``,
    `The result MUST look like a real, unedited photograph — not a 3D render, CGI, illustration or AI artwork.`,
  ].join('\n');
}

/**
 * Recolour prompt — SECOND+ colour on the same home. Feeds the first render
 * back in and changes ONLY the house-wall colour, so the house (and any fence)
 * stays identical across colours.
 */
export function buildRecolourPrompt(colour: DuluxColour): string {
  return [
    `You are making a CONSERVATIVE edit to a photo of a house whose walls are ALREADY cement-rendered.`,
    ``,
    `CHANGE ONLY THE COLOUR OF THE HOUSE'S OWN RENDERED WALLS to "${colour.name}" (${colour.description};`,
    `approximately hex ${colour.hex}), reading naturally lighter in sun and darker in shade like real paint.`,
    ``,
    `Do NOT recolour, render or alter any fence, boundary wall, garden wall, retaining wall, letterbox, roof,`,
    `window, door, garage, driveway, landscaping or sky. Do NOT add or remove anything. Do NOT change the`,
    `house's architecture, shape, framing, perspective or lighting in any way. ONLY the house wall colour changes.`,
    ``,
    `Output exactly ONE photograph, same dimensions and framing. Never a before/after, split screen or collage.`,
    `It must look like a real, unedited photograph — not CGI, illustration or AI artwork.`,
  ].join('\n');
}
