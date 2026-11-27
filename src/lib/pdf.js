import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { EVENT_KINDS, fmtDate, fmtDay, fmtMin, fmtTotal, kindClass, sumEntries, weekNumbers, weekTitle } from './format'

const MARGIN = 14
const ACCENT = [47, 91, 234]
const GRID = [150, 156, 168]

/** Couleurs de la colonne Type dans le PDF (fond clair, texte fondu). */
const KIND_COLORS = {
  't-doc': [[232, 238, 255], [30, 58, 138]],
  't-analyse': [[241, 236, 255], [76, 43, 138]],
  't-absent': [[238, 240, 243], [70, 76, 86]],
  't-test': [[226, 246, 241], [14, 92, 80]],
  't-impl': [[230, 246, 235], [22, 101, 52]],
  't-custom': [[236, 239, 244], [55, 62, 74]],
}

/**
 * Génère et télécharge le journal en PDF (une table par semaine).
 * @param weeks   semaines à inclure
 * @param entries toutes les tâches (pour le total projet)
 * @param events  tous les événements
 * @param allWeeks toutes les semaines du projet (pour la numérotation)
 * @param projectName nom du projet (titre du PDF)
 */
export function downloadPdf(weeks, entries, events, filename = 'journal-de-travail.pdf', allWeeks = weeks, projectName = '') {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const nums = weekNumbers(allWeeks)
  const sorted = [...weeks].sort((a, b) => a.start_date.localeCompare(b.start_date))
  let y = 18

  const ensure = (needed) => {
    if (y + needed > pageH - 16) {
      doc.addPage()
      y = 18
    }
  }
  const text = (str, size, style = 'normal', color = [28, 34, 48]) => {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    doc.text(str, MARGIN, y)
  }

  const tableStyles = { fontSize: 9, cellPadding: 2, lineColor: GRID, lineWidth: 0.2, textColor: [28, 34, 48] }
  const headStyles = { fillColor: [255, 255, 255], textColor: [28, 34, 48], fontStyle: 'bold', halign: 'center' }

  // Titre
  text(projectName ? `Journal de travail – ${projectName}` : 'Journal de travail', 20, 'bold')
  y += 7
  const ps = sumEntries(entries)
  text(
    `Total du projet : ${fmtTotal(ps.total)}` + (ps.overtime ? `   |   Heures supplémentaires : ${fmtMin(ps.overtime)}` : ''),
    10,
    'normal',
    [107, 115, 133],
  )
  y += 4

  for (const w of sorted) {
    const we = entries
      .filter((e) => e.week_id === w.id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
    const wv = events
      .filter((e) => e.week_id === w.id)
      .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))

    ensure(30)
    y += 10
    text(weekTitle(w, nums.get(w.id)), 16, 'bold')
    y += 2
    doc.setDrawColor(...GRID)
    doc.line(MARGIN, y, pageW - MARGIN, y)
    y += 4

    // Corps : tâches + total après chaque jour
    const body = []
    const dates = [...new Set(we.map((e) => e.date))]
    for (const d of dates) {
      const de = we.filter((e) => e.date === d)
      for (const e of de) {
        body.push([
          fmtDate(e.date),
          e.task + (e.status === 'wip' ? ' [WIP]' : ''),
          e.kind || '',
          e.status === 'done' ? '[DONE]' : '[WIP]',
          e.comment || '',
          fmtMin(e.minutes),
          e.commit_url ? { content: 'commit', url: e.commit_url } : '',
          e.outcome === 'success' ? 'Succès' : e.outcome === 'failure' ? 'Échec' : '',
          e.overtime ? 'oui' : '',
        ])
      }
      const s = sumEntries(de)
      body.push([
        { content: `Total ${fmtDay(d)}`, colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [245, 246, 249] } },
        { content: fmtTotal(s.total), styles: { halign: 'center', fontStyle: 'bold', fillColor: [245, 246, 249] } },
        {
          content: s.overtime ? `dont ${fmtMin(s.overtime)} d'heures supplémentaires` : '',
          colSpan: 3,
          styles: { fontStyle: 'italic', textColor: [107, 115, 133], fillColor: [245, 246, 249] },
        },
      ])
    }
    const ws = sumEntries(we)
    if (we.length) {
      body.push([
        { content: 'Total semaine', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: [232, 238, 254], textColor: ACCENT } },
        { content: fmtTotal(ws.total), styles: { halign: 'center', fontStyle: 'bold', fillColor: [232, 238, 254], textColor: ACCENT } },
        {
          content: ws.overtime ? `dont ${fmtMin(ws.overtime)} HS` : '',
          colSpan: 3,
          styles: { fillColor: [232, 238, 254], textColor: ACCENT },
        },
      ])
    } else {
      body.push([{ content: 'Aucune tâche.', colSpan: 9, styles: { halign: 'center', textColor: [107, 115, 133] } }])
    }

    autoTable(doc, {
      startY: y,
      head: [['Date', 'Tâche', 'Type', 'État', 'Commentaire', 'Durée', 'Artefact', 'Résultat', 'HS']],
      body,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      styles: tableStyles,
      headStyles,
      columnStyles: {
        0: { cellWidth: 21, halign: 'center' },
        1: { cellWidth: 48 },
        2: { cellWidth: 26 },
        3: { cellWidth: 17, halign: 'center' },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 23, halign: 'center' },
        6: { cellWidth: 17, halign: 'center' },
        7: { cellWidth: 18, halign: 'center' },
        8: { cellWidth: 10, halign: 'center' },
      },
      didParseCell: (data) => {
        if (data.section !== 'body') return
        // Colonne Type : fond clair de la couleur du type
        if (data.column.index === 2 && typeof data.cell.raw === 'string') {
          const [fill, text] = KIND_COLORS[kindClass(data.cell.raw)] || KIND_COLORS['t-custom']
          data.cell.styles.fillColor = fill
          data.cell.styles.textColor = text
        }
        if (data.column.index === 6 && data.cell.raw?.url) data.cell.styles.textColor = ACCENT
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 6 && data.cell.raw?.url) {
          doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: data.cell.raw.url })
        }
      },
    })
    y = doc.lastAutoTable.finalY + 6

    // Événements
    if (wv.length) {
      ensure(24)
      text('Événements impactant le temps de travail', 12, 'bold')
      y += 3
      autoTable(doc, {
        startY: y,
        head: [['Date', 'Type', 'Description', 'Temps perdu']],
        body: wv.map((v) => [
          fmtDate(v.date),
          EVENT_KINDS[v.kind] || v.kind,
          v.description,
          v.minutes_lost ? fmtMin(v.minutes_lost) : '-',
        ]),
        margin: { left: MARGIN, right: MARGIN },
        theme: 'grid',
        styles: tableStyles,
        headStyles,
        columnStyles: { 0: { cellWidth: 22, halign: 'center' }, 1: { cellWidth: 36, halign: 'center' }, 3: { cellWidth: 30, halign: 'center' } },
      })
      y = doc.lastAutoTable.finalY + 6
    }
  }

  // Total projet
  ensure(18)
  y += 4
  doc.setDrawColor(...ACCENT)
  doc.line(MARGIN, y - 4, pageW - MARGIN, y - 4)
  text(`Total du projet : ${fmtTotal(ps.total)}`, 13, 'bold')
  if (ps.overtime) {
    y += 6
    text(`Heures supplémentaires : ${fmtMin(ps.overtime)}`, 10)
  }

  // Pied de page
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(140, 146, 160)
    doc.text(`Journal de travail${projectName ? ' – ' + projectName : ''} - généré le ${fmtDate(new Date().toISOString().slice(0, 10))}`, MARGIN, pageH - 8)
    doc.text(`${i} / ${pages}`, pageW - MARGIN, pageH - 8, { align: 'right' })
  }

  doc.save(filename)
}
