import { DEMOS, type DemoHit, type DemoNote, type StyleDemo } from './demos'
import { style as findStyle, styleSet } from './styles'
import { improviseGroove } from './improvise'
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

/** Move the backbeat off the grid: accents land between the beats. */
function offbeat(demo: StyleDemo): StyleDemo {
  const shift = (items: DemoHit[]) =>
    items.map((h) =>
      h.voice === 'kick' ? h : { ...h, at: Number((h.at + 0.5).toFixed(3)) % (demo.bars * 4) },
    )
  return {
    ...demo,
    drums: shift(demo.drums),
    bass: demo.bass,
    chords: demo.chords.map((n) => ({ ...n, at: Number((n.at + 0.5).toFixed(3)) % (demo.bars * 4) })),
    lead: demo.lead,
  }
}

/** Strip it back to the bare bones — kick, backbeat and a held chord. */
function sparse(demo: StyleDemo): StyleDemo {
  return {
    ...demo,
    drums: demo.drums.filter(
      (h) => h.voice === 'kick' || h.voice === 'snare' || h.voice === 'clap',
    ),
    bass: keepEvery(demo.bass, 2).map((n) => ({ ...n, len: Math.max(n.len, 1.8) })),
    chords: holdChords(demo.chords, demo.bars),
    lead: demo.lead.filter((_, i) => i % 3 === 0).map((n) => ({ ...n, len: n.len * 2 })),
  }
}

/** Pull the kick off the downbeat so the groove trips forward. */
function broken(demo: StyleDemo): StyleDemo {
  return {
    ...demo,
    drums: demo.drums.map((h, i) =>
      h.voice === 'kick' && i % 2 === 1
        ? { ...h, at: Number((h.at + 0.75).toFixed(3)) % (demo.bars * 4) }
        : h,
    ),
    bass: demo.bass.map((n, i) =>
      i % 3 === 2 ? { ...n, at: Number((n.at + 0.25).toFixed(3)), len: Math.min(n.len, 0.4) } : n,
    ),
    chords: demo.chords,
    lead: demo.lead,
  }
}

/** Everything at twice the rate — the same groove, twice as urgent. */
function doubled(demo: StyleDemo): StyleDemo {
  const fold = <T extends { at: number }>(items: T[]) =>
    items.flatMap((item) => [
      { ...item, at: item.at / 2 },
      { ...item, at: item.at / 2 + demo.bars * 2 },
    ])
  return {
    ...demo,
    drums: fold(demo.drums) as DemoHit[],
    bass: fold(demo.bass).map((n) => ({ ...n, len: Math.max(0.2, n.len / 2) })) as DemoNote[],
    chords: fold(demo.chords).map((n) => ({ ...n, len: Math.max(0.2, n.len / 2) })) as DemoNote[],
    lead: demo.lead,
  }
}

/** Shuffle the off-beats — the lilt that turns straight eighths into a swing. */
function shuffled(demo: StyleDemo): StyleDemo {
  const swing = <T extends { at: number }>(items: T[]) =>
    items.map((item) =>
      Math.abs((item.at % 1) - 0.5) < 0.02 ? { ...item, at: Number((item.at + 0.16).toFixed(3)) } : item,
    )
  return {
    ...demo,
    drums: swing(demo.drums) as DemoHit[],
    bass: swing(demo.bass) as DemoNote[],
    chords: swing(demo.chords) as DemoNote[],
    lead: swing(demo.lead) as DemoNote[],
  }
}

/** Drop the drums entirely — just the harmony, for singing over. */
function unplugged(demo: StyleDemo): StyleDemo {
  return {
    ...demo,
    drums: [],
    bass: keepEvery(demo.bass, 1).map((n) => ({ ...n, len: Math.max(n.len, 0.8) })),
    chords: demo.chords,
    lead: demo.lead,
  }
}

/** Halve the chords and double the drums — a build-up feel. */
function driven(demo: StyleDemo): StyleDemo {
  const busy = driving(demo)
  return { ...busy, chords: holdChords(demo.chords, demo.bars), lead: demo.lead }
}

const cache = new Map<string, Groove[]>()

const SHAPES: { id: string; label: string; hint: string; apply: (d: StyleDemo) => StyleDemo }[] = [
  { id: 'basis', label: 'Grundgroove', hint: 'Der typische Beat dieser Richtung', apply: (d) => d },
  { id: 'ruhig', label: 'Ruhig', hint: 'Halbes Tempo im Gefühl, viel Luft', apply: calmer },
  { id: 'treibend', label: 'Treibend', hint: 'Dichter, mit Offbeats und laufendem Bass', apply: driving },
  { id: 'sparsam', label: 'Sparsam', hint: 'Nur das Nötigste — viel Platz zum Singen', apply: sparse },
  { id: 'offbeat', label: 'Offbeat', hint: 'Die Akzente liegen zwischen den Schlägen', apply: offbeat },
  { id: 'gebrochen', label: 'Gebrochen', hint: 'Verschobene Bassdrum, stolpernd', apply: broken },
  { id: 'shuffle', label: 'Shuffle', hint: 'Mit Schwung, angeschrägte Achtel', apply: shuffled },
  { id: 'doppelt', label: 'Doppelt', hint: 'Doppeltes Tempo im Gefühl', apply: doubled },
  { id: 'aufbau', label: 'Aufbau', hint: 'Dichte Drums über liegenden Akkorden', apply: driven },
  { id: 'unplugged', label: 'Ohne Drums', hint: 'Nur Harmonie, kein Schlagzeug', apply: unplugged },
]

/** Ten feels per style, so a genre is never one single loop. */
export function grooves(styleId: string): Groove[] {
  const cached = cache.get(styleId)
  if (cached) return cached
  const base = DEMOS[styleId] ?? DEMOS.synthwave
  const list: Groove[] = SHAPES.map((shape) => ({
    id: shape.id,
    label: shape.label,
    hint: shape.hint,
    demo: shape.apply(base),
  }))
  cache.set(styleId, list)
  return list
}

export const DICE_GROOVE = 'wuerfeln'

export function groove(styleId: string, grooveId: string, seed = 1): Groove {
  if (grooveId === DICE_GROOVE) {
    return {
      id: DICE_GROOVE,
      label: 'Gewürfelt',
      hint: 'Jedes Mal neu ausgewürfelt — innerhalb der Regeln des Genres',
      demo: improviseGroove(styleId, seed),
    }
  }
  const list = grooves(styleId)
  return list.find((g) => g.id === grooveId) ?? list[0]
}

/** The composed feels plus the one that is different every time. */
export function grooveChoices(styleId: string): { id: string; label: string; hint: string }[] {
  return [
    ...grooves(styleId).map(({ id, label, hint }) => ({ id, label, hint })),
    { id: DICE_GROOVE, label: '🎲 Gewürfelt', hint: 'Jedes Mal neu — innerhalb der Regeln des Genres' },
  ]
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
  const { demo } = groove(styleId, grooveId, seed)
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
    styleId,
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
