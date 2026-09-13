import { DEMOS, type DemoHit, type DemoNote, type StyleDemo } from './demos'
import { style as findStyle, styleSet } from './styles'
import { generateLead } from './melody'
import { dedupeNotes, LOOP_COLORS, uid } from '../music'
import { humanize } from './humanize'
import type { DrumVoice, Loop, Note } from '../types'

export interface Groove {
  id: string
  label: string
  hint: string
  demo: StyleDemo
}

function keepEvery<T extends { at: number }>(items: T[], every: number): T[] {
  return items.filter((item) => Math.abs((item.at / every) % 1) < 0.01)
}

/** One long chord per bar instead of the pattern's own rhythm. */
function holdChords(chords: DemoNote[], bars: number): DemoNote[] {
  const out: DemoNote[] = []
  for (let bar = 0; bar < bars; bar++) {
    const inBar = chords.filter((n) => n.at >= bar * 4 && n.at < bar * 4 + 4)
    if (!inBar.length) continue
    const first = Math.min(...inBar.map((n) => n.at))
    const steps = [...new Set(inBar.filter((n) => n.at === first).map((n) => n.step))]
    for (const step of steps) out.push({ step, at: bar * 4, len: 3.8, vel: 0.45 })
  }
  return out
}

/** Halve the feel: fewer hits, longer notes, more air. */
function calmer(demo: StyleDemo): StyleDemo {
  const drums: DemoHit[] = demo.drums.filter((h) => {
    if (h.voice === 'kick') return h.at % 2 < 0.01
    if (h.voice === 'snare' || h.voice === 'clap') return h.at % 4 >= 2.99 && h.at % 4 < 3.01
    return h.at % 1 < 0.01
  })
  const bass = keepEvery(demo.bass, 1).map((n) => ({ ...n, len: Math.max(n.len, 0.9) }))
  return {
    ...demo,
    drums: drums.length ? drums : demo.drums.filter((h) => h.voice === 'kick'),
    bass: bass.length ? bass : demo.bass,
    chords: holdChords(demo.chords, demo.bars),
    lead: demo.lead.filter((_, i) => i % 2 === 0).map((n) => ({ ...n, len: n.len * 1.6 })),
  }
}

/** Push it forward: offbeats, doubled bass, shorter chord stabs. */
function driving(demo: StyleDemo): StyleDemo {
  const extraHats: DemoHit[] = []
  for (let beat = 0; beat < demo.bars * 4; beat += 0.5) {
    if (!demo.drums.some((h) => Math.abs(h.at - beat) < 0.01 && h.voice !== 'kick')) {
      extraHats.push({ voice: 'hat', at: beat, vel: beat % 1 === 0 ? 0.3 : 0.45 })
    }
  }
  const bass: DemoNote[] = []
  for (const note of demo.bass) {
    bass.push({ ...note, len: Math.min(note.len, 0.42) })
    if (note.len >= 0.9) bass.push({ ...note, at: note.at + note.len / 2, len: 0.42 })
  }
  return {
    ...demo,
    drums: [...demo.drums, ...extraHats],
    bass,
    chords: demo.chords.map((n) => ({ ...n, len: Math.min(n.len, 0.45) })),
    lead: demo.lead,
  }
}

const cache = new Map<string, Groove[]>()

/** Three feels per style, so a genre is not one single loop forever. */
export function grooves(styleId: string): Groove[] {
  const cached = cache.get(styleId)
  if (cached) return cached
  const base = DEMOS[styleId] ?? DEMOS.synthwave
  const list: Groove[] = [
    { id: 'basis', label: 'Grundgroove', hint: 'Der typische Beat dieser Richtung', demo: base },
    { id: 'ruhig', label: 'Ruhig', hint: 'Halbes Tempo im Gefühl, viel Luft', demo: calmer(base) },
    { id: 'treibend', label: 'Treibend', hint: 'Dichter, mit Offbeats und laufendem Bass', demo: driving(base) },
  ]
  cache.set(styleId, list)
  return list
}

export function groove(styleId: string, grooveId: string): Groove {
  const list = grooves(styleId)
  return list.find((g) => g.id === grooveId) ?? list[0]
}

function drumNote(hit: DemoHit, shift: number): Note {
  return {
    id: uid('n'),
    start: hit.at + shift,
    duration: 0.25,
    pitch: 36,
    velocity: hit.vel ?? 0.9,
    drum: hit.voice as DrumVoice,
  }
}

/**
 * Turn a groove into real lanes so it can be used as a starting point — put the
 * beat down first, then sing over it.
 */
export function grooveToLoops(
  styleId: string,
  grooveId: string,
  bars: number,
  tonic = 60,
  /** Changing the seed writes a different melody over the same groove. */
  seed = 1,
  /** Which line-up to use */
  setIndex = 0,
): Loop[] {
  const style = { ...findStyle(styleId), ...styleSet(styleId, setIndex) }
  const { demo } = groove(styleId, grooveId)
  const repeats = Math.max(1, Math.ceil(bars / demo.bars))

  const bass: Note[] = []
  const chords: Note[] = []
  const drums: Note[] = []

  for (let r = 0; r < repeats; r++) {
    const shift = r * demo.bars * 4
    for (const note of demo.bass) {
      bass.push({ id: uid('n'), start: note.at + shift, duration: note.len, pitch: tonic + note.step, velocity: note.vel ?? 0.9 })
    }
    for (const note of demo.chords) {
      chords.push({ id: uid('n'), start: note.at + shift, duration: note.len, pitch: tonic + note.step, velocity: note.vel ?? 0.55 })
    }
    for (const hit of demo.drums) drums.push(drumNote(hit, shift))
  }

  const totalBars = repeats * demo.bars
  const make = (name: string, instrument: string, notes: Note[], kind: Loop['kind'], index: number): Loop => ({
    id: uid('loop'),
    name,
    bars: totalBars,
    kind,
    instrument,
    notes,
    color: LOOP_COLORS[index % LOOP_COLORS.length],
    muted: false,
    solo: false,
    volume: kind === 'drum' ? -3 : -4,
    transpose: 0,
  })

  // A suggested tune over the groove: something to sing along to, change, or
  // simply mute once your own melody is in.
  const totalBeats = totalBars * 4
  const lead = generateLead(demo, seed, {
    bars: totalBars,
    scaleId: style.scaleId,
    register: 12,
    density: 0.5,
  })
    .filter((n) => n.at < totalBeats)
    .map((n) => ({
      id: uid('n'),
      start: n.at,
      duration: n.len,
      pitch: tonic + n.step,
      velocity: n.vel ?? 0.75,
    }))

  const loops: Loop[] = []
  if (lead.length) {
    loops.push(make('Melodie-Vorschlag', style.lead, humanize(dedupeNotes(lead), styleId, 'lead', seed), 'melodic', 0))
  }
  if (bass.length) {
    loops.push(make('Bass', style.bass, humanize(dedupeNotes(bass), styleId, 'bass', seed + 1), 'melodic', 1))
  }
  if (chords.length) {
    loops.push(make('Akkorde', style.chords, humanize(dedupeNotes(chords), styleId, 'chords', seed + 2), 'melodic', 2))
  }
  if (drums.length) {
    loops.push(make('Schlagzeug', 'drums', humanize(dedupeNotes(drums), styleId, 'drums', seed + 3), 'drum', 3))
  }
  return loops
}
