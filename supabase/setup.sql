-- =============================================================
--  Plapperlapapp – Datenbank einrichten (Supabase → SQL Editor)
--  Einmal komplett einfügen und auf "Run" klicken.
-- =============================================================
--  Alle Daten liegen in einer Tabelle. Direkter Zugriff ist
--  gesperrt; die App spricht nur über drei Funktionen mit der
--  Datenbank. Wer den Klassencode nicht kennt, sieht nichts.
-- =============================================================

create table if not exists public.vokabel_store (
  class_code  text        not null,
  kind        text        not null,   -- class | lesson | student | progress
  id          text        not null,
  data        jsonb       not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  primary key (class_code, kind, id)
);

alter table public.vokabel_store enable row level security;
-- Keine Policies: Tabelle ist von außen nicht direkt lesbar/schreibbar.
revoke all on public.vokabel_store from anon, authenticated;

-- Lesen: alle Einträge einer Art für eine Klasse
create or replace function public.vs_get(p_code text, p_kind text)
returns table (id text, data jsonb, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select s.id, s.data, s.updated_at
  from public.vokabel_store s
  where s.class_code = upper(p_code) and s.kind = p_kind;
$$;

-- Schreiben (anlegen oder ersetzen)
create or replace function public.vs_put(p_code text, p_kind text, p_id text, p_data jsonb)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(p_code) < 4 or length(p_code) > 40 then
    raise exception 'Ungültiger Klassencode';
  end if;
  if p_kind not in ('class','lesson','student','progress') then
    raise exception 'Ungültige Art';
  end if;
  if pg_column_size(p_data) > 5000000 then
    raise exception 'Eintrag zu groß';
  end if;
  insert into public.vokabel_store (class_code, kind, id, data, updated_at)
  values (upper(p_code), p_kind, p_id, p_data, now())
  on conflict (class_code, kind, id)
  do update set data = excluded.data, updated_at = now();
end;
$$;

-- Löschen
create or replace function public.vs_del(p_code text, p_kind text, p_id text)
returns void
language sql security definer set search_path = public as $$
  delete from public.vokabel_store
  where class_code = upper(p_code) and kind = p_kind and id = p_id;
$$;

grant execute on function public.vs_get(text, text) to anon;
grant execute on function public.vs_put(text, text, text, jsonb) to anon;
grant execute on function public.vs_del(text, text, text) to anon;
