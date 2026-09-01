import { GoogleGenAI } from '@google/genai';

/**
 * Highset vs Lowset classifier — calibrated to Brisbane Rendering's labelled
 * dataset (Combined_Rate_Analysis.xlsx + ~2,200 CoreLogic/Street View photos).
 *
 * The decision rule learned from their high-confidence examples: count the
 * number of external WALL levels.
 *   - one level (living at/near ground)         → lowset  → 1 storey of wall
 *   - two levels (raised living over under-house
 *     OR a genuine full double-storey home)     → highset → 2 storeys of wall
 * A lowset on a sloping block / low retaining wall is still lowset.
 */
const MODEL = process.env.GEMINI_CLASSIFY_MODEL || 'gemini-2.5-flash';

export interface ClassifyResult {
  type: 'lowset' | 'highset';
  storeys: 1 | 2;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  mocked: boolean;
}

const PROMPT = `You are estimating cement-rendering for a Queensland home. Classify the house in this photo as LOWSET or HIGHSET.

Queensland definitions (decide by counting the levels of EXTERNAL WALL to be rendered):
- LOWSET: the main living level sits at or near ground level; a single-storey profile with ONE level of external wall. You reach the front door with few or no steps. A lowset on a sloping block or behind a low garden/retaining wall is STILL lowset.
- HIGHSET: the main living level is raised a full storey on brick/posts/piers, with an under-house level below (garage, laundry, rumpus or enclosed rooms), usually with a prominent staircase up to the entry. This shows TWO levels of external wall.
- Treat a genuine full DOUBLE-STOREY home (two complete living levels) as HIGHSET too — it also has two levels of wall.

Rules:
- Judge only the levels of wall. Ignore the roof pitch, gardens, cars and fences.
- If the house is heavily obscured or you genuinely cannot tell, choose lowset with confidence "low".

Respond with STRICT JSON only, no prose, no code fence:
{"type":"lowset"|"highset","confidence":"high"|"medium"|"low","reason":"one short sentence"}`;

function stripDataUrl(b64: string): string {
  const i = b64.indexOf('base64,');
  return i >= 0 ? b64.slice(i + 'base64,'.length) : b64;
}

export async function classifyHouse(imageBase64: string, mimeType: string): Promise<ClassifyResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { type: 'lowset', storeys: 1, confidence: 'low', reason: 'Classifier not configured', mocked: true };
  }

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: PROMPT },
          { inlineData: { mimeType, data: stripDataUrl(imageBase64) } },
        ],
      },
    ],
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p: any) => p.text).filter(Boolean).join(' ');
  const match = text.match(/\{[\s\S]*\}/);
  let parsed: any = {};
  try {
    parsed = JSON.parse(match ? match[0] : text);
  } catch {
    /* fall through to defaults */
  }

  const type: 'lowset' | 'highset' = parsed.type === 'highset' ? 'highset' : 'lowset';
  const confidence = ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium';
  return {
    type,
    storeys: type === 'highset' ? 2 : 1,
    confidence,
    reason: String(parsed.reason || ''),
    mocked: false,
  };
}
