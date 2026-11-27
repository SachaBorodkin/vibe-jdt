<script setup>
import { computed } from 'vue'
import { useJournal } from '../composables/useJournal'
import DateField from './DateField.vue'
import Icon from './Icon.vue'
import {
  ENTRY_KINDS, EVENT_KINDS, fmtDate, fmtDay, fmtMin, fmtTotal, kindClass, parseDuration, parseISO, toISO,
  sumEntries, weekNumbers, weekTitle,
} from '../lib/format'

const props = defineProps({ week: { type: Object, required: true } })
const j = useJournal()

const number = computed(() => weekNumbers(j.weeks.value).get(props.week.id))

const weekEntries = computed(() =>
  j.entries.value
    .filter((e) => e.week_id === props.week.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)),
)
const weekEvents = computed(() =>
  j.events.value
    .filter((e) => e.week_id === props.week.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)),
)

const weekSum = computed(() => sumEntries(weekEntries.value))
const projectSum = computed(() => sumEntries(j.entries.value))

/** Lignes du tableau : tâches + une ligne de total après chaque jour */
const rows = computed(() => {
  const out = []
  const list = weekEntries.value
  list.forEach((e, i) => {
    out.push({ type: 'entry', key: e.id, e })
    const next = list[i + 1]
    if (!next || next.date !== e.date) {
      const s = sumEntries(list.filter((x) => x.date === e.date))
      out.push({ type: 'day', key: 'day-' + e.date, date: e.date, ...s })
    }
  })
  return out
})

const missingComments = computed(() => weekEntries.value.filter((e) => needsComment(e) && !e.comment?.trim()).length)

function needsComment(e) {
  return (e.minutes || 0) >= 45
}

