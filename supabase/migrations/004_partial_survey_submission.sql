-- Allow an intentional partial save while retaining strict validation of every supplied answer.
create or replace function public.survey_answers_partial_valid(p_answers jsonb)
returns boolean
language sql
immutable
parallel safe
as $$
  select public.survey_answers_valid(
    jsonb_build_object(
      'q01','0','q02','No','q03','0','q04','0',
      'q07', jsonb_build_array('Academic'),
      'q08', jsonb_build_array('Asia'),
      'q09', jsonb_build_array('Framework'),
      'q11','No',
      'q12', jsonb_build_array('Website'),
      'q14', jsonb_build_array('Virtual Presentation'),
      'q16','No','q18','3','q19','No','q20','No','q21','No',
      'q24','No','q25','No','q31','No'
    ) || p_answers
  );
$$;

create or replace function public.save_partial_survey_response(
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
     or not public.survey_answers_partial_valid(p_answers) then
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

revoke all on function public.survey_answers_partial_valid(jsonb) from public;
revoke all on function public.save_partial_survey_response(text, text, jsonb, integer) from public;
grant execute on function public.save_partial_survey_response(text, text, jsonb, integer) to anon, authenticated;
