'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Accepts JPG/PNG/HEIC. HEIC is converted to JPEG in-browser via heic2any.
 * Returns a data URL + mime to the parent.
 */
export default function UploadDropzone({
  onImage,
}: {
  onImage: (dataUrl: string, mimeType: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setErr(null);
      setBusy(true);
      try {
        let blob: Blob = file;
        let mime = file.type;
        const isHeic = /heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
        if (isHeic) {
          const heic2any = (await import('heic2any')).default as any;
          blob = (await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })) as Blob;
          mime = 'image/jpeg';
        }
        // Downscale very large images client-side to keep payload < ~6MB.
        const dataUrl = await downscale(blob, mime, 1600);
        onImage(dataUrl, mime.startsWith('image/') ? mime : 'image/jpeg');
      } catch (e: any) {
        setErr(e?.message || 'Could not read that image. Try a JPG or PNG.');
      } finally {
        setBusy(false);
      }
    },
    [onImage]
  );

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={[
          'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition',
          drag ? 'border-brand bg-brand/5' : 'border-black/15 hover:border-black/30 bg-white/50',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,.heic,.heif"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {busy ? (
          <p className="text-sm text-stone-500">Processing image…</p>
        ) : (
          <>
            <div className="mb-2 text-2xl">📷</div>
            <p className="font-medium">Upload a photo of the front of your home</p>
            <p className="mt-1 text-sm text-stone-400">Drag &amp; drop, or tap to choose · JPG, PNG or HEIC</p>
          </>
        )}
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <p className="mt-2 text-xs text-stone-400">
        Tip: stand square-on to the house, in daylight, with the whole façade in frame for the most realistic result.
      </p>
    </div>
  );
}

async function downscale(blob: Blob, mime: string, maxDim: number): Promise<string> {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, w, h);
  return canvas.toDataURL(mime === 'image/png' ? 'image/png' : 'image/jpeg', 0.92);
}
