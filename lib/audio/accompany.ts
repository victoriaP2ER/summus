import { groove as findGroove } from './grooves'
import { style as findStyle, styleSet } from './styles'
import { barRoots } from './songsplit'
import { dedupeNotes, LOOP_COLORS, uid } from '../music'
import { fitPartToInstrument } from './instruments'
import { LEVELS } from './levels'
import { humanize } from './humanize'
import type { Loop, Note } from '../types'

/** Minor-ish scales get minor chords under the melody. */
function isMinor(scaleId: string): boolean {
  return ['minor', 'harmonicMinor', 'dorian', 'pentaMinor', 'blues'].includes(scaleId)
}

/**
 * The lowest note of a pattern bar — used as the reference the rest of the bar
 * is measured against, so a riff keeps its shape when it is re-rooted.
 */
function reference(notes: { step: number; at: number }[], from: number, to: number): number | null {
  const inBar = notes.filter((n) => n.at >= from && n.at < to)
  if (!inBar.length) return null
  return Math.min(...inBar.map((n) => n.step))
}

export interface Accompaniment {
  loops: Loop[]
}

/**
 * Build a band around a hummed melody: bass, chords and drums taken from the
 * style's own groove, but rooted on the harmony the melody actually implies.
 *
 * The rhythm comes from the demo pattern, the pitches from the melody — so it
 * sounds like the genre without fighting the tune.
 */
export function buildAccompaniment(
  melody: Loop,
  styleId: string,
  scaleId: string,
  colourOffset = 1,
  /** Which of the style's grooves to build the backing from */
  grooveId = 'basis',
  /** Which line-up to use — different sets make the same genre sound different */
  setIndex = 0,
  /** Seed for the dice groove */
  diceSeed = 1,
): Loop[] {
  const style = { ...findStyle(styleId), ...styleSet(styleId, setIndex) }
  const { demo } = findGroove(styleId, grooveId, diceSeed)
  const bars = Math.max(1, melody.bars)
  const roots = barRoots(melody.notes, bars)

  // Bars the melody leaves empty keep the previous harmony rather than dropping out.
  const filled: number[] = []
  let last =
    roots.find((r) => r !== null) ??
    (melody.notes.length
      ? Math.round(melody.notes.reduce((s, n) => s + n.pitch, 0) / melody.notes.length)
      : 60)
  for (let bar = 0; bar < bars; bar++) {
    if (roots[bar] !== null) last = roots[bar] as number
    filled.push(last)
  }

  const third = isMinor(scaleId) ? 3 : 4
  const bassNotes: Note[] = []
  const chordNotes: Note[] = []
  const drumNotes: Note[] = []

  for (let bar = 0; bar < bars; bar++) {
    const patternBar = bar % demo.bars
    const from = patternBar * 4
    const to = from + 4
    const shift = (bar - patternBar) * 4
    const root = filled[bar]

    const bassRef = reference(demo.bass, from, to)
    for (const note of demo.bass) {
      if (note.at < from || note.at >= to) continue
      const interval = bassRef === null ? 0 : note.step - bassRef
      bassNotes.push({
        id: uid('n'),
        start: note.at + shift,
        duration: note.len,
        pitch: root - 12 + interval,
        velocity: note.vel ?? 0.9,
      })
    }

    const chordRef = reference(demo.chords, from, to)
    for (const note of demo.chords) {
      if (note.at < from || note.at >= to) continue
      const interval = chordRef === null ? 0 : note.step - chordRef
      // Snap the pattern's own thirds to the key the melody is in.
      const snapped = interval % 12 === 4 || interval % 12 === 3 ? interval - (interval % 12) + third : interval
      chordNotes.push({
        id: uid('n'),
        start: note.at + shift,
        duration: note.len,
        pitch: root + snapped,
        velocity: note.vel ?? 0.55,
      })
    }

    for (const hit of demo.drums) {
      if (hit.at < from || hit.at >= to) continue
      drumNotes.push({
        id: uid('n'),
        start: hit.at + shift,
        duration: 0.25,
        pitch: 36,
        velocity: hit.vel ?? 0.9,
        drum: hit.voice,
      })
    }
  }

  const make = (
    name: string,
    instrument: string,
    notes: Note[],
    kind: Loop['kind'],
    index: number,
    volume: number,
  ): Loop => ({
    id: uid('loop'),
    name,
    bars,
    kind,
    instrument,
    notes,
    color: LOOP_COLORS[(colourOffset + index) % LOOP_COLORS.length],
    muted: false,
    solo: false,
    volume,
    transpose: 0,
  })

  const loops: Loop[] = []
  const seed = setIndex * 31 + bars
  if (bassNotes.length) {
    const notes = fitPartToInstrument(humanize(dedupeNotes(bassNotes), styleId, 'bass', seed), style.bass)
    loops.push(make('Bass', style.bass, notes, 'melodic', 0, LEVELS.bass))
  }
  if (chordNotes.length) {
    const notes = fitPartToInstrument(
      humanize(dedupeNotes(chordNotes), styleId, 'chords', seed + 1),
      style.chords,
    )
    loops.push(make('Akkorde', style.chords, notes, 'melodic', 1, LEVELS.chords))
  }
  if (drumNotes.length) {
    loops.push(
      make('Schlagzeug', 'drums', humanize(dedupeNotes(drumNotes), styleId, 'drums', seed + 2), 'drum', 2, LEVELS.drums),
    )
  }
  return loops
}
