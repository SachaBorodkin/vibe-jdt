-- Journal de travail : schéma Supabase (installation neuve)
-- À coller dans Supabase > SQL Editor > Run
-- Si tu as déjà installé la version précédente, utilise plutôt supabase/migration_projects.sql

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  github_repo    text,                     -- dépôt GitHub cible du commit (propriétaire/dépôt)
  github_branch  text not null default 'main',
  created_at  timestamptz not null default now()
);

create table if not exists public.weeks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id  uuid not null references public.projects(id) on delete cascade,
  start_date  date not null,              -- lundi de la semaine
  label       text,                       -- titre optionnel
  created_at  timestamptz not null default now()
);

create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_id     uuid not null references public.weeks(id) on delete cascade,
  date        date not null,
  task        text not null default '',
  status      text not null default 'wip' check (status in ('done', 'wip')),
  minutes     integer not null default 0 check (minutes >= 0),
  commit_url  text,                       -- lien vers le commit (artefact)
  comment     text,                       -- obligatoire pour les tâches >= 45 min (contrôlé dans l'UI)
  outcome     text check (outcome in ('success', 'failure')),
  overtime    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  week_id       uuid not null references public.weeks(id) on delete cascade,
  date          date not null,
  kind          text not null default 'imprevu' check (kind in ('etml', 'absence', 'imprevu', 'autre')),
  description   text not null default '',
  minutes_lost  integer not null default 0 check (minutes_lost >= 0),
  created_at    timestamptz not null default now()
);

create table if not exists public.github_tokens (
  user_id     uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  token       text not null,              -- jeton d'accès GitHub (une seule saisie par utilisateur)
  updated_at  timestamptz not null default now()
);

create index if not exists weeks_project_idx on public.weeks(project_id);
create index if not exists entries_week_idx  on public.entries(week_id);
create index if not exists events_week_idx   on public.events(week_id);

-- Row Level Security : chaque utilisateur ne voit que ses données
alter table public.projects enable row level security;
alter table public.weeks    enable row level security;
alter table public.entries  enable row level security;
alter table public.events   enable row level security;
alter table public.github_tokens enable row level security;

create policy "projects: own rows" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weeks: own rows"    on public.weeks    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "entries: own rows"  on public.entries  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "events: own rows"   on public.events   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "github_tokens: own rows" on public.github_tokens for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
