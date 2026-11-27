import { buildMarkdown, slugify } from './format'
import { commitFile, parseRepo } from './github'

/** Chemins et message du commit JDT (partagés par le panneau et le bouton de la barre latérale). */
export const TOKEN_KEY = 'jdt:githubToken'
export const COMMIT_MESSAGE =
  'docs(doc): Rédaction du JDT (fichier généré à partir de https://vibe-jdt.vercel.app/)'

export function jdtPath(projectName) {
  return `doc/jdt-${slugify(projectName)}.md`
}

export function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

export function writeStoredToken(value) {
  try {
    localStorage.setItem(TOKEN_KEY, value)
  } catch {
    /* stockage indisponible : le jeton reste en mémoire */
  }
}

/**
 * Commit le journal d'un projet dans doc/jdt-<projet>.md.
 * Lève une erreur explicite (affichable telle quelle) en cas de problème.
 */
export async function commitJdt({ repo, branch, token, projectName, weeks, entries, events }) {
  if (!parseRepo(repo)) {
    throw new Error('Dépôt invalide : format « propriétaire/dépôt » attendu (ex. SachaBorodkin/vibe-jdt).')
  }
  if (!String(token || '').trim()) {
    throw new Error('Renseigne un jeton GitHub avec le droit « Contents : Read and write » sur ce dépôt.')
  }
  const markdown = buildMarkdown(weeks, entries, events, projectName || '')
  return commitFile({
    token: String(token).trim(),
    repo,
    branch: String(branch || 'main').trim() || 'main',
    path: jdtPath(projectName),
    content: markdown,
    message: COMMIT_MESSAGE,
  })
}
