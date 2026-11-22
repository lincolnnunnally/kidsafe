-- Kid Safe: "Email me when engraved tags are ready" (2026-11-21). Engraved tags are not on sale yet,
-- so the home page offers a waitlist instead of a buy button. Written only by the server route
-- (/api/kids/waitlist, service role); nobody can read or write it from a browser.

create table if not exists public.ks_waitlist (
  email text primary key check (char_length(email) between 5 and 320),
  created_at timestamptz not null default now()
);

alter table public.ks_waitlist enable row level security;
revoke all on public.ks_waitlist from anon, authenticated;
grant all on public.ks_waitlist to service_role;
