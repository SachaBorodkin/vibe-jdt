# Journal de travail

App Vue 3 + Vite + Supabase pour tenir un journal de travail organisé par semaine (« dossiers »).

## Démarrage

1. Crée un projet sur [supabase.com](https://supabase.com).
2. Dans **SQL Editor**, exécute `supabase/schema.sql` (tables + Row Level Security).
   - Si tu utilisais déjà la version sans projets, exécute à la place `supabase/migration_projects.sql` : tes semaines existantes sont rattachées à un projet « Mon projet ».
   - Si tu veux committer le journal sur GitHub, exécute aussi `supabase/migration_github.sql` (colonnes `github_repo` / `github_branch`).
3. Dans **Authentication > Providers**, laisse Email activé (désactive « Confirm email » si tu veux te connecter directement après inscription).
4. Copie `.env.example` en `.env` et renseigne l'URL et la clé `anon` (Project Settings > API).
5. Lance :

```bash
npm install
npm run dev
```

## Fonctionnalités vs. critères du journal

| Critère | Dans l'app |
|---|---|
| Structure claire | Un dossier par semaine, tableau Date / Tâche / Statut / Durée |
| Artefact référencé | Colonne « Artefact » : lien vers le commit |
| Durée + [WIP] | Durée par tâche (`45`, `1h30`, `1:15`) ; statut « En cours » affiche `[WIP]` |
| Événements | Tableau dédié : activité ETML, absence, imprévu, autre (+ temps perdu) |
| Heures supplémentaires | Case « HS » par tâche, totalisées par jour / semaine / projet |
| Succès / échecs | Colonne « Résultat » (Succès / Échec) |
| Tâche ≥ 45 min commentée | Zone de commentaire affichée automatiquement, avertissement tant qu'elle est vide |
| Totaux | Par jour, par semaine et sur l'ensemble du projet |

**Export :** bouton « Exporter (Markdown) » (journal complet) ou « Imprimer / PDF ».

## Plusieurs projets

Chaque projet a son propre journal (semaines, tâches, événements, totaux). Le sélecteur en haut de la barre latérale permet de changer, créer, renommer ou supprimer un projet. Les exports (Markdown / PDF) portent le nom du projet.

## Commit sur GitHub

Chaque projet peut être rattaché à un dépôt GitHub. Dans la barre latérale, ouvre **Dépôt GitHub**, puis renseigne :

- le dépôt, au format `propriétaire/dépôt` (ex. `SachaBorodkin/vibe-jdt`) ;
- la branche (par défaut `main`) ;
- un jeton d'accès personnel GitHub avec le droit **Contents : Read and write** sur ce dépôt (fine-grained token, ou token classique `ghp_…` avec le scope `repo`).

Le bouton **Commit JDT dans le repo sous doc/** écrit le journal du projet dans `doc/jdt-<projet>.md` (fichier stable, mis à jour à chaque commit) avec le message :

```
docs(doc): Rédaction du JDT (fichier généré à partir de https://vibe-jdt.vercel.app/)
```

Le dépôt et la branche sont enregistrés sur le projet (Supabase). Le jeton, lui, reste dans le navigateur (`localStorage`, clé `jdt:githubToken`) et n'est jamais envoyé à Supabase : utilise un jeton limité à ce seul dépôt.

## Variables d'environnement / Vercel

Les variables s'appellent `JDT_SUPABASE_URL` et `JDT_SUPABASE_ANON_KEY` (préfixe réglé par `envPrefix` dans `vite.config.js`). Sur Vercel : Project Settings > Environment Variables, ajoute ces deux variables puis redéploie. N'utilise jamais la clé `service_role` côté front.
