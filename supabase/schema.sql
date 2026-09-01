-- ─────────────────────────────────────────────────────────────
--  Render My Home — Supabase schema
--  Run in Supabase SQL editor. RLS on; only the service role writes
--  (used by /api/lead). No anon writes.
-- ─────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";

-- Saved visualiser projects (for the "save / shareable URL" feature).
create table if not exists projects (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  source        text not null,                       -- address_streetview | map_pin | upload
  address       text,
  suburb        text,
  colour_id     text not null,
  finish        text not null default 'smooth',
  options       jsonb not null default '{}'::jsonb,  -- feature wall, fence, etc.
  facts         jsonb,                               -- storeys, wallAreaM2, complexity
  price         jsonb,                               -- {low, high, ...}
  before_url    text,                                -- storage URL
  after_url     text,
  share_slug    text unique,                         -- short public slug for /p/[slug]
  utm           jsonb,
  referrer      text,
  device        text
);

-- Captured leads.
create table if not exists leads (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  project_id    uuid references projects(id) on delete set null,
  name          text not null,
  email         text not null,
  phone         text not null,
  suburb        text not null,
  wants_quote   boolean not null default false,
  address       text,
  colour_id     text not null,
  finish        text not null,
  facts         jsonb,
  price         jsonb,
  source        text not null,
  referrer      text,
  utm           jsonb,
  device        text,
  time_spent_ms integer,
  crm_synced    boolean not null default false
);
create index if not exists leads_created_idx on leads (created_at desc);
create index if not exists leads_email_idx on leads (email);

-- Funnel analytics (server-side mirror of GA4 events, optional but useful).
create table if not exists events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  session_id  text,
  event       text not null,
  props       jsonb,
  project_id  uuid references projects(id) on delete set null
);
create index if not exists events_event_idx on events (event, created_at desc);

-- RLS: lock everything; service role bypasses RLS automatically.
alter table projects enable row level security;
alter table leads    enable row level security;
alter table events   enable row level security;

-- Public read of a project by share_slug (for the shareable page), nothing else.
create policy "public read shared projects"
  on projects for select
  using (share_slug is not null);
