create extension if not exists pgcrypto with schema extensions;

-- ROLES
create type public.app_role as enum ('customer','mechanic','admin','security_admin');
create type public.request_status as enum ('sent','accepted','declined','in_progress','completed','cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  town text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles readable" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'security_admin'));

create policy "own profile read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  insert into public.user_roles (user_id, role) values (new.id, 'customer');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- LEDGER (hash chain)
create table public.ledger_blocks (
  block_index integer primary key,
  ts bigint not null,
  event_type text not null,
  record_type text not null,
  record_ref text not null,
  payload text not null,
  data_hash text not null,
  prev_hash text not null,
  block_hash text not null unique,
  network text not null default 'AutoHelp Ledger (simulated hash-chain)',
  created_at timestamptz not null default now()
);
grant select on public.ledger_blocks to anon, authenticated;
grant all on public.ledger_blocks to service_role;
alter table public.ledger_blocks enable row level security;
create policy "ledger is public" on public.ledger_blocks for select to anon, authenticated using (true);

create or replace function public.ledger_append(_event text, _record_type text, _record_ref text, _data jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  _idx integer; _prev text; _ts bigint; _payload text; _dh text;
begin
  perform pg_advisory_xact_lock(424242);
  select block_index, block_hash into _idx, _prev from public.ledger_blocks order by block_index desc limit 1;
  if _idx is null then _idx := -1; _prev := repeat('0',64); end if;
  _idx := _idx + 1;
  _ts := floor(extract(epoch from clock_timestamp()))::bigint;
  _payload := (_data || jsonb_build_object('event', _event, 'recordType', _record_type, 'recordRef', _record_ref, 'timestamp', _ts))::text;
  _dh := encode(extensions.digest(convert_to(_payload,'UTF8'),'sha256'),'hex');
  insert into public.ledger_blocks (block_index, ts, event_type, record_type, record_ref, payload, data_hash, prev_hash, block_hash)
  values (_idx, _ts, _event, _record_type, _record_ref, _payload, _dh, _prev,
    encode(extensions.digest(convert_to(_idx::text||'|'||_prev||'|'||_dh||'|'||_ts::text,'UTF8'),'sha256'),'hex'));
end $$;
revoke execute on function public.ledger_append(text,text,text,jsonb) from public, anon, authenticated;

select public.ledger_append('GENESIS','system','AUTOHELP-LS','{"note":"AutoHelp Lesotho ledger genesis"}'::jsonb);

-- MECHANICS
create sequence public.mechanic_code_seq start 1;
create table public.mechanics (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('MECH-' || lpad(nextval('public.mechanic_code_seq')::text, 3, '0')),
  user_id uuid unique,
  name text not null,
  workshop text not null,
  town text not null,
  specialties text[] not null default '{}',
  experience_years integer not null default 1,
  rating numeric(2,1) not null default 0,
  jobs_completed integer not null default 0,
  available boolean not null default true,
  verified boolean not null default false,
  photo_key text,
  bio text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.mechanics to anon, authenticated;
grant insert, update on public.mechanics to authenticated;
grant all on public.mechanics to service_role;
alter table public.mechanics enable row level security;
create policy "verified mechanics public" on public.mechanics for select to anon, authenticated
  using (verified or user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "apply as mechanic" on public.mechanics for insert to authenticated
  with check (user_id = auth.uid() and verified = false and is_demo = false);
create policy "owner or admin update" on public.mechanics for update to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'))
  with check (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create or replace function public.mechanics_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') and auth.uid() is not null then
    if new.verified <> old.verified or new.rating <> old.rating or new.jobs_completed <> old.jobs_completed
       or new.code <> old.code or new.user_id is distinct from old.user_id or new.is_demo <> old.is_demo then
      raise exception 'Only an administrator can change verification, ratings or job counts';
    end if;
  end if;
  return new;
end $$;
create trigger mechanics_guard before update on public.mechanics for each row execute function public.mechanics_guard();

create or replace function public.mechanics_ledger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.verified and (tg_op = 'INSERT' or not old.verified) then
    perform public.ledger_append('MECHANIC_VERIFIED','mechanic',new.code, jsonb_build_object('mechanicId', new.code));
    if new.user_id is not null then
      insert into public.user_roles (user_id, role) values (new.user_id,'mechanic') on conflict do nothing;
    end if;
  end if;
  return new;
end $$;
create trigger mechanics_ledger after insert or update on public.mechanics for each row execute function public.mechanics_ledger();

-- SERVICE REQUESTS
create sequence public.request_ref_seq start 8901;
create table public.service_requests (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('REQ-2026-' || nextval('public.request_ref_seq')::text),
  customer_id uuid not null,
  mechanic_id uuid not null references public.mechanics(id) on delete cascade,
  category text not null,
  vehicle_make text not null,
  vehicle_model text not null,
  vehicle_year integer,
  description text not null default '',
  contact_phone text,
  status public.request_status not null default 'sent',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.service_requests to authenticated;
grant all on public.service_requests to service_role;
alter table public.service_requests enable row level security;

create or replace function public.is_assigned_mechanic(_mechanic_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.mechanics where id = _mechanic_id and user_id = auth.uid())
$$;

create policy "customer, assigned mechanic, admin read" on public.service_requests for select to authenticated
  using (customer_id = auth.uid() or public.is_assigned_mechanic(mechanic_id) or public.has_role(auth.uid(),'admin'));
create policy "customer creates own" on public.service_requests for insert to authenticated
  with check (customer_id = auth.uid() and status = 'sent');
create policy "customer, mechanic, admin update" on public.service_requests for update to authenticated
  using (customer_id = auth.uid() or public.is_assigned_mechanic(mechanic_id) or public.has_role(auth.uid(),'admin'));

create or replace function public.requests_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare _is_mech boolean; _ok boolean := false;
begin
  if new.customer_id <> old.customer_id or new.mechanic_id <> old.mechanic_id or new.ref <> old.ref then
    raise exception 'Request ownership cannot be changed';
  end if;
  if public.has_role(auth.uid(),'admin') or auth.uid() is null then
    _ok := true;
  else
    _is_mech := public.is_assigned_mechanic(old.mechanic_id);
    if _is_mech and (
      (old.status='sent' and new.status in ('accepted','declined')) or
      (old.status='accepted' and new.status='in_progress') or
      (old.status='in_progress' and new.status='completed')) then _ok := true; end if;
    if old.customer_id = auth.uid() and old.status in ('sent','accepted') and new.status='cancelled' then _ok := true; end if;
    if new.status = old.status then _ok := false; end if;
    if _ok and (new.description <> old.description or new.category <> old.category) then _ok := false; end if;
  end if;
  if not _ok then raise exception 'This status change is not allowed for your role'; end if;
  new.updated_at := now();
  return new;
end $$;
create trigger requests_guard before update on public.service_requests for each row execute function public.requests_guard();

create or replace function public.requests_ledger()
returns trigger language plpgsql security definer set search_path = public as $$
declare _code text;
begin
  select code into _code from public.mechanics where id = new.mechanic_id;
  if tg_op = 'INSERT' then
    perform public.ledger_append('REQUEST_SENT','service_request',new.ref, jsonb_build_object('requestId',new.ref,'mechanicId',_code,'category',new.category,'status','sent'));
  elsif new.status <> old.status then
    perform public.ledger_append('REQUEST_' || upper(new.status::text),'service_request',new.ref, jsonb_build_object('requestId',new.ref,'mechanicId',_code,'status',new.status::text));
    if new.status = 'completed' then
      update public.mechanics set jobs_completed = jobs_completed + 1 where id = new.mechanic_id;
    end if;
  end if;
  return new;
end $$;
create trigger requests_ledger after insert or update on public.service_requests for each row execute function public.requests_ledger();

-- REVIEWS
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.service_requests(id) on delete cascade,
  customer_id uuid not null,
  mechanic_id uuid not null references public.mechanics(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;
grant all on public.reviews to service_role;
alter table public.reviews enable row level security;
create policy "reviews public" on public.reviews for select to anon, authenticated using (true);
create policy "customer reviews own completed job" on public.reviews for insert to authenticated
  with check (customer_id = auth.uid() and exists (
    select 1 from public.service_requests r where r.id = request_id and r.customer_id = auth.uid() and r.status='completed' and r.mechanic_id = reviews.mechanic_id));

create or replace function public.reviews_ledger()
returns trigger language plpgsql security definer set search_path = public as $$
declare _code text; _ref text; _avg numeric;
begin
  select code into _code from public.mechanics where id = new.mechanic_id;
  select ref into _ref from public.service_requests where id = new.request_id;
  perform public.ledger_append('REVIEW_SUBMITTED','review',_ref, jsonb_build_object('requestId',_ref,'mechanicId',_code,'rating',new.rating));
  select round(avg(rating)::numeric,1) into _avg from public.reviews where mechanic_id = new.mechanic_id;
  update public.mechanics set rating = _avg where id = new.mechanic_id;
  return new;
end $$;
create trigger reviews_ledger after insert on public.reviews for each row execute function public.reviews_ledger();

-- DEMO MECHANICS (clearly labelled demo data)
insert into public.mechanics (name, workshop, town, specialties, experience_years, rating, jobs_completed, available, verified, photo_key, bio, is_demo) values
('Thabo Mokhesi','Mokhesi Motor Works','Maseru – Ha Thetsane',array['Engine','Brakes'],12,4.8,214,true,true,'thabo','Engine diagnostics and overhauls for Toyota, Nissan and VW – the cars Basotho drive every day.',true),
('Lineo Ramotsoane','Lineo Auto Electrics','Teyateyaneng',array['Electrical','Battery'],8,4.9,156,true,true,'lineo','Auto-electrician: alternators, starters, wiring faults and dashboard warning lights.',true),
('Neo Kali','Kali Tyre & Wheel','Maputsoe',array['Tyre','Brakes'],6,4.6,301,false,true,'neo','Tyre fitting, puncture repair and wheel balancing near the border post.',true),
('Mpho Litha','Litha Brake Centre','Mafeteng',array['Brakes','Engine'],10,4.7,188,true,true,null,'Brake pads, discs and suspension checks for gravel-road driving.',true),
('Palesa Mohapi','Mohapi Battery Hub','Hlotse, Leribe',array['Battery','Electrical'],5,4.5,97,true,true,null,'Battery testing, jump starts and replacements across Leribe district.',true),
('Teboho Nkuebe','Nkuebe Garage','Mohale''s Hoek',array['Engine','Other'],15,4.8,342,true,true,null,'General servicing, cooling systems and mountain-pass breakdown recovery.',true);
