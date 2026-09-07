# Render My Home — Brisbane Rendering

A high-conversion lead-gen visualiser: a homeowner finds their address or uploads a
photo, sees their house photo-realistically **cement rendered** in seconds, tries
Australia's most popular Dulux colours, gets an indicative price, and unlocks the
full-resolution before/after by leaving their details.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · Vercel · Supabase ·
Gemini 2.5 Flash Image ("nano banana") render engine · Resend email · generic CRM webhook.

> **It runs with no API keys.** Missing keys degrade gracefully (mock render returns the
> original image, DB/email/CRM become no-ops) so you can click the entire flow before billing.

---

## 1. Quick start

```bash
cd render-my-home
npm install
cp .env.example .env.local   # fill in what you have; blanks are fine for a dry run
npm run dev                  # http://localhost:3000
```

Type-check without running: `npm run typecheck`.

---

## 2. System architecture

```
Browser (Next.js client)
  ├─ AddressSearch ──(Places JS)──► Google Places Autocomplete
  │                                    └─ on select ► /api/streetview (server, key hidden)
  ├─ UploadDropzone ─ HEIC→JPEG + downscale in-browser
  │
  └─ Visualiser (state machine) ──► /api/generate ──► Gemini 2.5 Flash Image
                                └──► /api/estimate ──► pricing.ts (your methodology)
                                └──► /api/lead      ──► Supabase + Resend + CRM webhook

Vercel (hosting + route handlers as functions)  Supabase (Postgres + RLS)
```

**Why these choices**
- **Gemini nano-banana / instruction editing** preserves everything it isn't told to change —
  the only reliable way to get "render the walls, keep roof/windows/garden/sky identical" without
  the CGI look. The engine is isolated in `src/lib/gemini.ts`; swap to Flux Kontext/SDXL there
  without touching UI or routes.
- **Keys never reach the browser.** Street View, Gemini, Supabase service role, Resend and the
  CRM webhook all run only in `/api/*` route handlers.

## 3. Database schema
See [`supabase/schema.sql`](supabase/schema.sql). Tables: `projects` (saved/shareable renders),
`leads`, `events` (funnel mirror). RLS on; only the service role writes; public read limited to
shared projects by `share_slug`.

## 4. API integrations
| Route | Purpose | Server key |
|---|---|---|
| `GET /api/streetview` | Fetch Street View static image (gated by `STREETVIEW_RENDER_ENABLED`) | `GOOGLE_STREETVIEW_API_KEY` |
| `POST /api/generate` | Render engine + rate limit | `GEMINI_API_KEY` |
| `POST /api/estimate` | Area heuristic → price band | — |
| `POST /api/lead` | Persist + email + CRM webhook + Turnstile | Supabase / Resend / CRM |
| Places Autocomplete | Client JS, referrer-restricted | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` |

## 5. Component hierarchy
```
app/page.tsx → Visualiser
  ├─ AddressSearch | UploadDropzone      (input)
  ├─ ProgressStages                      (generating)
  ├─ BeforeAfterSlider                   (result, blurred until unlock)
  ├─ ColourSwatches · FinishToggles      (live re-render, cached per option-signature)
  ├─ PriceEstimate
  └─ LeadGate → reveal
```

## 6. UX flow
Input (address/upload) → progress stages → blurred before/after + colours/toggles + price →
lead gate → full-res reveal + download + emailed result. Colour/finish changes re-render live
and are cached, so re-selecting a colour is instant.

## 7. Folder structure
```
render-my-home/
  netlify.toml · next.config.js · tailwind.config.ts · .env.example
  supabase/schema.sql
  src/
    app/  layout.tsx · page.tsx · globals.css · api/{generate,estimate,streetview,lead}/route.ts
    components/  Visualiser · AddressSearch · UploadDropzone · ColourSwatches ·
                 FinishToggles · BeforeAfterSlider · ProgressStages · PriceEstimate · LeadGate
    lib/  types · colours · prompt · pricing · gemini · supabase · analytics
