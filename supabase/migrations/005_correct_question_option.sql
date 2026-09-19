-- Correct the geographic option label and prevent public partial submissions.
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
  if not public.survey_optional_choice_valid(p_answers, 'q05', array['Yes','No']) then return false; end if;
  if not public.survey_multi_valid(p_answers, 'q07', array['Academic','University Student','High School Student','Industry','Other']) then return false; end if;
  if not public.survey_multi_valid(p_answers, 'q08', array['Africa','Asia','Austria','Europe','Latin America','North America','South America']) then return false; end if;
  if not public.survey_multi_valid(p_answers, 'q09', array['Framework','Sample or Baseline Solutions','Reference Paper','Tutorial','Data','Other']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q11', array['Yes','No']) then return false; end if;
  if not public.survey_multi_valid(p_answers, 'q12', array['Newsletter','Website','Twitter','Facebook','Mailing List of Previous or Potential Participants','Publicity Chairs for Conference','Other']) then return false; end if;
  if not public.survey_multi_valid(p_answers, 'q14', array['In-Person Presentation','Virtual Presentation','Submitted Program for Ranking','Other']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q18', array['1','2','3','4','5']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q19', array['Yes','No']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q20', array['Yes','No']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q21', array['Yes','No']) then return false; end if;
  if not public.survey_optional_choice_valid(p_answers, 'q22', array['Yes','No']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q24', array['Yes','No']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q25', array['Yes','No']) then return false; end if;
  if not public.survey_choice_valid(p_answers, 'q31', array['Yes','No']) then return false; end if;

  if (p_answers ->> 'q05') = 'Yes' then
    if not public.survey_text_valid(p_answers, 'q06', true) then return false; end if;
  elsif coalesce(btrim(p_answers ->> 'q06'), '') <> '' then return false;
  end if;

  if (p_answers -> 'q09') @> '["Data"]'::jsonb then
    if not public.survey_optional_choice_valid(p_answers, 'q10', array['Yes','No']) then return false; end if;
  elsif p_answers ? 'q10' then return false;
  end if;

  if (p_answers ->> 'q16') = 'Yes' then
    if not public.survey_text_valid(p_answers, 'q17') then return false; end if;
  elsif coalesce(btrim(p_answers ->> 'q17'), '') <> '' then return false;
  end if;

  if (p_answers ->> 'q25') = 'Yes' then
    if not public.survey_text_valid(p_answers, 'q26') then return false; end if;
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

revoke execute on function public.save_partial_survey_response(text, text, jsonb, integer) from anon, authenticated;
