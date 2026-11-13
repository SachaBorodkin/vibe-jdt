const DAYS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

export const EVENT_KINDS = {
  etml: 'Activité ETML',
  absence: 'Absence',
  imprevu: 'Imprévu',
  autre: 'Autre',
}

/** 90 -> "1h30", 45 -> "45 min" */
export function fmt(min) {
  min = Math.round(min || 0)
  const h = Math.floor(min / 60)
  const m = min % 60
  if (!h) return `${m} min`
  return `${h}h${String(m).padStart(2, '0')}`
}

/** Accepte "90", "45m", "1h30", "1:30", "1.5h". Retourne NaN si invalide. */
export function parseDuration(input) {
  const s = String(input ?? '').trim().toLowerCase().replace(',', '.')
  if (!s) return 0
  let m = s.match(/^(\d+)\s*(?:h|:)\s*(\d+)?\s*(?:m|min)?$/)
  if (m) return +m[1] * 60 + (+m[2] || 0)
  m = s.match(/^(\d+(?:\.\d+)?)\s*h$/)
  if (m) return Math.round(+m[1] * 60)
  m = s.match(/^(\d+)\s*(?:m|min)?$/)
  if (m) return +m[1]
  return NaN
}

export function toISO(d) {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function mondayOf(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay() || 7
  d.setDate(d.getDate() - (day - 1))
  return d
}

/** "2026-11-09" -> "09.11.2026" */
export function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

/** "2026-11-09" -> "Lundi 09.11.2026" */
export function fmtDay(iso) {
  if (!iso) return ''
  return `${DAYS[parseISO(iso).getDay()]} ${fmtDate(iso)}`
}

/** Numéro chronologique des semaines : la plus ancienne = 1 */
export function weekNumbers(weeks) {
  const map = new Map()
  ;[...weeks]
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .forEach((w, i) => map.set(w.id, i + 1))
  return map
}

export function weekTitle(week, n) {
  const base = n ? `Semaine ${n}` : `Semaine du ${fmtDate(week.start_date)}`
  return week.label ? `${base} · ${week.label}` : base
}

/** 90 -> "90 min" */
export function fmtMin(min) {
  return `${Math.round(min || 0)} min`
}

/** 190 -> "190 min (3h10)" */
export function fmtTotal(min) {
  min = Math.round(min || 0)
  return min >= 60 ? `${min} min (${fmt(min)})` : `${min} min`
}

/** Total des minutes, dont heures supplémentaires */
export function sumEntries(list) {
  let total = 0
  let overtime = 0
  for (const e of list) {
    total += e.minutes || 0
    if (e.overtime) overtime += e.minutes || 0
  }
  return { total, overtime }
}

function esc(s) {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
}

/** Export Markdown complet du journal (toutes les semaines). */
export function buildMarkdown(weeks, entries, events, projectName = '') {
  const out = [`# Journal de travail${projectName ? ' – ' + projectName : ''}`, '']
  const sorted = [...weeks].sort((a, b) => a.start_date.localeCompare(b.start_date))
  const nums = weekNumbers(weeks)

  for (const w of sorted) {
    const we = entries.filter((e) => e.week_id === w.id)
    const wv = events.filter((e) => e.week_id === w.id)
    const dates = [...new Set([...we.map((e) => e.date), ...wv.map((e) => e.date)])].sort()

    out.push(`## ${weekTitle(w, nums.get(w.id))}`, '')
    if (!dates.length) out.push('_Aucune entrée._', '')

    for (const d of dates) {
      const de = we.filter((e) => e.date === d).sort((a, b) => a.created_at.localeCompare(b.created_at))
      const dv = wv.filter((e) => e.date === d)
      const s = sumEntries(de)
      out.push(`### ${fmtDay(d)}`, '')

      if (de.length) {
        out.push('| Tâche | Statut | Durée | Artefact | Résultat | HS |', '|---|---|---|---|---|---|')
        for (const e of de) {
          const task = esc(e.task) + (e.status === 'wip' ? ' [WIP]' : '')
          const art = e.commit_url ? `[commit](${e.commit_url})` : ''
          const res = e.outcome === 'success' ? 'Succès' : e.outcome === 'failure' ? 'Échec' : ''
          out.push(`| ${task} | ${e.status === 'done' ? 'Terminé' : 'En cours'} | ${fmt(e.minutes)} | ${art} | ${res} | ${e.overtime ? 'oui' : ''} |`)
        }
        out.push('')
        for (const e of de) {
          if (e.comment) out.push(`- **${esc(e.task)}** (${fmt(e.minutes)}) : ${e.comment.replace(/\n/g, ' ')}`)
        }
        if (de.some((e) => e.comment)) out.push('')
      }

      if (dv.length) {
        out.push('**Événements :**', '')
        for (const v of dv) {
          const lost = v.minutes_lost ? ` (−${fmt(v.minutes_lost)})` : ''
          out.push(`- ${EVENT_KINDS[v.kind] || v.kind} : ${v.description}${lost}`)
        }
        out.push('')
      }

      const ot = s.overtime ? ` dont ${fmt(s.overtime)} d'heures supplémentaires` : ''
      out.push(`**Total du jour : ${fmt(s.total)}**${ot}`, '')
    }

    const ws = sumEntries(we)
    out.push(`**Total de la semaine : ${fmt(ws.total)}**${ws.overtime ? ` (dont ${fmt(ws.overtime)} HS)` : ''}`, '')
  }

  const ps = sumEntries(entries)
  out.push('---', '', `## Total du projet : ${fmt(ps.total)}`)
  if (ps.overtime) out.push('', `Heures supplémentaires : ${fmt(ps.overtime)}`)
  return out.join('\n') + '\n'
}
