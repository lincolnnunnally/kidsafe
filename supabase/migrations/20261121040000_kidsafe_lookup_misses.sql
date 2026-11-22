-- Kid Safe: unknown tag codes typed or opened, per (hashed) address, so someone trying code after
-- code is paused (20 misses in 10 minutes). Kept in the database because the site runs on many
-- server instances at once, where an in-memory count never adds up. Server-only. Rows older than a
-- day are deleted as new ones are written.

create table if not exists public.ks_lookup_misses (
  id bigint generated always as identity primary key,
  key text not null check (char_length(key) <= 64),
  created_at timestamptz not null default now()
);
create index if not exists ks_lookup_misses_key_idx on public.ks_lookup_misses(key, created_at desc);
alter table public.ks_lookup_misses enable row level security;
revoke all on public.ks_lookup_misses from anon, authenticated;
grant all on public.ks_lookup_misses to service_role;
