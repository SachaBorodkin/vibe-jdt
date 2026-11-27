import { computed, ref } from 'vue'
import { supabase } from '../supabaseClient'

// Données brutes (tous projets confondus)
const projects = ref([])
const allWeeks = ref([])
const allEntries = ref([])
const allEvents = ref([])
const projectId = ref(null)
const githubToken = ref('')
const loading = ref(false)
const error = ref('')

// Vues filtrées sur le projet courant : tout le reste de l'app ne voit que celles-ci
const weeks = computed(() =>
  allWeeks.value
    .filter((w) => w.project_id === projectId.value)
    .sort((a, b) => b.start_date.localeCompare(a.start_date)),
)
const weekIds = computed(() => new Set(weeks.value.map((w) => w.id)))
const entries = computed(() => allEntries.value.filter((e) => weekIds.value.has(e.week_id)))
const events = computed(() => allEvents.value.filter((e) => weekIds.value.has(e.week_id)))
const project = computed(() => projects.value.find((p) => p.id === projectId.value) || null)

function fail(err) {
  if (err) {
    const msg = err.message || String(err)
    if (/entries[^]*?kind|kind[^]*?entries/i.test(msg)) {
      error.value = `${msg} — la base n'est pas à jour : exécute supabase/migration_entry_kind.sql dans le SQL Editor de Supabase, puis recharge la page.`
    } else if (/github_tokens|github_(repo|branch)/i.test(msg)) {
      error.value = `${msg} — la base n'est pas à jour : exécute supabase/migration_github.sql dans le SQL Editor de Supabase, puis recharge la page.`
    } else if (/projects|project_id/i.test(msg)) {
      error.value = `${msg} — la base n'est pas à jour : exécute supabase/migration_projects.sql dans le SQL Editor de Supabase, puis recharge la page.`
    } else {
      error.value = msg
    }
    return true
  }
  error.value = ''
  return false
}

const LAST_KEY = 'jdt:lastProject'

async function loadAll() {
  loading.value = true
  const [p, w, e, v] = await Promise.all([
    supabase.from('projects').select('*').order('created_at'),
    supabase.from('weeks').select('*').order('start_date', { ascending: false }),
    supabase.from('entries').select('*').order('date').order('created_at'),
    supabase.from('events').select('*').order('date').order('created_at'),
  ])
  loading.value = false
  if (fail(p.error || w.error || e.error || v.error)) return
  projects.value = p.data
  allWeeks.value = w.data

  // Semaines orphelines (sans projet) : on les rattache à un projet « Mon projet »
  const orphans = w.data.filter((x) => !x.project_id)
  if (orphans.length) {
    let target = p.data[0]
    if (!target) {
      const ins = await supabase.from('projects').insert({ name: 'Mon projet' }).select().single()
      if (fail(ins.error)) return
      target = ins.data
      projects.value = [target]
    }
    const up = await supabase.from('weeks').update({ project_id: target.id }).in('id', orphans.map((x) => x.id))
    if (fail(up.error)) return
    orphans.forEach((x) => { x.project_id = target.id })
  }
  allEntries.value = e.data
  allEvents.value = v.data

  let last = null
  try { last = localStorage.getItem(LAST_KEY) } catch { /* ignore */ }
  projectId.value = projects.value.find((x) => x.id === last)?.id ?? projects.value[0]?.id ?? null

  // Jeton GitHub : une seule ligne par compte. Silencieux si la table n'existe pas encore
  // (migration non lancée) : le jeton reste alors dans le navigateur.
  const t = await supabase.from('github_tokens').select('token').maybeSingle()
  githubToken.value = t.error ? '' : t.data?.token || ''
}

function reset() {
  projects.value = []
  allWeeks.value = []
  allEntries.value = []
  allEvents.value = []
  projectId.value = null
  githubToken.value = ''
}

function selectProject(id) {
  projectId.value = id
  try { localStorage.setItem(LAST_KEY, id) } catch { /* ignore */ }
}

/* ---------- Projets ---------- */
async function addProject(name) {
  const { data, error: err } = await supabase
    .from('projects')
    .insert({ name })
    .select()
    .single()
  if (fail(err)) return null
  projects.value = [...projects.value, data]
  selectProject(data.id)
  return data
}

