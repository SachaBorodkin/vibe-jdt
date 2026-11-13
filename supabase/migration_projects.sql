-- Migration : plusieurs projets (journaux) par utilisateur
-- À exécuter UNE fois si tu as déjà la version précédente (sans projets).
-- Tes semaines existantes sont rattachées à un projet « Mon projet » créé automatiquement.

create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now()
);

alter table public.projects enable row level security;
create policy "projects: own rows" on public.projects for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.weeks add column if not exists project_id uuid references public.projects(id) on delete cascade;

-- Un projet par utilisateur ayant déjà des semaines
insert into public.projects (user_id, name)
select distinct user_id, 'Mon projet' from public.weeks where project_id is null;

update public.weeks w
set project_id = (select p.id from public.projects p where p.user_id = w.user_id order by p.created_at limit 1)
where w.project_id is null;

alter table public.weeks alter column project_id set not null;
create index if not exists weeks_project_idx on public.weeks(project_id);
