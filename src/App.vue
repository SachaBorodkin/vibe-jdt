<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { configured, supabase } from './supabaseClient'
import { useJournal } from './composables/useJournal'
import AuthForm from './components/AuthForm.vue'
import WeekView from './components/WeekView.vue'
import GitHubPanel from './components/GitHubPanel.vue'
import { buildMarkdown, fmtDate, fmtMin, mondayOf, slugify, sumEntries, toISO, weekNumbers, weekTitle } from './lib/format'
import { downloadPdf } from './lib/pdf'

const j = useJournal()
const session = ref(null)
const ready = ref(false)
const selectedId = ref(null)
const newDate = ref(toISO(mondayOf()))
const newLabel = ref('')
const newProject = ref('')
const addingProject = ref(false)

onMounted(async () => {
  if (!configured) {
    ready.value = true
    return
  }
  const { data } = await supabase.auth.getSession()
  session.value = data.session
  ready.value = true
  supabase.auth.onAuthStateChange((_evt, s) => {
    session.value = s
  })
})

watch(
  () => session.value?.user?.id,
  async (id) => {
    if (id) {
      await j.loadAll()
    } else {
      j.reset()
    }
  },
)

// Changement de projet : on ouvre sa semaine la plus récente
watch(
  () => j.projectId.value,
  () => {
    selectedId.value = j.weeks.value[0]?.id ?? null
  },
)

const projectName = computed(() => j.project.value?.name || 'Journal de travail')
const slug = computed(() => slugify(projectName.value))

function projectStats(id) {
  const ids = new Set(j.allWeeks.value.filter((w) => w.project_id === id).map((w) => w.id))
  return sumEntries(j.allEntries.value.filter((e) => ids.has(e.week_id))).total
}

async function createProject() {
  const name = newProject.value.trim()
  if (!name) return
  if (await j.addProject(name)) {
    newProject.value = ''
    addingProject.value = false
  }
}

function renameProject() {
  const name = prompt('Nom du projet', j.project.value.name)
  if (name && name.trim()) j.updateProject(j.project.value.id, { name: name.trim() })
}

function removeProject() {
  const p = j.project.value
  if (confirm(`Supprimer le projet « ${p.name} » avec TOUTES ses semaines, tâches et événements ? Cette action est irréversible.`)) {
    j.deleteProject(p.id)
  }
}

const selectedWeek = computed(() => j.weeks.value.find((w) => w.id === selectedId.value))
const projectTotal = computed(() => sumEntries(j.entries.value))
const numbers = computed(() => weekNumbers(j.weeks.value))

function weekTotal(id) {
  return sumEntries(j.entries.value.filter((e) => e.week_id === id)).total
}

async function createWeek() {
  if (!newDate.value) return
  const start = toISO(mondayOf(new Date(newDate.value + 'T00:00:00')))
  if (j.weeks.value.some((w) => w.start_date === start)) {
    j.error.value = `La semaine du ${fmtDate(start)} existe déjà.`
    selectedId.value = j.weeks.value.find((w) => w.start_date === start).id
    return
  }
  const w = await j.addWeek(start, newLabel.value.trim())
  if (w) {
    selectedId.value = w.id
    newLabel.value = ''
  }
}

