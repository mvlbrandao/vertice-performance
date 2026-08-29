-- 0028 já libera staff pra gravar linha em media_items (área "saude"), mas
-- o arquivo em si vive no bucket athlete-media, que só tinha policy de
-- storage.objects pra coach e pro próprio atleta (0002) — sem isto o
-- upload falhava antes mesmo de chegar na tabela.
create policy "staff manages granted athlete media"
  on storage.objects for all
  using (
    bucket_id = 'athlete-media'
    and has_athlete_manage_access((storage.foldername(name))[2]::uuid)
    and has_staff_area('saude')
  )
  with check (
    bucket_id = 'athlete-media'
    and has_athlete_manage_access((storage.foldername(name))[2]::uuid)
    and has_staff_area('saude')
  );
