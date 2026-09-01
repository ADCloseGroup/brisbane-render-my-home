import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Server-side Street View Static fetch. Keeps GOOGLE_STREETVIEW_API_KEY off the
 * client. Returns the image as base64 so it can be fed straight to /generate.
 *
 * NOTE: Google's Maps/Street View terms restrict AI-modifying and storing this
 * imagery. This route is gated behind STREETVIEW_RENDER_ENABLED so it can be
 * switched off instantly. Business owner has accepted this risk knowingly.
 */
export async function GET(req: NextRequest) {
  if (process.env.STREETVIEW_RENDER_ENABLED === 'false') {
    return NextResponse.json({ error: 'Street View render disabled — please upload a photo.' }, { status: 403 });
  }

  const key = process.env.GOOGLE_STREETVIEW_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Street View not configured' }, { status: 501 });
  }

  const { searchParams } = new URL(req.url);
  const location = searchParams.get('location'); // "lat,lng" or address
  const heading = searchParams.get('heading') ?? '';
  const pitch = searchParams.get('pitch') ?? '0';
  const fov = searchParams.get('fov') ?? '80';
  if (!location) {
    return NextResponse.json({ error: 'Missing location' }, { status: 400 });
  }

  // Check metadata first (free) so we don't render a "no imagery" grey box.
  const metaUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodeURIComponent(
    location
  )}&key=${key}`;
  const meta = await fetch(metaUrl).then((r) => r.json()).catch(() => null);
  if (!meta || meta.status !== 'OK') {
    return NextResponse.json(
      { error: 'No Street View imagery here. Try dropping a pin or uploading a photo.', status: meta?.status },
      { status: 404 }
    );
  }

  const imgUrl =
    `https://maps.googleapis.com/maps/api/streetview?size=1024x768` +
    `&location=${encodeURIComponent(location)}` +
    (heading ? `&heading=${encodeURIComponent(heading)}` : '') +
    `&pitch=${encodeURIComponent(pitch)}&fov=${encodeURIComponent(fov)}&return_error_code=true&key=${key}`;

  const res = await fetch(imgUrl);
  if (!res.ok) {
    return NextResponse.json({ error: 'Street View fetch failed' }, { status: 502 });
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const base64 = buf.toString('base64');

  return NextResponse.json({
    imageBase64: base64,
    mimeType: 'image/jpeg',
    panoId: meta.pano_id,
    location: meta.location, // { lat, lng }
  });
}
