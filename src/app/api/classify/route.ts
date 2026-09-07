import { NextRequest, NextResponse } from 'next/server';
import { classifyHouse } from '@/lib/classify';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { imageBase64?: string; mimeType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  if (!body?.imageBase64 || !body?.mimeType) {
    return NextResponse.json({ error: 'Missing imageBase64 or mimeType' }, { status: 400 });
  }

  try {
    const result = await classifyHouse(body.imageBase64, body.mimeType);
    return NextResponse.json(result);
  } catch (err: any) {
    // Never block the flow — default to lowset on failure.
    console.error('[classify] error', err);
    return NextResponse.json({
      type: 'lowset',
      storeys: 1,
      confidence: 'low',
      reason: 'Could not classify automatically',
      mocked: false,
    });
  }
}
