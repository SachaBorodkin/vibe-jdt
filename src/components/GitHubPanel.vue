<script setup>
import { computed, ref, watch } from 'vue'
import { useJournal } from '../composables/useJournal'
import { parseRepo } from '../lib/github'
import { commitJdt, jdtPath, readStoredToken, writeStoredToken } from '../lib/jdtCommit'

const j = useJournal()
const project = j.project

const repo = ref('')
const branch = ref('main')
const token = ref(j.githubToken.value || readStoredToken())
const busy = ref(false)
const msg = ref('')
const err = ref('')
const commitUrl = ref('')

watch(
  () => project.value?.id,
  () => {
    repo.value = project.value?.github_repo || ''
    branch.value = project.value?.github_branch || 'main'
    msg.value = ''
    err.value = ''
    commitUrl.value = ''
  },
  { immediate: true },
)

// Le jeton arrive avec loadAll() : on préremplit le champ dès qu'il est connu.
watch(
  () => j.githubToken.value,
  (t) => {
    if (t) token.value = t
  },
)

const projectName = computed(() => project.value?.name || 'Journal de travail')
const filePath = computed(() => jdtPath(projectName.value))
const ready = computed(() => Boolean(parseRepo(repo.value) && token.value.trim()))

async function save() {
  msg.value = ''
  err.value = ''
  if (!parseRepo(repo.value)) {
    err.value = 'Dépôt invalide : format « propriétaire/dépôt » attendu (ex. SachaBorodkin/vibe-jdt).'
    return
  }
  if (!project.value) return

  let ok = await j.updateProject(project.value.id, {
    github_repo: repo.value.trim(),
    github_branch: branch.value.trim() || 'main',
  })

  const value = token.value.trim()
  let storedToken = true
  if (value) {
    storedToken = await j.saveGithubToken(value)
    if (storedToken) writeStoredToken(value)
  }
  if (!storedToken) err.value = j.error.value

  if (ok && storedToken) {
    msg.value = value
      ? 'Dépôt et jeton enregistrés : le jeton est réutilisé pour tous tes projets.'
      : 'Dépôt enregistré pour ce projet.'
  } else if (!err.value) {
    err.value = j.error.value
  }
}

async function commit() {
  msg.value = ''
  err.value = ''
  commitUrl.value = ''
  if (!project.value) return
  if (!parseRepo(repo.value)) {
    err.value = 'Dépôt invalide : format « propriétaire/dépôt » attendu (ex. SachaBorodkin/vibe-jdt).'
    return
  }
  if (!token.value.trim()) {
    err.value = 'Renseigne un jeton GitHub avec le droit « Contents : Read and write » sur ce dépôt.'
    return
  }
  busy.value = true
  try {
    const res = await commitJdt({
      token: token.value,
      repo: repo.value,
      branch: branch.value,
      projectName: projectName.value,
      weeks: j.weeks.value,
      entries: j.entries.value,
      events: j.events.value,
    })
    commitUrl.value = res.commitUrl
    msg.value = `Journal commité dans ${res.path}.`

    // Le jeton est mémorisé une seule fois pour le compte (et dans ce navigateur).
    const value = token.value.trim()
    if (value && value !== j.githubToken.value) {
      if (await j.saveGithubToken(value)) writeStoredToken(value)
    }
  } catch (e) {
    err.value = e?.message || String(e)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <details class="github">
    <summary>Dépôt GitHub</summary>

    <form @submit.prevent="save">
      <label>Dépôt<input v-model="repo" placeholder="propriétaire/dépôt" autocomplete="off" /></label>
      <label>Branche<input v-model="branch" placeholder="main" autocomplete="off" /></label>
      <label>
        Jeton GitHub
        <input v-model="token" type="password" placeholder="ghp_… ou github_pat_…" autocomplete="off" />
      </label>
      <p class="muted small">
        Le jeton est enregistré une seule fois pour ton compte et réutilisé pour tous tes projets (il reste
        aussi copié dans ce navigateur).
      </p>
      <button :disabled="busy">Enregistrer</button>

      <details class="help">
        <summary>Comment créer le jeton ?</summary>
        <ol>
          <li>
            Ouvre
            <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener" class="ext">
              Fine-grained tokens → Generate new token ↗
            </a>
            (GitHub : Settings → Developer settings → Personal access tokens).
          </li>
          <li><strong>Resource owner</strong> : ton compte (ou l'organisation propriétaire du dépôt).</li>
          <li>
            <strong>Repository access</strong> → <em>Only select repositories</em> → le dépôt concerné (ex.
            <code>vibe-jdt</code>).
          </li>
          <li>
            <strong>Permissions</strong> → <em>Repository permissions</em> → <strong>Contents : Read and write</strong>
            (laisse tout le reste sur « No access » ; <em>Metadata</em> passe seul en lecture).
          </li>
          <li><strong>Expiration</strong> : 90 jours, par exemple.</li>
          <li>
            <em>Generate token</em>, puis copie le <code>github_pat_…</code> (affiché une seule fois) et colle-le
            dans le champ ci-dessus.
          </li>
        </ol>
        <p class="muted small">
          Un token classique fonctionne aussi :
          <a href="https://github.com/settings/tokens/new" target="_blank" rel="noopener" class="ext">
            Tokens (classic) ↗
          </a>
          avec le seul scope <code>repo</code>.
        </p>
      </details>
    </form>

    <p class="muted small">Fichier : <code>{{ filePath }}</code></p>
    <button class="primary" :disabled="busy || !ready" @click="commit">
      {{ busy ? 'Commit en cours…' : 'Commit JDT dans le repo sous doc/' }}
    </button>

    <p v-if="err" class="error small">{{ err }}</p>
    <p v-if="msg" class="ok small">
      {{ msg }}
      <a v-if="commitUrl" :href="commitUrl" target="_blank" rel="noopener" class="ext">voir le commit ↗</a>
    </p>
  </details>
</template>
