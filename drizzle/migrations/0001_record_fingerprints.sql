alter table public.ledger_blocks
  add column if not exists record_hash text,
  add column if not exists tx_hash text,
  add column if not exists block_number bigint,
  add column if not exists contract_address text;

create table if not exists public.ledger_fingerprint_secrets (
  block_index integer primary key references public.ledger_blocks(block_index) on delete restrict,
  fingerprint_salt bytea not null check (octet_length(fingerprint_salt) = 32)
);
alter table public.ledger_fingerprint_secrets enable row level security;
revoke all on public.ledger_fingerprint_secrets from public, anon, authenticated;
grant all on public.ledger_fingerprint_secrets to service_role;

create or replace function public.ledger_fingerprint_field(_value text)
returns text
language sql
immutable
set search_path = public, pg_catalog
as $$
  select case
    when _value is null then '~'
    else encode(convert_to(_value, 'UTF8'), 'hex')
  end
$$;

create or replace function public.mechanic_record_canonical(_mechanic public.mechanics)
returns text
language plpgsql
immutable
set search_path = public, pg_catalog
as $$
declare
  _specialties text;
begin
  select coalesce(string_agg(public.ledger_fingerprint_field(s), ',' order by ord), '')
    into _specialties
    from unnest(_mechanic.specialties) with ordinality as specialty(s, ord);

  return concat_ws('|',
    'autohelp:v1',
    'mechanic',
    public.ledger_fingerprint_field(_mechanic.code),
    public.ledger_fingerprint_field(_mechanic.name),
    public.ledger_fingerprint_field(_mechanic.workshop),
    public.ledger_fingerprint_field(_mechanic.town),
    _specialties,
    public.ledger_fingerprint_field(_mechanic.experience_years::text),
    public.ledger_fingerprint_field(_mechanic.verified::text)
  );
end
$$;

create or replace function public.request_record_canonical(
  _request public.service_requests,
  _mechanic_code text
)
returns text
language plpgsql
immutable
set search_path = public, pg_catalog
as $$
begin
  return concat_ws('|',
    'autohelp:v1',
    'service_request',
    public.ledger_fingerprint_field(_request.ref),
    public.ledger_fingerprint_field(_request.category),
    public.ledger_fingerprint_field(_mechanic_code),
    public.ledger_fingerprint_field(_request.status::text),
    public.ledger_fingerprint_field(_request.vehicle_make),
    public.ledger_fingerprint_field(_request.vehicle_model),
    public.ledger_fingerprint_field(_request.vehicle_year::text),
    public.ledger_fingerprint_field(_request.description),
    public.ledger_fingerprint_field(_request.contact_phone)
  );
end
$$;