async function updateProject(id, patch) {
  const p = projects.value.find((x) => x.id === id)
  if (p) Object.assign(p, patch)
  return !fail((await supabase.from('projects').update(patch).eq('id', id)).error)
}

async function deleteProject(id) {
  if (fail((await supabase.from('projects').delete().eq('id', id)).error)) return
  const gone = new Set(allWeeks.value.filter((w) => w.project_id === id).map((w) => w.id))
  projects.value = projects.value.filter((p) => p.id !== id)
  allWeeks.value = allWeeks.value.filter((w) => w.project_id !== id)
  allEntries.value = allEntries.value.filter((e) => !gone.has(e.week_id))
  allEvents.value = allEvents.value.filter((e) => !gone.has(e.week_id))
  if (projectId.value === id) selectProject(projects.value[0]?.id ?? null)
}

/* ---------- Jeton GitHub (un par compte) ---------- */
async function saveGithubToken(token) {
  const { data } = await supabase.auth.getUser()
  const user_id = data?.user?.id
  if (!user_id) {
    error.value = 'Session expirée : reconnecte-toi pour enregistrer le jeton.'
    return false
  }
  const { error: err } = await supabase
    .from('github_tokens')
    .upsert({ user_id, token, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (fail(err)) return false
  githubToken.value = token
  return true
}

/* ---------- Semaines ---------- */
async function addWeek(start_date, label) {
  const { data, error: err } = await supabase
    .from('weeks')
    .insert({ start_date, label: label || null, project_id: projectId.value })
    .select()
    .single()
  if (fail(err)) return null
  allWeeks.value.push(data)
  return data
}

async function updateWeek(id, patch) {
  const w = allWeeks.value.find((x) => x.id === id)
  if (w) Object.assign(w, patch)
  fail((await supabase.from('weeks').update(patch).eq('id', id)).error)
}

async function deleteWeek(id) {
  if (fail((await supabase.from('weeks').delete().eq('id', id)).error)) return
  allWeeks.value = allWeeks.value.filter((w) => w.id !== id)
  allEntries.value = allEntries.value.filter((e) => e.week_id !== id)
  allEvents.value = allEvents.value.filter((e) => e.week_id !== id)
}

/* ---------- Tâches ---------- */
async function addEntry(week_id, date, kind = 'Implémentation') {
  const { data, error: err } = await supabase
    .from('entries')
    .insert({ week_id, date, task: '', kind, status: 'wip', minutes: 0 })
    .select()
    .single()
  if (fail(err)) return null
  allEntries.value.push(data)
  return data
}

async function updateEntry(id, patch) {
  const e = allEntries.value.find((x) => x.id === id)
  if (e) Object.assign(e, patch)
  fail((await supabase.from('entries').update(patch).eq('id', id)).error)
}

async function deleteEntry(id) {
  if (fail((await supabase.from('entries').delete().eq('id', id)).error)) return
  allEntries.value = allEntries.value.filter((e) => e.id !== id)
}

/* ---------- Événements ---------- */
async function addEvent(week_id, date) {
  const { data, error: err } = await supabase
    .from('events')
    .insert({ week_id, date, kind: 'imprevu', description: '', minutes_lost: 0 })
    .select()
    .single()
  if (fail(err)) return null
  allEvents.value.push(data)
  return data
}

async function updateEvent(id, patch) {
  const e = allEvents.value.find((x) => x.id === id)
  if (e) Object.assign(e, patch)
  fail((await supabase.from('events').update(patch).eq('id', id)).error)
}

async function deleteEvent(id) {
  if (fail((await supabase.from('events').delete().eq('id', id)).error)) return
  allEvents.value = allEvents.value.filter((e) => e.id !== id)
}

export function useJournal() {
  return {
    projects, project, projectId, weeks, entries, events, loading, error,
    allWeeks, allEntries, githubToken,
    loadAll, reset, selectProject, saveGithubToken,
    addProject, updateProject, deleteProject,
    addWeek, updateWeek, deleteWeek,
    addEntry, updateEntry, deleteEntry,
    addEvent, updateEvent, deleteEvent,
  }
}
