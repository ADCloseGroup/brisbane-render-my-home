'use client';

import { useState } from 'react';

export interface LeadForm {
  name: string;
  email: string;
  phone: string;
  suburb: string;
  wantsQuote: boolean;
}

export default function LeadGate({
  defaultSuburb,
  onSubmit,
  submitting,
}: {
  defaultSuburb?: string;
  onSubmit: (f: LeadForm) => void;
  submitting?: boolean;
}) {
  const [f, setF] = useState<LeadForm>({
    name: '',
    email: '',
    phone: '',
    suburb: defaultSuburb ?? '',
    wantsQuote: true,
  });
  const [err, setErr] = useState<string | null>(null);

  const set = (patch: Partial<LeadForm>) => setF((s) => ({ ...s, ...patch }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!f.name || !f.email || !f.phone || !f.suburb) {
          setErr('Please complete all fields.');
          return;
        }
        setErr(null);
        onSubmit(f);
      }}
      className="rounded-2xl bg-white p-5 shadow-lift ring-1 ring-black/5"
    >
      <h3 className="text-lg font-semibold">See your home in full resolution</h3>
      <p className="mt-1 text-sm text-stone-500">
        Enter your details to unlock the high-resolution before &amp; after and get your indicative quote by email.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <input className="rmh-field" placeholder="Full name" value={f.name} onChange={(e) => set({ name: e.target.value })} />
        <input className="rmh-field" placeholder="Suburb" value={f.suburb} onChange={(e) => set({ suburb: e.target.value })} />
        <input className="rmh-field" type="email" placeholder="Email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
        <input className="rmh-field" type="tel" placeholder="Phone" value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-brand" checked={f.wantsQuote} onChange={(e) => set({ wantsQuote: e.target.checked })} />
        I&rsquo;d like a free fixed quotation.
      </label>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="mt-4 w-full rounded-xl bg-brand px-4 py-3 font-semibold text-white shadow-lift transition hover:bg-brand-dark disabled:opacity-60"
      >
        {submitting ? 'Unlocking…' : 'Reveal my rendered home'}
      </button>
      <p className="mt-2 text-center text-xs text-stone-400">No spam. We only use your details to prepare your quote.</p>

      <style jsx>{`
        :global(.rmh-field) {
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 0.75rem;
          padding: 0.7rem 0.9rem;
          font-size: 1rem;
          outline: none;
          background: #fff;
        }
        :global(.rmh-field:focus) {
          border-color: #1c7c54;
          box-shadow: 0 0 0 3px rgba(28, 124, 84, 0.25);
        }
      `}</style>
    </form>
  );
}
