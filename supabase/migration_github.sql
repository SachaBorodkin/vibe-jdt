-- Migration : dépôt GitHub rattaché à un projet
-- À exécuter UNE fois dans Supabase > SQL Editor > Run si la base existe déjà.
-- (déjà incluse dans supabase/schema.sql pour une installation neuve)

alter table public.projects
  add column if not exists github_repo   text,
  add column if not exists github_branch text not null default 'main';
