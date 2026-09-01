import { NextRequest, NextResponse } from 'next/server';
import { renderHouse } from '@/lib/gemini';
import type { GenerateRequest } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 26;

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || 'anon';
  if (limited(ip)) {
    return NextResponse.json({ error: 'Too many requests, slow down a moment.' }, { status: 429 });
  }

  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body?.imageBase64 || !body?.mimeType || !body?.colourId) {
    return NextResponse.json({ error: 'Missing imageBase64, mimeType or colourId' }, { status: 400 });
  }

  if (body.imageBase64.length > 11_000_000) {
    return NextResponse.json({ error: 'Image too large. Please use an image under ~6MB.' }, { status: 413 });
  }

  try {
    const result = await renderHouse(body);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[generate] error', err);
    return NextResponse.json(
      { error: err?.message || 'Render failed. Please try again.' },
      { status: 502 }
    );
  }
}
