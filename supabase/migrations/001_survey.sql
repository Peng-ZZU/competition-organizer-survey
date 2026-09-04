create or replace function public.normalize_survey_identity(value text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(regexp_replace(btrim(coalesce(value, '')), '\s+', ' ', 'g'));
$$;

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  respondent_name text not null check (
    public.normalize_survey_identity(respondent_name) <> '' and char_length(respondent_name) <= 120
  ),
  organization text not null check (
    public.normalize_survey_identity(organization) <> '' and char_length(organization) <= 200
  ),
  normalized_name text generated always as (public.normalize_survey_identity(respondent_name)) stored,
  normalized_organization text generated always as (public.normalize_survey_identity(organization)) stored,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint survey_responses_normalized_identity_key
    unique (normalized_name, normalized_organization)
);

create or replace function public.load_survey_response(
  p_name text,
  p_organization text
)
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
  limit 1;
end;
$$;

create or replace function public.survey_choice_valid(
  p_answers jsonb,
  p_key text,
  p_allowed text[]
)
returns boolean
language sql
immutable
parallel safe
as $$
  select coalesce(
    jsonb_typeof(p_answers -> p_key) = 'string'
    and (p_answers ->> p_key) = any(p_allowed),
    false
  );
$$;

create or replace function public.survey_multi_valid(
  p_answers jsonb,
  p_key text,
  p_allowed text[]
)
returns boolean
language sql
immutable
parallel safe
as $$
  select coalesce(
    jsonb_typeof(p_answers -> p_key) = 'array'
    and jsonb_array_length(p_answers -> p_key) > 0
    and not exists (
      select 1
      from jsonb_array_elements_text(p_answers -> p_key) as selected(value)
      where selected.value <> all(p_allowed)
    ),
    false
  );
$$;

create or replace function public.survey_text_valid(
  p_answers jsonb,
  p_key text,
  p_required boolean default false
)
returns boolean
language sql
immutable
parallel safe
as $$
  select case
    when not (p_answers ? p_key) then not p_required
    when jsonb_typeof(p_answers -> p_key) <> 'string' then false
    when length(p_answers ->> p_key) > 5000 then false
    when p_required then btrim(p_answers ->> p_key) <> ''
    else true
  end;
$$;

create or replace function public.survey_answers_valid(p_answers jsonb)
returns boolean
language plpgsql
immutable
parallel safe
as $$
declare
  answer_key text;
  allowed_keys constant text[] := array[
    'q01','q02','q03','q04','q05','q06','q07','q07_other','q08','q09','q09_other',
    'q10','q11','q12','q12_other','q13','q14','q14_other','q15','q16','q17','q18',
    'q19','q20','q21','q22','q23','q24','q25','q26','q27','q28','q29','q30',
    'q31','q32','q33','q34'
  ];
