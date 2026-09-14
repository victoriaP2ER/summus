import type { DemoHit, DemoNote, StyleDemo } from './demos'

/**
 * Four bars of harmony per style, as semitone offsets from the tonic.
 *
 * The written grooves carry the rhythm and the voicing; the progression says
 * where the harmony goes. Keeping them apart means every style gets a real
 * four-bar phrase instead of rocking between two chords forever.
 */
export const PROGRESSIONS: Record<string, number[]> = {
  // i – bVI – bIII – bVII, the minor loop most synth music lives on
  synthwave: [0, 8, 3, 10],
  frenchHouse: [0, 8, 3, 10],
  gridrunner: [0, 10, 8, 7],
  dnb: [0, 8, 10, 7],
  trap: [0, 8, 10, 0],
  // I – IV – V – I, three chords and the truth
  punk: [0, 5, 7, 0],
  // I – bVII – IV – I, the rock move
  classicRock: [0, -2, 5, 0],
  // i – bVII – bVI – bVII, the descent behind countless records
  disco: [0, 10, 8, 10],
  reggae: [0, 10, 8, 10],
  lofi: [0, -2, -4, -5],
  // I – V – vi – IV, the one everybody knows
  folk: [0, 7, 9, 5],
  chiptune: [0, 7, 9, 5],
  musicbox: [0, 9, 5, 7],
  // ii – V – I, the cadence jazz and bossa are built from
  bossa: [2, 7, 0, 0],
}

const EPS = 0.01

/** The chord voiced at the start of the demo, measured from its own root. */
function template(notes: DemoNote[]): { shape: number[]; root: number } | null {
  const first = notes.filter((n) => n.at < 4 - EPS)
  if (!first.length) return null
  const start = Math.min(...first.map((n) => n.at))
  const voiced = first.filter((n) => Math.abs(n.at - start) < EPS).map((n) => n.step)
  if (!voiced.length) return null
  const root = Math.min(...voiced)
  return { shape: voiced.map((s) => s - root), root }
}

function shiftHits(hits: DemoHit[], bars: number, offset: number): DemoHit[] {
  return hits.filter((h) => h.at < bars * 4 - EPS).map((h) => ({ ...h, at: h.at + offset }))
}

/**
 * Lay a four-bar progression over a groove's own rhythm.
 *
 * Rhythm, voicing and articulation come from the written demo; only the root
 * of each bar moves. The result keeps the genre's feel and gains a phrase.
 */
export function withProgression(demo: StyleDemo, roots: number[] | undefined): StyleDemo {
  if (!roots?.length || demo.bars >= 4) return demo

  const source = demo.bars
  const repeats = Math.ceil(4 / source)
  const chordTemplate = template(demo.chords)
  const bassRoot = demo.bass.length ? Math.min(...demo.bass.map((n) => n.step)) : 0

  const drums: DemoHit[] = []
  const chords: DemoNote[] = []
  const bass: DemoNote[] = []
  const lead: DemoNote[] = []

  for (let r = 0; r < repeats; r++) {
    const offset = r * source * 4
    drums.push(...shiftHits(demo.drums, source, offset))

    for (const note of demo.chords) {
      if (note.at >= source * 4 - EPS) continue
      const bar = Math.floor((note.at + offset) / 4)
      const root = roots[bar % roots.length]
      // Re-voice on the bar's root, keeping the shape the style wrote.
      const shape = chordTemplate
        ? chordTemplate.shape[demo.chords.indexOf(note) % chordTemplate.shape.length]
        : note.step
      const step = chordTemplate ? root + shape : note.step + root
      chords.push({ ...note, at: note.at + offset, step })
    }

    for (const note of demo.bass) {
      if (note.at >= source * 4 - EPS) continue
      const bar = Math.floor((note.at + offset) / 4)
      const root = roots[bar % roots.length]
      // Keep the line's shape, move its root with the harmony.
      bass.push({ ...note, at: note.at + offset, step: note.step - bassRoot + bassRoot + root })
    }

    for (const note of demo.lead) {
      if (note.at >= source * 4 - EPS) continue
      const bar = Math.floor((note.at + offset) / 4)
      lead.push({ ...note, at: note.at + offset, step: note.step + roots[bar % roots.length] })
    }
  }

  return { bars: source * repeats, drums, chords, bass, lead }
}