```

## 8. Environment variables
See [`.env.example`](.env.example) — every var documented inline.

## 9. Deployment (Vercel)
1. Push the repo to GitHub; **Add New → Project** in Vercel and import it. Next.js is
   detected, so the build command and output directory need no configuration.
2. Add all env vars under **Project → Settings → Environment variables** (server keys
   **without** `NEXT_PUBLIC_`).
3. Run `supabase/schema.sql` in the Supabase SQL editor — optional; the app runs without a
   database and only `leads` is written by the current code.
4. Restrict the Maps key by HTTP referrer to your domain; keep Street View/Gemini keys server-side.
5. Deploy. Verify `/api/generate` returns `mocked:true` until `GEMINI_API_KEY` is set.

**Function duration.** `/api/generate`, `/api/classify` and `/api/property-image` declare
`maxDuration = 60`. Renders measured at 15–40s, so the previous 26s — Netlify Pro's
ceiling — failed the slow ones. 60s is the Vercel Hobby maximum; Pro allows more if
renders ever grow past it.

**Do not set `TURNSTILE_SECRET_KEY` yet.** No client code sends a Turnstile token, and
`/api/lead` rejects a submission when a secret is configured but no token arrives — so
setting it alone turns every lead into a 400. Wire the widget first.

## 10. Cost per visualisation (indicative, AUD)
| Item | Cost |
|---|---|
| Gemini 2.5 Flash Image | ~$0.04 / image |
| Typical session (default + 2–4 colour tries) | 3–5 images → **$0.12–$0.20** |
| Places autocomplete (session-tokened) | ~$0.017 |
| Street View static (find only) | ~$0.007 |
| **All-in per completed session** | **≈ $0.15–$0.25** |
| Email (Resend) | ~$0 within free tier |

At **100 sessions/day ≈ $15–25/day** variable cost. Cost is not the constraint — quality and
abuse control are.

## 11. Scaling to 100+/day
- Route handlers are stateless → Netlify autoscaling handles concurrency.
- Add **Upstash Redis** for distributed rate limiting (the in-memory limiter is per-instance).
- Cache renders in Supabase Storage keyed by `hash(image)+optionSignature` to avoid re-billing
  repeat colour selections across sessions.
- Move long/upscale renders to a **Netlify Background Function** (>26s) or a queue.
- Pre-warm the six default colours per home in parallel so swatch clicks feel instant.

## 12. Security & abuse prevention
- **All secrets server-side**; only `NEXT_PUBLIC_*` (Maps key + GA + Turnstile site key) ship to the client.
- **Cloudflare Turnstile** on lead submit (invisible); verified in `/api/lead`.
- **Rate limiting** on `/api/generate` (per-IP window; upgrade to Redis for prod).
- **Payload guards**: image size cap + client downscale to ~1600px.
- **RLS** locks the DB; service role only in server routes.
- **Content safety**: the render prompt is fixed server-side — users can't inject arbitrary prompts.
- Restrict Google keys (referrer for Maps JS, server-only for Street View/Gemini).

## 13. CRM
Every lead fires one normalised webhook (`render_my_home.lead`) with an optional shared secret —
point it at HubSpot / Simpro / GoHighLevel / Zapier / Make. Native adapters can subscribe to the
same `/api/lead` event later without UI changes.

## 14. Phased rollout
- **MVP (this build):** upload/address → render → 6 colours → before/after → price → lead gate →
  email + webhook. GA4 funnel events wired.
- **Beta:** map-pin picker, storey detection (vision pass) for tighter pricing, save/share URLs
  (`/p/[slug]`), 3-up colour compare, Turnstile + Redis limiting, Storage-backed image URLs in emails.
- **Production:** AI upsell suggestions (rendered fence/mailbox, darker gutters, modern garage),
  contextual FAQ + timeline modules, native CRM adapters, A/B on the lead-gate position.

---

### Known limitations (be honest with customers)
- AI renders are **indicative**, not exact — include a "regenerate" affordance and the on-image
  disclaimer for the occasional dud (poor-quality/obstructed input photos are the main cause).
- Pricing is anchored to Brisbane Rendering's **own published guide** (single storey $13,300–$18,350;
  two storey $20,470–$32,130, render + paint inc GST) in `src/lib/pricing.ts`, adjusted by
  storeys/complexity + add-ons. Single-photo estimates are **wide bands** by design — always paired
  with "subject to onsite inspection". Update the constants if the guide changes.
- **Street View render path** is enabled per your decision but is contrary to Google Maps terms
  (AI-modifying/storing imagery). It's isolated behind `STREETVIEW_RENDER_ENABLED=false` so you can
  disable it instantly. Upload-first remains the higher-quality, lower-risk path.
- Swatch hexes in `src/lib/colours.ts` are indicative — verify against official Dulux swatches
  before launch.
```
