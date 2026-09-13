import { getScale } from '../music'
import type { DemoNote, StyleDemo } from './demos'

/** Small deterministic PRNG — the same seed always gives the same tune. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Rhythms that sound deliberate rather than random, one bar each. */
const CELLS: number[][] = [
  [1, 1, 2],
  [2, 2],
  [0.5, 0.5, 1, 2],
  [1.5, 0.5, 2],
  [1, 0.5, 0.5, 2],
  [0.5, 0.5, 0.5, 0.5, 2],
  [3, 1],
  [4],
  [1, 1, 1, 1],
  [0.75, 0.25, 1, 2],
]

/** The chord the bar sits on, taken from the groove's own harmony. */
function barChords(demo: StyleDemo): number[][] {
  const out: number[][] = []
  for (let bar = 0; bar < demo.bars; bar++) {
    const inBar = demo.chords.filter((n) => n.at >= bar * 4 && n.at < bar * 4 + 4)
    const first = inBar.length ? Math.min(...inBar.map((n) => n.at)) : 0
    const steps = [...new Set(inBar.filter((n) => n.at === first).map((n) => n.step))].sort((a, b) => a - b)
    out.push(steps.length ? steps : [0, 3, 7])
  }
  return out
}

export interface MelodyOptions {
  bars: number
  scaleId: string
  /** Roughly how high the tune sits, in semitones above the tonic */
  register?: number
  /** How busy it is, 0..1 */
  density?: number
}

/**
 * Write a fresh lead line over a groove's own harmony.
 *
 * Notes land on chord tones at the start of each cell and step through the
 * scale in between, so every generated tune fits the style it came from — and
 * a different seed gives a genuinely different melody, not a shuffled one.
 */
export function generateLead(demo: StyleDemo, seed: number, options: MelodyOptions): DemoNote[] {
  const { bars, scaleId, register = 12, density = 0.5 } = options
  const random = rng(seed * 2654435761 + bars * 97)
  const scale = getScale(scaleId).steps
  const chords = barChords(demo)
  const notes: DemoNote[] = []

  // Start somewhere in the chord, near the requested register.
  let degree = 0

  for (let bar = 0; bar < bars; bar++) {
    const chord = chords[bar % chords.length]
    const busy = CELLS.filter((c) => (density > 0.6 ? c.length >= 3 : density < 0.35 ? c.length <= 3 : true))
    const cell = busy[Math.floor(random() * busy.length)] ?? CELLS[0]

    let at = bar * 4
    for (let i = 0; i < cell.length; i++) {
      const len = cell[i]
      const strong = i === 0 || at % 2 < 0.01

      let step: number
      if (strong) {
        // Land on the chord so the bar has a centre.
        step = chord[Math.floor(random() * chord.length)]
        degree = scale.reduce(
          (best, s, index) => (Math.abs(s - (((step % 12) + 12) % 12)) < Math.abs(scale[best] - (((step % 12) + 12) % 12)) ? index : best),
          0,
        )
      } else {
        // Step through the scale, mostly by one degree.
        const move = random() < 0.72 ? (random() < 0.5 ? 1 : -1) : random() < 0.5 ? 2 : -2
        degree += move
        const octave = Math.floor(degree / scale.length)
        const within = ((degree % scale.length) + scale.length) % scale.length
        step = scale[within] + octave * 12
      }

      // Keep the line in a singable band around the target register.
      while (step < register - 7) step += 12
      while (step > register + 12) step -= 12

      notes.push({ step, at, len: Math.max(0.4, len * 0.92), vel: strong ? 0.8 : 0.65 })
      at += len
    }
  }

  return notes
}
