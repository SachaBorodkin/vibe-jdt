-- Migration : colonne « Type » sur les tâches du JDT
-- À exécuter UNE fois dans Supabase > SQL Editor > Run si la base existe déjà.
-- (déjà incluse dans supabase/schema.sql pour une installation neuve)
-- Relançable sans risque.

-- Documentation / Analyse / Absent / Test / Implémentation, ou valeur libre.
alter table public.entries
  add column if not exists kind text not null default 'Implémentation';

-- Les tâches déjà saisies prennent le type par défaut « Implémentation ».
