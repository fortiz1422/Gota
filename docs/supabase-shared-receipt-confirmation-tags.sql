-- Preserve the deployed confirmation function, ownership guards and ACL.
-- Only add persistence for the two tags already sent by the review UI.
do $migration$
declare
  original text;
  updated text;
  columns_before text := 'user_id, amount, currency, category, description, is_want,';
  values_before text := 'p_payload->>''category'', p_payload->>''description'', (p_payload->>''is_want'')::boolean,';
begin
  original := pg_get_functiondef('public.confirm_shared_receipt_purchase(uuid,uuid,jsonb,text)'::regprocedure);
  if position('is_want, is_recurring, is_extraordinary,' in original) > 0 then return; end if;
  if position(columns_before in original) = 0 or position(values_before in original) = 0 then
    raise exception 'confirmation function changed; inspect before migration';
  end if;
  updated := replace(original, columns_before,
    'user_id, amount, currency, category, description, is_want, is_recurring, is_extraordinary,');
  updated := replace(updated, values_before, values_before || E'\n      coalesce((p_payload->>''is_recurring'')::boolean, false), coalesce((p_payload->>''is_extraordinary'')::boolean, false),');
  execute updated;
end;
$migration$;
