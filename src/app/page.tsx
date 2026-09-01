import Visualiser from '@/components/Visualiser';

const MAIN_SITE = 'https://brisbanerendering.com.au';
const PHONE = '0473 591 232';

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Brand bar */}
      <div className="border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <a href={MAIN_SITE} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/logo.png"
              alt="Brisbane Rendering"
              width={220}
              height={64}
              className="block h-8 w-auto max-w-[55vw] object-contain sm:h-10"
            />
          </a>
          <nav className="flex shrink-0 items-center gap-3 sm:gap-5">
            <a
              href={MAIN_SITE}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-sm font-medium text-navy hover:text-brand sm:inline"
            >
              ← Back to main site
            </a>
            <a
              href={`tel:${PHONE.replace(/\s/g, '')}`}
              className="whitespace-nowrap rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
            >
              Call {PHONE}
            </a>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <header className="mx-auto max-w-6xl px-5 pt-10 pb-4 sm:pt-14">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand-dark">
          <span className="inline-block h-2 w-2 rounded-full bg-brand" />
          The best finish starts with us
        </div>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-navy sm:text-6xl">
          See <span className="text-brand-dark">your home</span> professionally rendered — in under two minutes.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-stone-500">
          Find your address or upload a photo. We&rsquo;ll show you a photo-realistic preview,
          let you try Australia&rsquo;s most popular colours, and give you an indicative price.
        </p>
      </header>

      <Visualiser />

      {/* Footer */}
      <footer className="mt-16 border-t border-black/5 bg-white/70">
        <div className="mx-auto max-w-6xl px-5 py-10 text-sm text-stone-500">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo.png" alt="Brisbane Rendering" width={200} height={58} className="block h-8 w-auto object-contain opacity-90" />
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <a href={MAIN_SITE} target="_blank" rel="noopener noreferrer" className="hover:text-brand">Main website</a>
              <a href={`${MAIN_SITE}/our-work`} target="_blank" rel="noopener noreferrer" className="hover:text-brand">Our work</a>
              <a href={`${MAIN_SITE}/pricing-guide`} target="_blank" rel="noopener noreferrer" className="hover:text-brand">Pricing guide</a>
              <a href={`${MAIN_SITE}/contact`} target="_blank" rel="noopener noreferrer" className="hover:text-brand">Contact</a>
              <a href={`tel:${PHONE.replace(/\s/g, '')}`} className="font-medium text-navy hover:text-brand">{PHONE}</a>
            </div>
          </div>
          <p className="mt-6 text-xs text-stone-400">
            MPAC Enterprise Pty Ltd T/A Brisbane Rendering · ABN 66 613 381 472. Previews are AI-generated indicative
            visualisations only; final finish and colour are confirmed on site. Indicative pricing is not a fixed quotation.
          </p>
        </div>
      </footer>
    </main>
  );
}
