-- Kid Safe (kidsafe.unitedundergod.org): the FurFriend QR tag idea for children (owner, 2026-11-21).
--
-- A child wears a tag (bracelet, shoe or Croc tag, zipper pull). If they get lost, a security guard
-- or staff member scans it and reaches the parent in one tap. The parent keeps a profile for each
-- child, and can share an up-to-date "missing child" page with staff or police.
--
-- Same shape as the pet tags (20261118000000_furfriend_pet_tags.sql), in its own ks_ tables so a
-- child is never mixed into pet code:
--   * The scan page and the shared page never read these tables from the browser. Server routes
--     read them with the service role and return only what the parent chose to show.
--   * By default the scan page does NOT show the child's name or photo (a stranger who reads a
--     child's name can call them by it). The parent can turn either on, and both appear while the
--     child is marked missing.
--   * Scans are written only by the server route. A parent reads scans of their own tags under RLS.
--   * Tag codes and share links are made by security-definer functions from gen_random_bytes, so
--     they cannot be chosen or guessed.

create table if not exists public.ks_families (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  contact_name text check (char_length(contact_name) <= 60),
  phone text check (char_length(phone) <= 30),
  backup_name text check (char_length(backup_name) <= 60),
  backup_phone text check (char_length(backup_phone) <= 30),
  parent_photo_url text check (char_length(parent_photo_url) <= 500),
  show_parent_photo boolean not null default true,
  -- The parent ticked "text me when a tag is scanned" (their consent to alert texts), and when.
  text_alerts boolean not null default false,
  text_alerts_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ks_children (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 40),
  birth_year int check (birth_year between 1990 and 2100),
  photo_url text check (char_length(photo_url) <= 500),
  photo_at timestamptz,
  -- "Brown hair, glasses, about 4 feet tall"
  looks text check (char_length(looks) <= 200),
  -- "Red T-shirt, jean shorts, light-up sneakers" and when the parent last wrote it
  wearing text check (char_length(wearing) <= 200),
  wearing_at timestamptz,
  -- Allergies, medicine, "nonverbal", "autistic, may run, don't grab": shown to staff on every scan.
  needs_note text check (char_length(needs_note) <= 300),
  show_name boolean not null default false,
  show_photo boolean not null default false,
  missing boolean not null default false,
  missing_since timestamptz,
  missing_message text check (char_length(missing_message) <= 300),
  last_seen text check (char_length(last_seen) <= 200),
  share_token text unique,
  share_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ks_children_owner_idx on public.ks_children(owner_id);

create table if not exists public.ks_tags (
  code text primary key check (code ~ '^[A-Z0-9]{4,16}$'),
  owner_id uuid references auth.users(id) on delete cascade,
  child_id uuid references public.ks_children(id) on delete set null,
  -- "Shoe tag", "Blue bracelet"
  label text check (char_length(label) <= 40),
  created_at timestamptz not null default now()
);
create index if not exists ks_tags_owner_idx on public.ks_tags(owner_id);
create index if not exists ks_tags_child_idx on public.ks_tags(child_id);

create table if not exists public.ks_tag_scans (
  id uuid primary key default gen_random_uuid(),
  code text not null references public.ks_tags(code) on delete cascade,
  child_id uuid references public.ks_children(id) on delete set null,
  kind text not null default 'scan' check (kind in ('scan', 'location', 'message')),
  city text,
  region text,
  lat double precision,
  lng double precision,
  message text check (char_length(message) <= 500),
  finder_contact text check (char_length(finder_contact) <= 120),
  finder_key text,
  created_at timestamptz not null default now()
);
create index if not exists ks_tag_scans_code_idx on public.ks_tag_scans(code, created_at desc);
create index if not exists ks_tag_scans_child_idx on public.ks_tag_scans(child_id, created_at desc);

-- updated_at, missing_since, wearing_at, photo_at, text-alert consent time
create or replace function public.ks_children_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if new.missing and not old.missing then new.missing_since := now(); end if;
    if new.wearing is distinct from old.wearing then new.wearing_at := now(); end if;
    if new.photo_url is distinct from old.photo_url then new.photo_at := now(); end if;
  else
    if new.missing then new.missing_since := now(); end if;
    if new.wearing is not null then new.wearing_at := now(); end if;
    if new.photo_url is not null then new.photo_at := now(); end if;
  end if;
  if not new.missing then new.missing_since := null; end if;
  new.updated_at := now();
  if current_user <> 'authenticated' then return new; end if; -- definer functions, service role
  if tg_op = 'UPDATE' and (new.owner_id is distinct from old.owner_id
      or new.share_token is distinct from old.share_token
      or new.share_expires_at is distinct from old.share_expires_at) then
    raise exception 'Use Share or Stop sharing to change a child''s share link.';
  end if;
  if tg_op = 'INSERT' and (new.share_token is not null or new.share_expires_at is not null) then
    raise exception 'Use Share to make a share link.';
  end if;
  return new;
end $$;
drop trigger if exists ks_children_guard on public.ks_children;
create trigger ks_children_guard before insert or update on public.ks_children
  for each row execute function public.ks_children_guard();

create or replace function public.ks_families_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.text_alerts and (tg_op = 'INSERT' or not old.text_alerts or new.phone is distinct from old.phone) then
    new.text_alerts_at := now();
  end if;
  if not new.text_alerts then new.text_alerts_at := null; end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists ks_families_guard on public.ks_families;
create trigger ks_families_guard before insert or update on public.ks_families
  for each row execute function public.ks_families_guard();

create or replace function public.ks_tags_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if new.code is distinct from old.code or new.owner_id is distinct from old.owner_id then
    raise exception 'A tag''s code and family cannot be changed.';
  end if;
  if new.child_id is not null and new.child_id is distinct from old.child_id and not exists (
    select 1 from public.ks_children c where c.id = new.child_id and c.owner_id = auth.uid()
  ) then
    raise exception 'That child is not in your family.';
  end if;
  return new;
end $$;
drop trigger if exists ks_tags_guard on public.ks_tags;
create trigger ks_tags_guard before update on public.ks_tags
  for each row execute function public.ks_tags_guard();

-- n random characters from the burned-code alphabet (no 0/O/1/I/L), from a cryptographic source.
create or replace function public.ks_random_code(n int)
returns text language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(n);
  out text := '';
begin
  for i in 0 .. n - 1 loop
    out := out || substr(alphabet, (get_byte(bytes, i) % 31) + 1, 1);
  end loop;
  return out;
end $$;
revoke all on function public.ks_random_code(int) from public, anon, authenticated;

-- A new tag code for one of your own children (to engrave, or to print on a wristband card).
create or replace function public.ks_make_tag(for_child uuid, tag_label text default null)
returns public.ks_tags language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  made public.ks_tags;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if not exists (select 1 from public.ks_children c where c.id = for_child and c.owner_id = me) then
    raise exception 'Pick one of your own children for this tag.';
  end if;
  if (select count(*) from public.ks_tags t where t.owner_id = me) >= 40 then
    raise exception 'That is a lot of tags. Remove one you no longer use first.';
  end if;
  for attempt in 1 .. 5 loop
    begin
      insert into public.ks_tags (code, owner_id, child_id, label)
      values (public.ks_random_code(7), me, for_child, nullif(left(btrim(coalesce(tag_label, '')), 40), ''))
      returning * into made;
      return made;
    exception when unique_violation then
      -- a clash in 31^7 codes; try another
    end;
  end loop;
  raise exception 'Could not make a tag code just now. Please try again.';
end $$;

-- Turn on (or renew) a child's share link for the next `hours` hours (1 to 168). Returns the token.
create or replace function public.ks_share_child(for_child uuid, hours int default 72)
returns text language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  token text;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  select c.share_token into token from public.ks_children c where c.id = for_child and c.owner_id = me;
  if not found then raise exception 'That child is not in your family.'; end if;
  if token is null then token := lower(public.ks_random_code(12)); end if;
  update public.ks_children c
    set share_token = token, share_expires_at = now() + make_interval(hours => greatest(1, least(coalesce(hours, 72), 168)))
    where c.id = for_child;
  return token;
end $$;

create or replace function public.ks_stop_sharing(for_child uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  update public.ks_children c set share_token = null, share_expires_at = null
    where c.id = for_child and c.owner_id = auth.uid();
end $$;

revoke all on function public.ks_make_tag(uuid, text) from public, anon;
revoke all on function public.ks_share_child(uuid, int) from public, anon;
revoke all on function public.ks_stop_sharing(uuid) from public, anon;
grant execute on function public.ks_make_tag(uuid, text) to authenticated;
grant execute on function public.ks_share_child(uuid, int) to authenticated;
grant execute on function public.ks_stop_sharing(uuid) to authenticated;

alter table public.ks_families enable row level security;
alter table public.ks_children enable row level security;
alter table public.ks_tags enable row level security;
alter table public.ks_tag_scans enable row level security;

drop policy if exists ks_families_own on public.ks_families;
create policy ks_families_own on public.ks_families for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists ks_children_own on public.ks_children;
create policy ks_children_own on public.ks_children for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists ks_tags_sel on public.ks_tags;
create policy ks_tags_sel on public.ks_tags for select to authenticated using (owner_id = auth.uid());
drop policy if exists ks_tags_upd on public.ks_tags;
create policy ks_tags_upd on public.ks_tags for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists ks_tags_del on public.ks_tags;
create policy ks_tags_del on public.ks_tags for delete to authenticated using (owner_id = auth.uid());

drop policy if exists ks_tag_scans_sel on public.ks_tag_scans;
create policy ks_tag_scans_sel on public.ks_tag_scans for select to authenticated
  using (exists (select 1 from public.ks_tags t where t.code = ks_tag_scans.code and t.owner_id = auth.uid()));

revoke all on public.ks_families, public.ks_children, public.ks_tags, public.ks_tag_scans from anon;
grant select, insert, update, delete on public.ks_families, public.ks_children to authenticated;
grant select, update, delete on public.ks_tags to authenticated;
grant select on public.ks_tag_scans to authenticated;
grant all on public.ks_families, public.ks_children, public.ks_tags, public.ks_tag_scans to service_role;
