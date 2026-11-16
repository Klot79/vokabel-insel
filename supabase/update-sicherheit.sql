-- =============================================================
--  Vokabel-Insel – Sicherheits-Update (Supabase → SQL Editor)
--  Einmal komplett einfügen und auf "Run" klicken.
--  Kann gefahrlos mehrmals ausgeführt werden.
-- =============================================================
--  Danach gilt:
--  • Kinder-Geräte können nur Lernfortschritt, Zeichnungen und den
--    Klassenziel-Zähler speichern. Lektionen, Kinder, Einstellungen
--    und Löschen nur mit Lehrer-PIN – die Datenbank prüft die PIN.
--  • Lehrer-PIN und Bild-PINs der Kinder werden an Kinder-Geräte
--    nicht mehr ausgeliefert.
--  • Setzt die Lehrkraft ein Kind zurück, kann ein noch angemeldetes
--    Gerät den alten Stand nicht mehr zurückschreiben.
--  • Falsche Lehrer-PIN: 1 Sekunde Wartezeit (bremst Durchprobieren).
-- =============================================================

-- Lehrer-PIN prüfen
create or replace function public.vs_teacher_ok(p_code text, p_hash text)
returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  select exists(select 1 from public.vokabel_store
    where class_code = upper(p_code) and kind = 'class' and id = 'main'
      and data->>'teacherPinHash' = p_hash) into ok;
  if not ok then perform pg_sleep(1); end if;
  return ok;
end;
$$;

-- Bild-PIN eines Kindes prüfen
create or replace function public.vs_kid_ok(p_code text, p_id text, p_hash text)
returns boolean
language sql security definer set search_path = public as $$
  select exists(select 1 from public.vokabel_store
    where class_code = upper(p_code) and kind = 'student' and id = p_id
      and data->>'pinHash' = p_hash);
$$;

-- Lesen für Kinder-Geräte: ohne Lehrer-PIN und ohne Bild-PINs
create or replace function public.vs_get(p_code text, p_kind text)
returns table (id text, data jsonb, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select s.id,
         case when s.kind = 'class' then s.data - 'teacherPinHash'
              when s.kind = 'student' then s.data - 'pinHash' - 'pinHint'
              else s.data end,
         s.updated_at
  from public.vokabel_store s
  where s.class_code = upper(p_code) and s.kind = p_kind;
$$;

-- Einen einzelnen Eintrag lesen (spart Datenmenge beim Anmelden)
create or replace function public.vs_get_one(p_code text, p_kind text, p_id text)
returns table (id text, data jsonb, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select g.id, g.data, g.updated_at from public.vs_get(p_code, p_kind) g where g.id = p_id;
$$;

-- Lesen für die Lehrkraft: alles
create or replace function public.vs_get_t(p_code text, p_kind text, p_hash text)
returns table (id text, data jsonb, updated_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.vs_teacher_ok(p_code, p_hash) then raise exception 'LEHRER: keine Berechtigung'; end if;
  return query select s.id, s.data, s.updated_at from public.vokabel_store s
    where s.class_code = upper(p_code) and s.kind = p_kind;
end;
$$;

-- Schreiben von Kinder-Geräten: nur Fortschritt, Zeichnungen, Klassenziel-Zähler
create or replace function public.vs_put(p_code text, p_kind text, p_id text, p_data jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare old_gen text; has_old boolean;
begin
  if length(p_code) < 4 or length(p_code) > 40 then raise exception 'Ungültiger Klassencode'; end if;
  if not (p_kind in ('progress', 'art') or (p_kind = 'class' and p_id = 'goals')) then
    raise exception 'LEHRER: Nur die Lehrkraft darf das ändern';
  end if;
  if not exists(select 1 from public.vokabel_store where class_code = upper(p_code) and kind = 'class' and id = 'main') then
    raise exception 'Unbekannte Klasse';
  end if;
  if pg_column_size(p_data) > 2000000 then raise exception 'Eintrag zu groß'; end if;
  if p_kind = 'progress' then
    select true, data->>'gen' into has_old, old_gen from public.vokabel_store
      where class_code = upper(p_code) and kind = 'progress' and id = p_id;
    if has_old and old_gen is distinct from (p_data->>'gen') then raise exception 'RESET'; end if;
  end if;
  insert into public.vokabel_store (class_code, kind, id, data, updated_at)
  values (upper(p_code), p_kind, p_id, p_data, now())
  on conflict (class_code, kind, id) do update set data = excluded.data, updated_at = now();
end;
$$;

-- Schreiben für die Lehrkraft (Klasse anlegen geht ohne PIN, wenn es sie noch nicht gibt)
create or replace function public.vs_put_t(p_code text, p_kind text, p_id text, p_data jsonb, p_hash text)
returns void
language plpgsql security definer set search_path = public as $$
declare old jsonb; is_new boolean;
begin
  if length(p_code) < 4 or length(p_code) > 40 then raise exception 'Ungültiger Klassencode'; end if;
  if p_kind not in ('class', 'lesson', 'student', 'progress', 'art') then raise exception 'Ungültige Art'; end if;
  is_new := p_kind = 'class' and p_id = 'main'
    and not exists(select 1 from public.vokabel_store where class_code = upper(p_code) and kind = 'class' and id = 'main');
  if not is_new and not public.vs_teacher_ok(p_code, p_hash) then raise exception 'LEHRER: keine Berechtigung'; end if;
  if pg_column_size(p_data) > 5000000 then raise exception 'Eintrag zu groß'; end if;
  select data into old from public.vokabel_store where class_code = upper(p_code) and kind = p_kind and id = p_id;
  -- geheime Felder nicht versehentlich verlieren
  if p_kind = 'class' and p_id = 'main' and old is not null and not (p_data ? 'teacherPinHash') then
    p_data := p_data || jsonb_build_object('teacherPinHash', old->'teacherPinHash');
  end if;
  if p_kind = 'student' and old is not null and not (p_data ? 'pinHash') and (old ? 'pinHash') then
    p_data := p_data || jsonb_build_object('pinHash', old->'pinHash', 'pinHint', old->'pinHint');
  end if;
  insert into public.vokabel_store (class_code, kind, id, data, updated_at)
  values (upper(p_code), p_kind, p_id, p_data, now())
  on conflict (class_code, kind, id) do update set data = excluded.data, updated_at = now();
end;
$$;

-- Löschen nur mit Lehrer-PIN
create or replace function public.vs_del_t(p_code text, p_kind text, p_id text, p_hash text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.vs_teacher_ok(p_code, p_hash) then raise exception 'LEHRER: keine Berechtigung'; end if;
  delete from public.vokabel_store where class_code = upper(p_code) and kind = p_kind and id = p_id;
end;
$$;

-- Altes Löschen ohne PIN abschalten
create or replace function public.vs_del(p_code text, p_kind text, p_id text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  raise exception 'LEHRER: Bitte die App neu laden (Sicherheits-Update aktiv)';
end;
$$;

grant execute on function public.vs_teacher_ok(text, text) to anon;
grant execute on function public.vs_kid_ok(text, text, text) to anon;
grant execute on function public.vs_get(text, text) to anon;
grant execute on function public.vs_get_one(text, text, text) to anon;
grant execute on function public.vs_get_t(text, text, text) to anon;
grant execute on function public.vs_put(text, text, text, jsonb) to anon;
grant execute on function public.vs_put_t(text, text, text, jsonb, text) to anon;
grant execute on function public.vs_del_t(text, text, text, text) to anon;
grant execute on function public.vs_del(text, text, text) to anon;
