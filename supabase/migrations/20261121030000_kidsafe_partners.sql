-- Kid Safe partners (owner, 2026-11-21): the same partner path as FurFriend's
-- (20261120020000_furfriend_tag_partners.sql and the display-board migrations), for places
-- parents go: daycares, pediatric offices, kids' clothing and toy stores, sports facilities,
-- amusement parks, cruise lines, hotels and family vacation spots.
--
-- What's different from FurFriend: a kid tag carries no name and no phone. A partner can keep
-- blank (unclaimed) tags; a parent scans one and registers it to their child on the spot
-- (ks_claim_tag). Money (tag prices, partner share) is not set yet, so there is no ledger here;
-- it gets the same shape as ff_partner_ledger once Lincoln sets the terms.
--
-- Own ks_ tables, so nothing about a pet partner leaks into Kid Safe and FurFriend is untouched.
-- Who reads what (same as FurFriend): a partner reads its own row; admins (ff_is_admin) read all;
-- every write goes through server routes with the service role.

create table if not exists public.ks_partners (
  id uuid primary key default gen_random_uuid(),
  slug text unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,23}$'),
  name text not null check (char_length(name) between 2 and 80),
  kind text not null default 'other' check (kind in (
    'daycare','pediatrician','dentist','kids_store','toy_store','sports','school','church',
    'amusement','cruise','hotel','camp','other')),
  contact_name text check (char_length(contact_name) <= 80),
  email text not null check (char_length(email) <= 200),
  phone text check (char_length(phone) <= 30),
  address text check (char_length(address) <= 200),
  website text check (char_length(website) <= 200),
  interest text not null default 'both' check (interest in ('display','stock','both')),
  status text not null default 'applied' check (status in ('applied','approved','paused','declined')),
  owner_id uuid unique references auth.users(id) on delete set null,
  claim_token text unique check (claim_token ~ '^[A-Za-z0-9_-]{20,64}$'),
  visits int not null default 0,
  board_requested_at timestamptz,
  board_sent_at timestamptz,
  note text check (char_length(note) <= 500),
  admin_note text check (char_length(admin_note) <= 500),
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Blank tags made for a partner to hand out (or for the owner's own stock).
create table if not exists public.ks_tag_batches (
  id uuid primary key default gen_random_uuid(),
  label text not null default '' check (char_length(label) <= 80),
  quantity int not null check (quantity between 1 and 500),
  partner_id uuid references public.ks_partners(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.ks_tags add column if not exists batch_id uuid references public.ks_tag_batches(id) on delete set null;
alter table public.ks_tags add column if not exists claimed_at timestamptz;
create index if not exists ks_tags_batch_idx on public.ks_tags(batch_id);

-- The partner whose display or tag brought this family in (first one wins).
alter table public.ks_families add column if not exists partner_id uuid references public.ks_partners(id) on delete set null;

-- Counter displays. The owner prints or makes one, brings it to a place, and the manager scans
-- its QR (kidsafe.unitedundergod.org/b/CODE) to become a partner on the spot.
create table if not exists public.ks_display_boards (
  code text primary key check (code ~ '^[2-9A-HJ-NP-Z]{6}$'),
  partner_id uuid references public.ks_partners(id) on delete set null,
  note text check (char_length(note) <= 200),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create or replace function public.ks_partner_visit(pid uuid)
returns void language sql security definer set search_path = '' as $$
  update public.ks_partners set visits = visits + 1 where id = pid and status = 'approved';
$$;
revoke all on function public.ks_partner_visit(uuid) from public, anon, authenticated;
grant execute on function public.ks_partner_visit(uuid) to service_role;

-- A parent registers a blank tag (from a partner, or the owner's stock) to one of their children.
create or replace function public.ks_claim_tag(tag_code text, for_child uuid)
returns public.ks_tags language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  clean text := upper(regexp_replace(coalesce(tag_code, ''), '[^A-Za-z0-9]', '', 'g'));
  claimed public.ks_tags;
begin
  if me is null then raise exception 'Sign in to set up a tag.'; end if;
  if not exists (select 1 from public.ks_children c where c.id = for_child and c.owner_id = me) then
    raise exception 'Pick one of your own children for this tag.';
  end if;
  update public.ks_tags t set owner_id = me, child_id = for_child, claimed_at = now()
    where t.code = clean and t.owner_id is null
    returning * into claimed;
  if claimed.code is null then
    if exists (select 1 from public.ks_tags t where t.code = clean and t.owner_id = me) then
      update public.ks_tags t set child_id = for_child where t.code = clean returning * into claimed;
      return claimed;
    end if;
    if exists (select 1 from public.ks_tags t where t.code = clean) then
      raise exception 'That tag is already set up for another family.';
    end if;
    raise exception 'We could not find that tag. Check the letters under the QR code.';
  end if;
  return claimed;
end $$;

-- Remove a tag from your family. A tag that came blank (from a batch) goes back to blank, so the
-- code printed on it never belongs to anyone else's child by accident; one you made is deleted.
create or replace function public.ks_release_tag(tag_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  t public.ks_tags;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  select * into t from public.ks_tags where code = tag_code and owner_id = me;
  if t.code is null then raise exception 'That tag is not yours to remove.'; end if;
  delete from public.ks_tag_scans s where s.code = tag_code;
  if t.batch_id is null then
    delete from public.ks_tags where code = tag_code;
  else
    update public.ks_tags set owner_id = null, child_id = null, label = null, claimed_at = null where code = tag_code;
  end if;
end $$;

revoke all on function public.ks_claim_tag(text, uuid) from public, anon;
revoke all on function public.ks_release_tag(text) from public, anon;
grant execute on function public.ks_claim_tag(text, uuid) to authenticated;
grant execute on function public.ks_release_tag(text) to authenticated;

alter table public.ks_partners enable row level security;
alter table public.ks_tag_batches enable row level security;
alter table public.ks_display_boards enable row level security;

-- Partners and admins read through server routes only (the claim token must never reach a browser),
-- so the browser roles get nothing on these tables.
revoke all on public.ks_partners, public.ks_tag_batches, public.ks_display_boards from anon, authenticated;
grant all on public.ks_partners, public.ks_tag_batches, public.ks_display_boards to service_role;

-- A blank tag a parent registered can't be deleted outright (its code is printed on a tag a
-- partner handed out); ks_release_tag puts it back to blank instead.
drop policy if exists ks_tags_del on public.ks_tags;
create policy ks_tags_del on public.ks_tags for delete to authenticated using (owner_id = auth.uid() and batch_id is null);
