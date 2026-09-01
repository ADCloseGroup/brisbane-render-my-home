import { GoogleGenAI } from '@google/genai';
import type { GenerateRequest, GenerateResult } from './types';
import { buildRenderPrompt, buildRecolourPrompt } from './prompt';
import { getColour } from './colours';

/**
 * Render engine adapter — provider-abstracted on purpose.
 * Swap this file to move to Flux Kontext / SDXL later without touching routes/UI.
 */
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

function stripDataUrl(b64: string): string {
  const i = b64.indexOf('base64,');
  return i >= 0 ? b64.slice(i + 'base64,'.length) : b64;
}

export async function renderHouse(req: GenerateRequest): Promise<GenerateResult> {
  const started = Date.now();
  const apiKey = process.env.GEMINI_API_KEY;
  const colour = getColour(req.colourId);
  const prompt = req.mode === 'recolour' ? buildRecolourPrompt(colour) : buildRenderPrompt(colour);

  // ── Mock fallback: no key → return the original so the whole flow is demoable.
  if (!apiKey) {
    return {
      imageBase64: stripDataUrl(req.imageBase64),
      mimeType: req.mimeType,
      mocked: true,
      engine: 'mock',
      ms: Date.now() - started,
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: req.mimeType,
              data: stripDataUrl(req.imageBase64),
            },
          },
        ],
      },
    ],
  });

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p: any) => p.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    const textPart = parts.find((p: any) => typeof p.text === 'string');
    throw new Error(
      `Render engine returned no image${textPart?.text ? `: ${textPart.text.slice(0, 200)}` : ''}`
    );
  }

  return {
    imageBase64: imagePart.inlineData.data,
    mimeType: imagePart.inlineData.mimeType || 'image/png',
    mocked: false,
    engine: MODEL,
    ms: Date.now() - started,
  };
}
