-- =============================================================
--  Plapperlapapp – Bildspeicher einrichten (Supabase → SQL Editor)
--  Einmal komplett einfügen und auf "Run" klicken.
-- =============================================================
--  Legt einen öffentlichen Ordner "vokabel-bilder" an. Bilder werden
--  dort in guter Auflösung (bis 1200 Pixel) gespeichert, statt
--  verkleinert in der Lektion. Lesen darf jeder (die Kinder sehen
--  die Bilder), hochladen nur Bilddateien bis 5 MB.
-- =============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vokabel-bilder', 'vokabel-bilder', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

drop policy if exists "vokabel-bilder hochladen" on storage.objects;
create policy "vokabel-bilder hochladen" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'vokabel-bilder');

drop policy if exists "vokabel-bilder lesen" on storage.objects;
create policy "vokabel-bilder lesen" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'vokabel-bilder');
