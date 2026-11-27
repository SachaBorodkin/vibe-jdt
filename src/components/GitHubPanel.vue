<script setup>
import { computed, ref, watch } from 'vue'
import { useJournal } from '../composables/useJournal'
import { buildMarkdown, slugify } from '../lib/format'
import { commitFile, parseRepo } from '../lib/github'

const j = useJournal()
const project = j.project

const TOKEN_KEY = 'jdt:githubToken'
const COMMIT_MESSAGE =
  'docs(doc): Rédaction du JDT (fichier généré à partir de https://vibe-jdt.vercel.app/)'

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || ''
  } catch {
    return ''
  }
}

const repo = ref('')
const branch = ref('main')
const token = ref(readToken())
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

const projectName = computed(() => project.value?.name || 'Journal de travail')
const filePath = computed(() => `doc/jdt-${slugify(projectName.value)}.md`)
const ready = computed(() => Boolean(parseRepo(repo.value) && token.value.trim()))

async function save() {
  msg.value = ''
  err.value = ''
  if (!parseRepo(repo.value)) {
    err.value = 'Dépôt invalide : format « propriétaire/dépôt » attendu (ex. SachaBorodkin/vibe-jdt).'
    return
  }
  if (!project.value) return
  try {
    localStorage.setItem(TOKEN_KEY, token.value.trim())
  } catch {
    /* stockage indisponible : le jeton reste en mémoire */
  }
  const ok = await j.updateProject(project.value.id, {
    github_repo: repo.value.trim(),
    github_branch: branch.value.trim() || 'main',
  })
  if (ok) msg.value = 'Dépôt enregistré pour ce projet.'
  else err.value = j.error.value
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
    const markdown = buildMarkdown(j.weeks.value, j.entries.value, j.events.value, projectName.value)
    const res = await commitFile({
      token: token.value.trim(),
      repo: repo.value,
      branch: branch.value.trim() || 'main',
      path: filePath.value,
      content: markdown,
      message: COMMIT_MESSAGE,
    })
    commitUrl.value = res.commitUrl
    msg.value = `Journal commité dans ${res.path}.`
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
        Droit « Contents : Read and write » sur ce dépôt. Le jeton reste dans ce navigateur, il n'est pas
        enregistré dans Supabase.
      </p>
      <button :disabled="busy">Enregistrer</button>
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
