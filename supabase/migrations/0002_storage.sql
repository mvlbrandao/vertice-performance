-- Políticas de RLS para os buckets athlete-photos e athlete-media.
-- Convenção de caminho: {club_id}/{athlete_id}/{arquivo} (fotos)
--                        {club_id}/{athlete_id}/{"exercises"|"media"}/{arquivo}
-- storage.foldername(name) retorna os segmentos de pasta como text[].

-- athlete-photos: treinador gerencia todas as fotos do clube; atleta só lê a própria.
create policy "coach manages athlete photos"
  on storage.objects for all
  using (
    bucket_id = 'athlete-photos'
    and (storage.foldername(name))[1] = (select club_id::text from my_profile())
    and (select role from my_profile()) = 'coach'
  )
  with check (
    bucket_id = 'athlete-photos'
    and (storage.foldername(name))[1] = (select club_id::text from my_profile())
    and (select role from my_profile()) = 'coach'
  );

create policy "athlete reads own photo"
  on storage.objects for select
  using (
    bucket_id = 'athlete-photos'
    and (storage.foldername(name))[2] = (select athlete_id::text from my_profile())
  );

-- athlete-media: treinador gerencia mídia do clube (relatórios/fotos de jogo);
-- atleta envia e lê apenas os próprios vídeos de exercício.
create policy "coach manages club media"
  on storage.objects for all
  using (
    bucket_id = 'athlete-media'
    and (storage.foldername(name))[1] = (select club_id::text from my_profile())
    and (select role from my_profile()) = 'coach'
  )
  with check (
    bucket_id = 'athlete-media'
    and (storage.foldername(name))[1] = (select club_id::text from my_profile())
    and (select role from my_profile()) = 'coach'
  );

create policy "athlete manages own media"
  on storage.objects for all
  using (
    bucket_id = 'athlete-media'
    and (storage.foldername(name))[2] = (select athlete_id::text from my_profile())
    and (select role from my_profile()) = 'athlete'
  )
  with check (
    bucket_id = 'athlete-media'
    and (storage.foldername(name))[2] = (select athlete_id::text from my_profile())
    and (select role from my_profile()) = 'athlete'
  );
