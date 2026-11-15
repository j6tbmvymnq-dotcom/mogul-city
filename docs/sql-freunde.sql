-- Mogul City · Freunde werben: Wer über deinen Einladungslink eine Stadt gründet und Level 5 erreicht (dort wird er selbst zum Einladen aufgefordert), zählt als dein Freund.
-- Im Supabase-SQL-Editor ausführen (einmalig, kann gefahrlos wiederholt werden).
create or replace function my_refs(p_code text)
returns json language sql security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('name', s.data->>'name', 'lvl', (s.data->>'lvl')::int) order by s.updated_at), '[]'::json)
  from saves me join saves s on s.data->>'ref' = me.pub_id::text and s.code <> me.code
  where me.code = p_code
    and coalesce((s.data->>'lvl')::int, 0) >= 5
    and (s.data->>'test' is null or me.data->>'test' is not null);
$$;
revoke all on function my_refs(text) from public;
grant execute on function my_refs(text) to anon;