/** Champ texte qui grandit avec son contenu : rien n'est tronqué dans le tableau. */
function resizeEl(el) {
  if (!el || !el.scrollHeight) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

const vAutosize = { mounted: resizeEl, updated: resizeEl }

/* Type de tâche : liste prédéfinie, ou valeur libre (« Autre… »). */
const KIND_CUSTOM = '__custom'

function presetKind(kind) {
  return ENTRY_KINDS.includes(kind) ? kind : KIND_CUSTOM
}

function setKind(e, value) {
  // « Autre… » vide le type en attendant la saisie libre.
  j.updateEntry(e.id, { kind: value === KIND_CUSTOM ? '' : value })
}

/** Couleur du type : fixée par classe pour les types connus, teinte dérivée du texte pour les autres. */
function kindStyle(kind) {
  if (kindClass(kind) !== 't-custom') return null
  let h = 0
  for (const ch of String(kind || '')) h = (h * 31 + ch.charCodeAt(0)) % 360
  return { '--kind-bg': `hsl(${h} 32% 22%)`, '--kind-fg': `hsl(${h} 65% 80%)` }
}

function defaultDate() {
  const start = parseISO(props.week.start_date)
  const today = new Date()
  const diff = Math.floor((today - start) / 86400000)
  // Semaine en cours : la nouvelle ligne est datée d'aujourd'hui, pas du dernier jour saisi.
  if (diff >= 0 && diff <= 6) return toISO(today)
  // Semaine passée : on enchaîne sur la dernière date utilisée.
  const last = weekEntries.value[weekEntries.value.length - 1]
  return last ? last.date : props.week.start_date
}

const newEntry = () => j.addEntry(props.week.id, defaultDate())
const newEvent = () => j.addEvent(props.week.id, defaultDate())

function setDuration(e, ev) {
  const v = parseDuration(ev.target.value)
  if (Number.isNaN(v)) {
    ev.target.value = fmtMin(e.minutes)
    return
  }
  j.updateEntry(e.id, { minutes: v })
  ev.target.value = fmtMin(v)
}

function setLost(e, ev) {
  const v = parseDuration(ev.target.value)
  if (Number.isNaN(v)) {
    ev.target.value = fmtMin(e.minutes_lost)
    return
  }
  j.updateEvent(e.id, { minutes_lost: v })
  ev.target.value = fmtMin(v)
}

function renameWeek() {
  const label = prompt('Titre de la semaine (optionnel)', props.week.label || '')
  if (label !== null) j.updateWeek(props.week.id, { label: label.trim() || null })
}

function removeWeek() {
  if (confirm(`Supprimer « ${weekTitle(props.week, number.value)} » et toutes ses entrées ?`)) j.deleteWeek(props.week.id)
}

const validUrl = (u) => /^https?:\/\//i.test(u || '')
</script>

<template>
  <section class="week">
    <header class="week-head">
      <div>
        <h2>{{ weekTitle(week, number) }}</h2>
        <p class="muted small">Semaine du {{ fmtDate(week.start_date) }}</p>
      </div>
      <div class="no-print head-actions">
        <button class="ghost" @click="renameWeek">Renommer</button>
        <button class="ghost danger" @click="removeWeek">Supprimer</button>
      </div>
    </header>

    <p v-if="missingComments" class="warn">
      {{ missingComments }} tâche(s) de 45 min ou plus sans commentaire : un commentaire est requis.
    </p>

    <!-- Tâches -->
    <div class="table-scroll">
      <table class="grid entries">
        <thead>
          <tr>
            <th class="c-date">Date</th>
            <th class="c-task">Tâche</th>
            <th class="c-kind">Type</th>
            <th class="c-state">État</th>
            <th class="c-comment">Commentaire</th>
            <th class="c-dur">Durée</th>
            <th class="c-art">Artefact (commit)</th>
            <th class="c-out">Résultat</th>
            <th class="c-ot" title="Heures supplémentaires">HS</th>
            <th class="c-act no-print"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!rows.length"><td colspan="10" class="empty">Aucune tâche. Ajoutes-en une pour commencer.</td></tr>
          <template v-for="r in rows" :key="r.key">
            <tr v-if="r.type === 'entry'" :class="{ wip: r.e.status === 'wip' }">
              <td class="c-date">
                <DateField :model-value="r.e.date" @update:model-value="j.updateEntry(r.e.id, { date: $event })" />
              </td>
              <td>
                <div class="cell-stack">
                  <textarea
                    v-autosize
                    class="multi"
                    rows="1"
                    :value="r.e.task"
                    placeholder="Tâche réalisée"
                    @input="resizeEl($event.target)"
                    @change="j.updateEntry(r.e.id, { task: $event.target.value })"
                  ></textarea>
                  <span v-if="r.e.status === 'wip'" class="tag-wip">[WIP]</span>
                </div>
              </td>
              <td class="c-kind" :class="kindClass(r.e.kind)" :style="kindStyle(r.e.kind)">
                <div class="cell-stack">
                  <select :value="presetKind(r.e.kind)" @change="setKind(r.e, $event.target.value)">
                    <option v-for="k in ENTRY_KINDS" :key="k" :value="k">{{ k }}</option>
                    <option :value="KIND_CUSTOM">Autre…</option>
                  </select>
                  <input
                    v-if="!ENTRY_KINDS.includes(r.e.kind)"
                    class="kind-custom"
                    :value="r.e.kind"
                    placeholder="Type personnalisé"
                    @change="j.updateEntry(r.e.id, { kind: $event.target.value.trim() })"
                  />
                </div>
              </td>
              <td class="center">
                <select :value="r.e.status" @change="j.updateEntry(r.e.id, { status: $event.target.value })">
                  <option value="done">[DONE]</option>
                  <option value="wip">[WIP]</option>
                </select>
              </td>
              <td>
                <textarea
                  v-autosize
                  class="multi"
                  rows="1"
                  :class="{ missing: needsComment(r.e) && !r.e.comment?.trim() }"
                  :value="r.e.comment"
                  :placeholder="needsComment(r.e) ? 'Commentaire requis (≥ 45 min)' : ''"
                  @input="resizeEl($event.target)"
                  @change="j.updateEntry(r.e.id, { comment: $event.target.value.trim() || null })"
                ></textarea>
              </td>
              <td><input class="dur" :value="fmtMin(r.e.minutes)" title="Ex. 45, 1h30, 1:15" @change="setDuration(r.e, $event)" /></td>
              <td>
                <div class="inline">
                  <input :value="r.e.commit_url" placeholder="Lien du commit" @change="j.updateEntry(r.e.id, { commit_url: $event.target.value.trim() || null })" />
                  <a v-if="validUrl(r.e.commit_url)" :href="r.e.commit_url" target="_blank" rel="noopener" class="ext" title="Ouvrir le commit">↗</a>
                </div>
              </td>
              <td class="center">
                <select :value="r.e.outcome || ''" :class="r.e.outcome" @change="j.updateEntry(r.e.id, { outcome: $event.target.value || null })">
                  <option value="">—</option>
                  <option value="success">Succès</option>
                  <option value="failure">Échec</option>
                </select>
              </td>
              <td class="center">
                <input type="checkbox" :checked="r.e.overtime" @change="j.updateEntry(r.e.id, { overtime: $event.target.checked })" />
              </td>
              <td class="c-act no-print">
                <button class="icon danger" title="Supprimer" aria-label="Supprimer la tâche" @click="j.deleteEntry(r.e.id)"><Icon name="x" /></button>
              </td>
            </tr>

            <tr v-else class="total-row day">
              <td colspan="5" class="right">Total {{ fmtDay(r.date) }}</td>
              <td>{{ fmtTotal(r.total) }}</td>
              <td colspan="4" class="left">{{ r.overtime ? `dont ${fmtMin(r.overtime)} d'heures supplémentaires` : '' }}</td>
            </tr>
          </template>
        </tbody>
        <tfoot v-if="rows.length">
          <tr class="total-row week-total">
            <td colspan="5" class="right">Total semaine</td>
            <td>{{ fmtTotal(weekSum.total) }}</td>
            <td colspan="4" class="left">{{ weekSum.overtime ? `dont ${fmtMin(weekSum.overtime)} HS` : '' }}</td>
          </tr>
          <tr class="total-row project-total">
            <td colspan="5" class="right">Total projet</td>
            <td>{{ fmtTotal(projectSum.total) }}</td>
            <td colspan="4" class="left">{{ projectSum.overtime ? `dont ${fmtMin(projectSum.overtime)} HS` : '' }}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    <div class="no-print"><button class="primary" @click="newEntry">+ Ajouter une tâche</button></div>

    <!-- Événements -->
    <h3 class="sub">Événements impactant le temps de travail</h3>
    <p class="muted small">Activités ETML planifiées, absences, imprévus…</p>
    <div class="table-scroll">
      <table class="grid events">
        <thead>
          <tr>
            <th class="c-date">Date</th>
            <th class="c-type">Type</th>
            <th class="c-desc">Description</th>
            <th class="c-dur">Temps perdu</th>
            <th class="c-act no-print"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!weekEvents.length"><td colspan="5" class="empty">Aucun événement.</td></tr>
          <tr v-for="v in weekEvents" :key="v.id">
            <td class="c-date">
              <DateField :model-value="v.date" @update:model-value="j.updateEvent(v.id, { date: $event })" />
            </td>
            <td class="center c-type">
              <select :value="v.kind" @change="j.updateEvent(v.id, { kind: $event.target.value })">
                <option v-for="(label, k) in EVENT_KINDS" :key="k" :value="k">{{ label }}</option>
              </select>
            </td>
            <td class="c-desc">
              <textarea
                v-autosize
                class="multi"
                rows="1"
                :value="v.description"
                placeholder="Description"
                @input="resizeEl($event.target)"
                @change="j.updateEvent(v.id, { description: $event.target.value })"
              ></textarea>
            </td>
            <td><input class="dur" :value="fmtMin(v.minutes_lost)" @change="setLost(v, $event)" /></td>
            <td class="c-act no-print">
              <button class="icon danger" title="Supprimer" aria-label="Supprimer l'événement" @click="j.deleteEvent(v.id)"><Icon name="x" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="no-print"><button @click="newEvent">+ Ajouter un événement</button></div>
  </section>
</template>
