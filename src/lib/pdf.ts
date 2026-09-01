import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { LOGO_PNG_BASE64 } from './logoBase64';
import { formatAUD } from './pricing';

export interface EstimateInput {
  name: string;
  address?: string;
  suburb: string;
  colourName: string;
  houseType: string; // 'Lowset (single)' | 'Highset (double)'
  priceLow: number;
  priceHigh: number;
}

const NAVY = rgb(0.043, 0.125, 0.22);
const TEAL = rgb(0.082, 0.588, 0.722);
const GREY = rgb(0.35, 0.4, 0.45);
const LIGHT = rgb(0.93, 0.95, 0.96);

// Keep text within WinAnsi so pdf-lib's standard fonts never throw.
function safe(s: string): string {
  return (s || '')
    .replace(/[—–]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^\x20-\x7E\n]/g, '');
}

export async function generateEstimatePdf(input: EstimateInput): Promise<string> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = await doc.embedPng(Uint8Array.from(atob(LOGO_PNG_BASE64), (c) => c.charCodeAt(0)));

  const M = 48;
  let y = height - M;

  // Logo
  const lw = 190;
  const lh = (logo.height / logo.width) * lw;
  page.drawImage(logo, { x: M, y: y - lh, width: lw, height: lh });

  // Right-aligned meta
  const today = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric' });
  page.drawText('ESTIMATION', { x: width - M - bold.widthOfTextAtSize('ESTIMATION', 18), y: y - 14, size: 18, font: bold, color: NAVY });
  page.drawText(today, { x: width - M - font.widthOfTextAtSize(today, 10), y: y - 30, size: 10, font, color: GREY });
  y -= lh + 24;

  // Divider
  page.drawRectangle({ x: M, y, width: width - 2 * M, height: 2, color: TEAL });
  y -= 26;

  // Client / site
  const line = (label: string, value: string) => {
    page.drawText(label, { x: M, y, size: 9, font: bold, color: TEAL });
    page.drawText(safe(value), { x: M + 92, y, size: 11, font, color: NAVY });
    y -= 18;
  };
  line('PREPARED FOR', input.name);
  if (input.address) line('PROPERTY', input.address);
  else line('SUBURB', input.suburb);
  line('SCOPE', 'Render & paint to house');
  line('COLOUR', input.colourName);
  line('HOUSE TYPE', input.houseType);
  y -= 10;

  // Price band box
  const boxH = 68;
  page.drawRectangle({ x: M, y: y - boxH, width: width - 2 * M, height: boxH, color: LIGHT });
  page.drawText('INDICATIVE INVESTMENT (incl. render + paint & GST)', { x: M + 16, y: y - 22, size: 9, font: bold, color: GREY });
  const band = `${formatAUD(input.priceLow)}  -  ${formatAUD(input.priceHigh)}`;
  page.drawText(band, { x: M + 16, y: y - 50, size: 24, font: bold, color: NAVY });
  y -= boxH + 24;

  // Body copy
  const para = (text: string, opts: { size?: number; font?: any; color?: any; gap?: number } = {}) => {
    const size = opts.size ?? 10;
    const f = opts.font ?? font;
    const color = opts.color ?? GREY;
    const maxW = width - 2 * M;
    const words = safe(text).split(/\s+/);
    let lineStr = '';
    const flush = () => {
      if (lineStr) {
        page.drawText(lineStr, { x: M, y, size, font: f, color });
        y -= size + 4;
        lineStr = '';
      }
    };
    for (const w of words) {
      const trial = lineStr ? lineStr + ' ' + w : w;
      if (f.widthOfTextAtSize(trial, size) > maxW) {
        flush();
        lineStr = w;
      } else lineStr = trial;
    }
    flush();
    y -= opts.gap ?? 8;
  };

  para('RENDER & PAINT TO HOUSE', { size: 12, font: bold, color: NAVY, gap: 6 });
  para(
    'MPAC Enterprise Pty Ltd T/A Brisbane Rendering would like to thank you for the opportunity to provide an estimate for your project. We pride ourselves on delivering the highest standard of work in our industry, and it is for this reason that all work completed by us is covered by a 7-year product and workmanship warranty.'
  );
  para(
    'The price is a lump sum and includes all labour and premium Queensland-made materials, including UV-resistant PVC external angles and pre-blended acrylic cement render. It also allows for the preparation of surfaces, including protection of existing fixtures through the use of builders film, masking tape and drop sheets.'
  );
  para('We kindly ask that you do not request a discount for cash transactions, as refusal may offend.');
  para('WE OFFER A FREE IN-HOME COLOUR CONSULTATION FROM A QUALIFIED INTERIOR DESIGNER.', { size: 11, font: bold, color: TEAL, gap: 12 });
  para(
    'This is an indicative estimate generated from a photo via our online visualiser. It is not a fixed quotation - your final fixed-price quote is confirmed after a free onsite inspection.',
    { size: 8, color: GREY }
  );

  // Footer
  page.drawRectangle({ x: 0, y: 0, width, height: 46, color: NAVY });
  const foot = 'Brisbane Rendering  |  0473 591 232  |  sales@brisbanerendering.com.au  |  ABN 66 613 381 472';
  page.drawText(foot, { x: M, y: 18, size: 9, font, color: rgb(1, 1, 1) });

  const bytes = await doc.save();
  // base64 without data-url prefix (for Simpro Base64Data + email attachment)
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  return btoa(bin);
}
