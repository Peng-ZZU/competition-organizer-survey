alter table public.survey_responses
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'survey_responses_delete_audit_consistent'
      and conrelid = 'public.survey_responses'::regclass
  ) then
    alter table public.survey_responses
      add constraint survey_responses_delete_audit_consistent check (
        (deleted_at is null and deleted_by is null)
        or (deleted_at is not null and deleted_by is not null)
      );
  end if;
end;
$$;

create or replace function public.require_survey_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if not public.is_survey_admin() then
    raise exception 'administrator access required' using errcode = '42501';
  end if;
  return current_user_id;
end;
$$;

create or replace function public.load_survey_response(p_name text, p_organization text)
returns table (
  id uuid,
  respondent_name text,
  organization text,
  answers jsonb,
  version integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.normalize_survey_identity(p_name) = ''
     or public.normalize_survey_identity(p_organization) = ''
     or char_length(p_name) > 120
     or char_length(p_organization) > 200 then
    raise exception 'invalid survey identity' using errcode = '22023';
  end if;

  return query
  select r.id, r.respondent_name, r.organization, r.answers,
         r.version, r.created_at, r.updated_at
  from public.survey_responses r
  where r.normalized_name = public.normalize_survey_identity(p_name)
    and r.normalized_organization = public.normalize_survey_identity(p_organization)
    and r.deleted_at is null
  limit 1;
end;
$$;

create or replace function public.save_survey_response(
  p_name text,
  p_organization text,
  p_answers jsonb,
  p_expected_version integer default null
)
returns table (
  status text,
  response_id uuid,
  response_version integer,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing public.survey_responses%rowtype;
  saved public.survey_responses%rowtype;
begin
  if public.normalize_survey_identity(p_name) = ''
     or public.normalize_survey_identity(p_organization) = ''
     or char_length(p_name) > 120
     or char_length(p_organization) > 200
     or not public.survey_answers_valid(p_answers) then
    raise exception 'invalid survey answers or identity' using errcode = '22023';
  end if;

  select r.* into existing
  from public.survey_responses r
  where r.normalized_name = public.normalize_survey_identity(p_name)
    and r.normalized_organization = public.normalize_survey_identity(p_organization)
  for update;

  if found then
    if existing.deleted_at is not null then
      if p_expected_version is not null and p_expected_version <> 0 then
        status := 'conflict';
        response_id := existing.id;
        response_version := existing.version;
        created_at := existing.created_at;
        updated_at := existing.updated_at;
        return next;
        return;
      end if;

      update public.survey_responses r
      set respondent_name = btrim(p_name),
          organization = btrim(p_organization),
          answers = p_answers,
          version = r.version + 1,
          updated_at = now(),
          deleted_at = null,
          deleted_by = null
      where r.id = existing.id
      returning r.* into saved;
    else
      if p_expected_version is null or p_expected_version <> existing.version then
        status := 'conflict';
        response_id := existing.id;
        response_version := existing.version;
        created_at := existing.created_at;
        updated_at := existing.updated_at;
        return next;
        return;
      end if;

      update public.survey_responses r
      set respondent_name = btrim(p_name),
          organization = btrim(p_organization),
          answers = p_answers,
          version = r.version + 1,
          updated_at = now()
      where r.id = existing.id
      returning r.* into saved;
    end if;
  else
    if p_expected_version is not null and p_expected_version <> 0 then
      status := 'conflict';
      response_version := 0;
      return next;
      return;
    end if;

    begin
      insert into public.survey_responses (respondent_name, organization, answers)
      values (btrim(p_name), btrim(p_organization), p_answers)
      returning * into saved;
    exception when unique_violation then
      select r.* into saved
      from public.survey_responses r
      where r.normalized_name = public.normalize_survey_identity(p_name)
        and r.normalized_organization = public.normalize_survey_identity(p_organization);
      status := 'conflict';
      response_id := saved.id;
      response_version := saved.version;
      created_at := saved.created_at;
      updated_at := saved.updated_at;
      return next;
      return;
    end;
  end if;

  status := 'saved';
  response_id := saved.id;
  response_version := saved.version;
  created_at := saved.created_at;
  updated_at := saved.updated_at;
  return next;
end;
$$;

create or replace function public.list_deleted_survey_responses()
returns setof public.survey_responses
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  perform public.require_survey_admin();
  return query
  select r.*
  from public.survey_responses r
  where r.deleted_at is not null
  order by r.deleted_at desc;
end;
$$;

create or replace function public.soft_delete_survey_response(p_response_id uuid, p_expected_version integer)
returns table (status text, response_id uuid, response_version integer, deleted_at timestamptz)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  admin_id uuid := public.require_survey_admin();
  existing public.survey_responses%rowtype;
  saved public.survey_responses%rowtype;
begin
  select r.* into existing from public.survey_responses r where r.id = p_response_id for update;
  if not found then
    return query select 'not_found'::text, p_response_id, 0, null::timestamptz;
    return;
  end if;
  if p_expected_version is null or existing.deleted_at is not null or existing.version <> p_expected_version then
    return query select 'conflict'::text, existing.id, existing.version, existing.deleted_at;
    return;
  end if;

  update public.survey_responses r
  set deleted_at = now(), deleted_by = admin_id, version = r.version + 1, updated_at = now()
  where r.id = existing.id
  returning r.* into saved;
  return query select 'deleted'::text, saved.id, saved.version, saved.deleted_at;
end;
$$;

create or replace function public.restore_survey_response(p_response_id uuid, p_expected_version integer)
returns table (status text, response_id uuid, response_version integer)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  existing public.survey_responses%rowtype;
  saved public.survey_responses%rowtype;
begin
  perform public.require_survey_admin();
  select r.* into existing from public.survey_responses r where r.id = p_response_id for update;
  if not found then
    return query select 'not_found'::text, p_response_id, 0;
    return;
  end if;
  if p_expected_version is null or existing.deleted_at is null or existing.version <> p_expected_version then
    return query select 'conflict'::text, existing.id, existing.version;
    return;
  end if;

  update public.survey_responses r
  set deleted_at = null, deleted_by = null, version = r.version + 1, updated_at = now()
  where r.id = existing.id
  returning r.* into saved;
  return query select 'restored'::text, saved.id, saved.version;
end;
$$;

create or replace function public.permanently_delete_survey_response(
  p_response_id uuid,
  p_expected_version integer,
  p_confirm_name text
)
returns table (status text, response_id uuid)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  existing public.survey_responses%rowtype;
begin
  perform public.require_survey_admin();
  select r.* into existing from public.survey_responses r where r.id = p_response_id for update;
  if not found then
    return query select 'not_found'::text, p_response_id;
    return;
  end if;
  if p_expected_version is null or existing.deleted_at is null or existing.version <> p_expected_version then
    return query select 'conflict'::text, existing.id;
    return;
  end if;
  if p_confirm_name is distinct from existing.respondent_name then
    raise exception 'confirmation name does not match' using errcode = '22023';
  end if;

  delete from public.survey_responses r where r.id = existing.id;
  return query select 'permanently_deleted'::text, existing.id;
end;
$$;

drop policy survey_admin_read_responses on public.survey_responses;
create policy survey_admin_read_responses
on public.survey_responses
for select
to authenticated
using (public.is_survey_admin() and deleted_at is null);

revoke all on function public.require_survey_admin() from public;
revoke all on function public.list_deleted_survey_responses() from public;
revoke all on function public.soft_delete_survey_response(uuid, integer) from public;
revoke all on function public.restore_survey_response(uuid, integer) from public;
revoke all on function public.permanently_delete_survey_response(uuid, integer, text) from public;

grant execute on function public.list_deleted_survey_responses() to authenticated;
grant execute on function public.soft_delete_survey_response(uuid, integer) to authenticated;
grant execute on function public.restore_survey_response(uuid, integer) to authenticated;
grant execute on function public.permanently_delete_survey_response(uuid, integer, text) to authenticated;
