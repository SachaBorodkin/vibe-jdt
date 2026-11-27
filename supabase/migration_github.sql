-- Migration : dépôt GitHub rattaché à un projet + jeton GitHub
-- À exécuter UNE fois dans Supabase > SQL Editor > Run si la base existe déjà.
-- (déjà incluse dans supabase/schema.sql pour une installation neuve)
-- Ce fichier peut être relancé sans risque (if not exists / drop policy).

alter table public.projects
  add column if not exists github_repo   text,
  add column if not exists github_branch text not null default 'main';

-- Jeton d'accès GitHub : une ligne par utilisateur, réutilisée pour tous ses projets.
-- Row Level Security : seul le propriétaire peut lire/écrire sa ligne.
create table if not exists public.github_tokens (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  token       text not null,
  updated_at  timestamptz not null default now()
);

alter table public.github_tokens enable row level security;

drop policy if exists "github_tokens: own rows" on public.github_tokens;
create policy "github_tokens: own rows" on public.github_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