create or replace function public.ledger_append(
  _event text,
  _record_type text,
  _record_ref text,
  _record_hash text,
  _fingerprint_salt bytea,
  _data jsonb
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _idx integer;
  _prev text;
  _ts bigint;
  _payload text;
  _data_hash text;
begin
  perform pg_advisory_xact_lock(424242);
  select block_index, block_hash into _idx, _prev
    from public.ledger_blocks order by block_index desc limit 1;
  if _idx is null then
    _idx := -1;
    _prev := repeat('0', 64);
  end if;
  _idx := _idx + 1;
  _ts := floor(extract(epoch from clock_timestamp()))::bigint;
  _payload := (coalesce(_data, '{}'::jsonb) || jsonb_build_object(
    'event', _event,
    'recordType', _record_type,
    'recordRef', _record_ref,
    'recordHash', _record_hash,
    'timestamp', _ts
  ))::text;
  _data_hash := encode(extensions.digest(convert_to(_payload, 'UTF8'), 'sha256'), 'hex');

  insert into public.ledger_blocks (
    block_index, ts, event_type, record_type, record_ref, payload, data_hash,
    record_hash, prev_hash, block_hash
  ) values (
    _idx, _ts, _event, _record_type, _record_ref, _payload, _data_hash,
    _record_hash, _prev,
    encode(extensions.digest(convert_to(
      _idx::text || '|' || _prev || '|' || _data_hash || '|' || _ts::text,
      'UTF8'
    ), 'sha256'), 'hex')
  );
  insert into public.ledger_fingerprint_secrets (block_index, fingerprint_salt)
  values (_idx, _fingerprint_salt);
end
$$;
revoke execute on function public.ledger_append(text, text, text, text, bytea, jsonb) from public, anon, authenticated;

create or replace function public.mechanics_ledger()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _event text;
  _record_hash text;
  _fingerprint_salt bytea;
begin
  if tg_op = 'INSERT' then
    _event := case when new.verified then 'MECHANIC_VERIFIED' else 'MECHANIC_UNVERIFIED' end;
  elsif old.verified is distinct from new.verified then
    _event := case when new.verified then 'MECHANIC_VERIFIED' else 'MECHANIC_UNVERIFIED' end;
  elsif old.code is distinct from new.code
    or old.name is distinct from new.name
    or old.workshop is distinct from new.workshop
    or old.town is distinct from new.town
    or old.specialties is distinct from new.specialties
    or old.experience_years is distinct from new.experience_years then
    _event := 'MECHANIC_UPDATED';
  else
    return new;
  end if;

  _fingerprint_salt := extensions.gen_random_bytes(32);
  _record_hash := encode(extensions.digest(
    convert_to(encode(_fingerprint_salt, 'hex') || '|' || public.mechanic_record_canonical(new), 'UTF8'), 'sha256'
  ), 'hex');
  perform public.ledger_append(
    _event,
    'mechanic',
    new.code,
    _record_hash,
    _fingerprint_salt,
    jsonb_build_object('verified', new.verified)
  );

  if new.verified and (tg_op = 'INSERT' or not old.verified) and new.user_id is not null then
    insert into public.user_roles (user_id, role)
    values (new.user_id, 'mechanic')
    on conflict do nothing;
  end if;
  return new;
end
$$;

create or replace function public.requests_ledger()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  _request public.service_requests;
  _code text;
  _event text;
  _record_hash text;
  _fingerprint_salt bytea;
begin
  if tg_op = 'DELETE' then
    _request := old;
    _event := 'REQUEST_DELETED';
  else
    _request := new;
    if tg_op = 'INSERT' then
      _event := 'REQUEST_SENT';
    elsif old.status is distinct from new.status then
      _event := 'REQUEST_' || upper(new.status::text);
    elsif old.category is distinct from new.category
      or old.vehicle_make is distinct from new.vehicle_make
      or old.vehicle_model is distinct from new.vehicle_model
      or old.vehicle_year is distinct from new.vehicle_year
      or old.description is distinct from new.description
      or old.contact_phone is distinct from new.contact_phone then
      _event := 'REQUEST_UPDATED';
    else
      return new;
    end if;
  end if;

  select code into _code from public.mechanics where id = _request.mechanic_id;
  _fingerprint_salt := extensions.gen_random_bytes(32);
  _record_hash := encode(extensions.digest(
    convert_to(encode(_fingerprint_salt, 'hex') || '|' || public.request_record_canonical(_request, _code), 'UTF8'), 'sha256'
  ), 'hex');
  perform public.ledger_append(
    _event,
    'service_request',
    _request.ref,
    _record_hash,
    _fingerprint_salt,
    jsonb_build_object('status', _request.status::text)
  );

  if tg_op = 'UPDATE' and old.status is distinct from new.status and new.status = 'completed' then
    update public.mechanics set jobs_completed = jobs_completed + 1 where id = new.mechanic_id;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists mechanics_ledger on public.mechanics;
create trigger mechanics_ledger
  after insert or update on public.mechanics
  for each row execute function public.mechanics_ledger();

drop trigger if exists requests_ledger on public.service_requests;
create trigger requests_ledger
  after insert or update or delete on public.service_requests
  for each row execute function public.requests_ledger();

create or replace function public.ledger_fingerprint_salt(_block_index integer)
returns text
language plpgsql
security definer
set search_path = public, auth, pg_catalog
as $$
declare
  _record_type text;
  _record_ref text;
  _allowed boolean := false;
  _salt text;
begin
  select record_type, record_ref into _record_type, _record_ref
    from public.ledger_blocks where block_index = _block_index;
  if not found then
    raise exception 'Ledger proof not found';
  end if;

  if _record_type = 'mechanic' then
    select exists (
      select 1 from public.mechanics
      where code = _record_ref
        and (verified or user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    ) into _allowed;
  elsif _record_type = 'service_request' and auth.uid() is not null then
    select exists (
      select 1 from public.service_requests
      where ref = _record_ref
        and (
          customer_id = auth.uid()
          or public.is_assigned_mechanic(mechanic_id)
          or public.has_role(auth.uid(), 'admin')
        )
    ) into _allowed;
  end if;

  if not _allowed then
    raise exception 'You are not authorized to verify this record';
  end if;

  select encode(fingerprint_salt, 'hex') into _salt
    from public.ledger_fingerprint_secrets where block_index = _block_index;
  if _salt is null then
    raise exception 'Fingerprint salt is unavailable for this proof';
  end if;
  return _salt;
end
$$;
revoke execute on function public.ledger_fingerprint_salt(integer) from public;
grant execute on function public.ledger_fingerprint_salt(integer) to anon, authenticated;

do $$
declare
  _mechanic public.mechanics;
  _request public.service_requests;
  _code text;
  _record_hash text;
  _fingerprint_salt bytea;
begin
  for _mechanic in select * from public.mechanics loop
    _fingerprint_salt := extensions.gen_random_bytes(32);
    _record_hash := encode(extensions.digest(
      convert_to(encode(_fingerprint_salt, 'hex') || '|' || public.mechanic_record_canonical(_mechanic), 'UTF8'), 'sha256'
    ), 'hex');
    perform public.ledger_append(
      case when _mechanic.verified then 'MECHANIC_VERIFIED' else 'MECHANIC_UNVERIFIED' end,
      'mechanic',
      _mechanic.code,
      _record_hash,
      _fingerprint_salt,
      jsonb_build_object('verified', _mechanic.verified)
    );
  end loop;

  for _request in select * from public.service_requests loop
    select code into _code from public.mechanics where id = _request.mechanic_id;
    _fingerprint_salt := extensions.gen_random_bytes(32);
    _record_hash := encode(extensions.digest(
      convert_to(encode(_fingerprint_salt, 'hex') || '|' || public.request_record_canonical(_request, _code), 'UTF8'), 'sha256'
    ), 'hex');
    perform public.ledger_append(
      'REQUEST_' || upper(_request.status::text),
      'service_request',
      _request.ref,
      _record_hash,
      _fingerprint_salt,
      jsonb_build_object('status', _request.status::text)
    );
  end loop;
end
$$;