function exportMarkdown() {
  const md = buildMarkdown(j.weeks.value, j.entries.value, j.events.value, projectName.value)
  const url = URL.createObjectURL(new Blob([md], { type: 'text/markdown;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `jdt-${slug.value}-${toISO(new Date())}.md`
  a.click()
  URL.revokeObjectURL(url)
}

function exportPdf(all) {
  const list = all ? j.weeks.value : [selectedWeek.value]
  const name = all
    ? `jdt-${slug.value}-${toISO(new Date())}.pdf`
    : `jdt-${slug.value}-semaine-${selectedWeek.value.start_date}.pdf`
  downloadPdf(list, j.entries.value, j.events.value, name, j.weeks.value, projectName.value)
}
const signOut = () => supabase.auth.signOut()
</script>

<template>
  <div v-if="!ready" class="center-msg">Chargement…</div>

  <div v-else-if="!configured" class="auth-wrap">
    <div class="card auth">
      <h1>Configuration requise</h1>
      <p>Crée un fichier <code>.env</code> à la racine (voir <code>.env.example</code>) avec :</p>
      <pre>JDT_SUPABASE_URL=…
JDT_SUPABASE_ANON_KEY=…</pre>
      <p>Puis exécute <code>supabase/schema.sql</code> (ou <code>migration_projects.sql</code> si tu as déjà des données) dans le SQL Editor de Supabase et relance <code>npm run dev</code>.</p>
    </div>
  </div>

  <AuthForm v-else-if="!session" />

  <div v-else class="layout">
    <aside class="sidebar no-print">
      <h1>Journal de travail</h1>

      <div class="projects">
        <label class="proj-label">Projet</label>
        <div v-if="j.projects.value.length" class="proj-row">
          <select :value="j.projectId.value" @change="j.selectProject($event.target.value)">
            <option v-for="p in j.projects.value" :key="p.id" :value="p.id">
              {{ p.name }} · {{ fmtMin(projectStats(p.id)) }}
            </option>
          </select>
          <button class="icon" title="Renommer le projet" @click="renameProject">✎</button>
          <button class="icon danger" title="Supprimer le projet" @click="removeProject">🗑</button>
        </div>
        <form v-if="addingProject || !j.projects.value.length" class="proj-row" @submit.prevent="createProject">
          <input v-model="newProject" placeholder="Nom du projet" required autofocus />
          <button class="primary">OK</button>
          <button v-if="j.projects.value.length" type="button" class="icon" @click="addingProject = false">✕</button>
        </form>
        <button v-else class="ghost" @click="addingProject = true">+ Nouveau projet</button>
      </div>

      <form v-if="j.project.value" class="new-week" @submit.prevent="createWeek">
        <label>Nouvelle semaine<input v-model="newDate" type="date" required /></label>
        <input v-model="newLabel" placeholder="Titre (optionnel)" />
        <button class="primary">+ Créer le dossier</button>
      </form>

      <nav v-if="j.project.value">
        <button
          v-for="w in j.weeks.value"
          :key="w.id"
          class="folder"
          :class="{ active: w.id === selectedId }"
          @click="selectedId = w.id"
        >
          <span class="folder-name">📁 {{ weekTitle(w, numbers.get(w.id)) }}</span>
          <span class="folder-total">{{ fmtMin(weekTotal(w.id)) }}</span>
        </button>
        <p v-if="!j.weeks.value.length" class="muted small">Aucune semaine pour l'instant.</p>
      </nav>

      <div v-if="j.project.value" class="side-foot">
        <div class="stat accent"><span>Total « {{ projectName }} »</span><strong>{{ fmtMin(projectTotal.total) }}</strong></div>
        <button @click="exportMarkdown">Exporter (Markdown)</button>
        <button :disabled="!selectedWeek" @click="exportPdf(false)">Télécharger PDF (semaine)</button>
        <button :disabled="!j.weeks.value.length" @click="exportPdf(true)">Télécharger PDF (tout le projet)</button>
        <GitHubPanel />
        <button class="ghost" @click="signOut">Déconnexion</button>
      </div>
    </aside>

    <main class="main">
      <p v-if="j.error.value" class="error banner">{{ j.error.value }}</p>
      <p v-if="j.loading.value" class="muted">Chargement…</p>
      <h1 v-if="j.project.value" class="project-title">{{ projectName }}</h1>
      <WeekView v-if="selectedWeek" :key="selectedWeek.id" :week="selectedWeek" />
      <div v-else-if="!j.loading.value && !j.project.value" class="center-msg muted">Crée ton premier projet pour commencer.</div>
      <div v-else-if="!j.loading.value" class="center-msg muted">Crée ou sélectionne une semaine.</div>
    </main>
  </div>
</template>
