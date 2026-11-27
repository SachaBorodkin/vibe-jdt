// Commit d'un fichier dans un dépôt GitHub via l'API REST (Contents).
// Le jeton d'accès personnel reste dans le navigateur : il n'est jamais stocké dans Supabase.

const API = 'https://api.github.com'

/** Accepte "propriétaire/dépôt", une URL github.com ou une URL se terminant par .git */
export function parseRepo(input) {
  const s = String(input || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '')
  const m = s.match(/^([\w.-]+)\/([\w.-]+)$/)
  return m ? { owner: m[1], repo: m[2] } : null
}

/** UTF-8 -> base64 (btoa seul casse les accents) */
function toBase64(str) {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

async function gh(path, token, init = {}) {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  return { res, data }
}

function statusError(res, data, action) {
  if (res.status === 401) return new Error('Jeton GitHub invalide ou expiré (401).')
  if (res.status === 403)
    return new Error(
      "Accès refusé (403) : le jeton n'a pas le droit « Contents : Read and write » sur ce dépôt (ou la limite d'API est atteinte).",
    )
  const msg = data?.message || 'erreur inconnue'
  return new Error(`GitHub a répondu ${res.status} (${action}) : ${msg}`)
}

/**
 * Crée ou met à jour un fichier du dépôt, puis retourne l'URL du commit.
 * @param {{token: string, repo: string, branch?: string, path: string, content: string, message: string}} opts
 */
export async function commitFile({ token, repo, branch = 'main', path, content, message }) {
  const target = parseRepo(repo)
  if (!target) {
    throw new Error("Dépôt invalide : utilise le format « propriétaire/dépôt » (ex. SachaBorodkin/vibe-jdt).")
  }
  if (!token) throw new Error('Jeton GitHub manquant.')

  const base = `/repos/${target.owner}/${target.repo}/contents/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`
  const ref = encodeURIComponent(branch)

  // Le SHA est obligatoire pour écraser un fichier existant.
  const { res: readRes, data: existing } = await gh(`${base}?ref=${ref}`, token)
  if (!readRes.ok && readRes.status !== 404) throw statusError(readRes, existing, 'lecture du fichier')

  const body = { message, content: toBase64(content), branch }
  if (readRes.ok && existing?.sha) body.sha = existing.sha

  const { res, data } = await gh(base, token, { method: 'PUT', body: JSON.stringify(body) })
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(
        `Dépôt ou branche introuvable (404) : vérifie « ${target.owner}/${target.repo} » et la branche « ${branch} ».`,
      )
    }
    if (res.status === 409 || res.status === 422) {
      throw new Error(
        `GitHub a refusé l'écriture (${res.status}) : ${data?.message || 'conflit sur le fichier'}. Réessaie.`,
      )
    }
    throw statusError(res, data, 'écriture du fichier')
  }

  return { path: data?.content?.path || path, commitUrl: data?.commit?.html_url || '' }
}