begin
  if p_answers is null
     or jsonb_typeof(p_answers) <> 'object'
     or octet_length(p_answers::text) > 65536 then
    return false;
  end if;

  for answer_key in select jsonb_object_keys(p_answers)
  loop
    if answer_key <> all(allowed_keys) then return false; end if;
  end loop;

  if not public.survey_choice_valid(p_answers, 'q01', array['0','1-2','3+']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q02', array['Yes','No']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q03', array['0','1-4','5-9','10+']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q04', array['0','1-4','5-9','10+']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q05', array['Yes','No']) then return false; end if;
  if not public.survey_multi_valid(p_answers, 'q07', array['Academic','University Student','High School Student','Industry','Other']) then return false; end if;
  if not public.survey_multi_valid(p_answers, 'q08', array['Africa','Asia','Australasia','Europe','Latin America','North America','South America']) then return false; end if;
  if not public.survey_multi_valid(p_answers, 'q09', array['Framework','Sample or Baseline Solutions','Reference Paper','Tutorial','Data','Other']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q11', array['Yes','No']) then return false; end if;
  if not public.survey_multi_valid(p_answers, 'q12', array['Newsletter','Website','Twitter','Facebook','Mailing List of Previous or Potential Participants','Publicity Chairs for Conference','Other']) then return false; end if;
  if not public.survey_multi_valid(p_answers, 'q14', array['In-Person Presentation','Virtual Presentation','Submitted Program for Ranking','Other']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q18', array['1','2','3','4','5']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q19', array['Yes','No']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q20', array['Yes','No']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q21', array['Yes','No']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q22', array['Yes','No']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q24', array['Yes','No']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q25', array['Yes','No']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q31', array['Yes','No']) then return false; end if;

  if (p_answers ->> 'q05') = 'Yes' then
    if not public.survey_text_valid(p_answers, 'q06', true) then return false; end if;
  elsif coalesce(btrim(p_answers ->> 'q06'), '') <> '' then return false;
  end if;

  if (p_answers -> 'q09') @> '["Data"]'::jsonb then
    if not public.survey_choice_valid(p_answers, 'q10', array['Yes','No']) then return false; end if;
  elsif p_answers ? 'q10' then return false;
  end if;

  if (p_answers ->> 'q16') = 'Yes' then
    if not public.survey_text_valid(p_answers, 'q17', true) then return false; end if;
  elsif coalesce(btrim(p_answers ->> 'q17'), '') <> '' then return false;
  end if;

  if (p_answers ->> 'q25') = 'Yes' then
    if not public.survey_text_valid(p_answers, 'q26', true) then return false; end if;
  elsif coalesce(btrim(p_answers ->> 'q26'), '') <> '' then return false;
  end if;

  if (p_answers -> 'q07') @> '["Other"]'::jsonb then
    if not public.survey_text_valid(p_answers, 'q07_other', true) then return false; end if;
  elsif coalesce(btrim(p_answers ->> 'q07_other'), '') <> '' then return false;
  end if;
  if (p_answers -> 'q09') @> '["Other"]'::jsonb then
    if not public.survey_text_valid(p_answers, 'q09_other', true) then return false; end if;
  elsif coalesce(btrim(p_answers ->> 'q09_other'), '') <> '' then return false;
  end if;
  if (p_answers -> 'q12') @> '["Other"]'::jsonb then
    if not public.survey_text_valid(p_answers, 'q12_other', true) then return false; end if;
  elsif coalesce(btrim(p_answers ->> 'q12_other'), '') <> '' then return false;
  end if;
  if (p_answers -> 'q14') @> '["Other"]'::jsonb then
    if not public.survey_text_valid(p_answers, 'q14_other', true) then return false; end if;
  elsif coalesce(btrim(p_answers ->> 'q14_other'), '') <> '' then return false;
  end if;

  if not public.survey_text_valid(p_answers, 'q13') then return false; end if;
  if not public.survey_text_valid(p_answers, 'q15') then return false; end if;
  if not public.survey_text_valid(p_answers, 'q23') then return false; end if;
  if not public.survey_text_valid(p_answers, 'q27') then return false; end if;
  if not public.survey_text_valid(p_answers, 'q28') then return false; end if;
  if not public.survey_text_valid(p_answers, 'q29') then return false; end if;
  if not public.survey_text_valid(p_answers, 'q30') then return false; end if;
  if not public.survey_text_valid(p_answers, 'q32') then return false; end if;
  if not public.survey_text_valid(p_answers, 'q33') then return false; end if;
  if not public.survey_text_valid(p_answers, 'q34') then return false; end if;

  return true;
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

create table public.survey_admins (
  user_id uuid primary key,
  created_at timestamptz not null default now()
);

create or replace function public.is_survey_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.survey_admins a
    where a.user_id = auth.uid()
  );
$$;

alter table public.survey_responses enable row level security;
alter table public.survey_admins enable row level security;

create policy survey_admin_read_responses
on public.survey_responses
for select
to authenticated
using (public.is_survey_admin());

revoke all on table public.survey_responses from anon, authenticated;
revoke all on table public.survey_admins from anon, authenticated;
grant select on table public.survey_responses to authenticated;

revoke all on function public.normalize_survey_identity(text) from public;
revoke all on function public.survey_choice_valid(jsonb, text, text[]) from public;
revoke all on function public.survey_multi_valid(jsonb, text, text[]) from public;
revoke all on function public.survey_text_valid(jsonb, text, boolean) from public;
revoke all on function public.survey_answers_valid(jsonb) from public;
revoke all on function public.is_survey_admin() from public;
revoke all on function public.load_survey_response(text, text) from public;
revoke all on function public.save_survey_response(text, text, jsonb, integer) from public;

grant usage on schema public to anon, authenticated;
grant execute on function public.load_survey_response(text, text) to anon, authenticated;
grant execute on function public.save_survey_response(text, text, jsonb, integer) to anon, authenticated;
grant execute on function public.is_survey_admin() to authenticated;
