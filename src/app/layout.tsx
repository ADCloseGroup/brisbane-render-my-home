import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'Render My Home — Brisbane Rendering',
  description:
    'See your own home professionally cement rendered in under 2 minutes. Instant, photo-realistic preview and indicative quote.',
  openGraph: {
    title: 'Render My Home — Brisbane Rendering',
    description: 'See your home rendered in seconds. Photo-realistic. Free indicative quote.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f1211',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const ga = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
  return (
    <html lang="en-AU">
      <body>
        {children}
        {ga ? (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
            <Script id="ga4" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga}');`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
