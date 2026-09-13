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

/** Rhythm vocabularies. A genre is as much its phrasing as its instruments. */
const CELL_SETS = {
  // Long, arching lines — orchestral and ambient writing.
  broad: [[4], [3, 1], [2, 2], [2, 1, 1], [1, 3]],
  // Even, song-like phrasing.
  song: [[1, 1, 2], [2, 2], [1, 1, 1, 1], [1.5, 0.5, 2], [2, 1, 1]],
  // Straight eighths, repeated notes — rock and punk.
  driving: [[0.5, 0.5, 1, 2], [0.5, 0.5, 0.5, 0.5, 2], [1, 0.5, 0.5, 2], [0.5, 0.5, 3]],
  // Anticipations and ties, the off-beat feel of swing and latin music.
  syncopated: [[0.5, 1, 0.5, 2], [1.5, 0.5, 1, 1], [0.5, 1.5, 2], [0.75, 0.75, 0.5, 2], [1, 1.5, 1.5]],
  // Sparse, late, plenty of air — lo-fi, trap, ambient leads.
  sparse: [[4], [2, 2], [1, 3], [3, 1], [2, 1, 1]],
  // Fast runs — chiptune and dance arpeggios.
  busy: [[0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 1], [0.25, 0.25, 0.5, 1, 2], [0.5, 0.5, 0.5, 0.5, 2], [0.25, 0.25, 0.25, 0.25, 1, 2]],
} as const

export interface MelodyRules {
  cells: readonly (readonly number[])[]
  /** Push off-beats late, the lilt of swing */
  swing: number
  /** How often the line leaps instead of stepping */
  leap: number
  /** Chance of approaching a chord tone from a semitone away */
  chromatic: number
  rest: number
  register: number
  density: number
  /** Stay on the five-note scale — folk and pentatonic traditions */
  pentatonic: boolean
  /** Run up or down the chord rather than the scale */
  arpeggio: number
  /** Chance of simply saying the same note again — very common in sung music */
  repeat: number
  /** Chance of restating an earlier bar's shape instead of inventing a new one */
  motif: number
}

const DEFAULT_RULES: MelodyRules = {
  cells: CELL_SETS.song,
  swing: 0,
  leap: 0.18,
  chromatic: 0,
  rest: 0.12,
  register: 12,
  density: 0.5,
  pentatonic: false,
  arpeggio: 0.1,
  repeat: 0.14,
  motif: 0.45,
}

/** How each genre actually phrases a tune. */
const BY_STYLE: Record<string, Partial<MelodyRules>> = {
  jazz: { cells: CELL_SETS.syncopated, swing: 0.16, leap: 0.3, chromatic: 0.3, rest: 0.2, register: 14, density: 0.7, repeat: 0.06, motif: 0.3 },
  bossa: { cells: CELL_SETS.syncopated, swing: 0.06, leap: 0.24, chromatic: 0.16, rest: 0.22, register: 12, density: 0.5 },
  lofi: { cells: CELL_SETS.sparse, swing: 0.1, leap: 0.1, chromatic: 0.1, rest: 0.28, register: 12, density: 0.32, repeat: 0.2, motif: 0.6 },
  trap: { cells: CELL_SETS.sparse, leap: 0.12, rest: 0.3, register: 19, density: 0.28, repeat: 0.3, motif: 0.75 },
  ambient: { cells: CELL_SETS.broad, leap: 0.12, rest: 0.3, register: 14, density: 0.2 },
  orchestra: { cells: CELL_SETS.broad, leap: 0.26, rest: 0.1, register: 14, density: 0.42, arpeggio: 0.2 },
  cinematic: { cells: CELL_SETS.broad, leap: 0.22, rest: 0.12, register: 12, density: 0.36 },
  jrpg: { cells: CELL_SETS.song, leap: 0.28, rest: 0.1, register: 14, density: 0.55, arpeggio: 0.18 },
  musicbox: { cells: CELL_SETS.song, leap: 0.2, rest: 0.1, register: 19, density: 0.55, arpeggio: 0.3 },
  folk: { cells: CELL_SETS.song, leap: 0.1, rest: 0.12, register: 12, density: 0.5, pentatonic: true, repeat: 0.2, motif: 0.7 },
  reggae: { cells: CELL_SETS.syncopated, leap: 0.1, rest: 0.26, register: 12, density: 0.38, pentatonic: true, repeat: 0.24, motif: 0.7 },
  punk: { cells: CELL_SETS.driving, leap: 0.04, rest: 0.06, register: 12, density: 0.75, repeat: 0.38, motif: 0.75, arpeggio: 0.04 },
  classicRock: { cells: CELL_SETS.driving, leap: 0.12, rest: 0.1, register: 12, density: 0.6, pentatonic: true, repeat: 0.26, motif: 0.65 },
  disco: { cells: CELL_SETS.driving, leap: 0.16, rest: 0.12, register: 14, density: 0.62, repeat: 0.22, motif: 0.6 },
  synthwave: { cells: CELL_SETS.driving, leap: 0.26, rest: 0.1, register: 14, density: 0.6, arpeggio: 0.2 },
  frenchHouse: { cells: CELL_SETS.busy, leap: 0.22, rest: 0.14, register: 14, density: 0.65, arpeggio: 0.3 },
  gridrunner: { cells: CELL_SETS.busy, leap: 0.3, rest: 0.08, register: 14, density: 0.8, arpeggio: 0.4 },
  dnb: { cells: CELL_SETS.sparse, leap: 0.26, rest: 0.24, register: 14, density: 0.35 },
  chiptune: { cells: CELL_SETS.busy, leap: 0.36, rest: 0.05, register: 19, density: 0.85, arpeggio: 0.45 },
}

export function melodyRules(styleId: string): MelodyRules {
  return { ...DEFAULT_RULES, ...(BY_STYLE[styleId] ?? {}) }
}

/** Degrees of the five-note scale, for the traditions that stay on it. */
function pentatonicOf(scale: number[]): number[] {
  const wanted = scale.length >= 7 ? [0, 1, 2, 4, 5] : scale.map((_, i) => i)
  return wanted.filter((i) => i < scale.length)
}

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

/** Two-note power chords leave a melody with nothing between root and fifth. */
function widenChord(chord: number[], scale: number[]): number[] {
  if (chord.length >= 3) return chord
  const root = Math.min(...chord)
  const third = scale.find((s) => s === 3 || s === 4) ?? 4
  return [...new Set([...chord, root + third])].sort((a, b) => a - b)
}

export interface MelodyOptions {
  bars: number
  scaleId: string
  /** Which genre's phrasing to write in */
  styleId?: string
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
  const { bars, scaleId, styleId } = options
  const rules = melodyRules(styleId ?? '')
  const random = rng(seed * 2654435761 + bars * 97)
  const scale = getScale(scaleId).steps
  const chords = barChords(demo)
  const usable = rules.pentatonic ? pentatonicOf(scale) : scale.map((_, i) => i)

  const register = options.register ?? rules.register
  const density = options.density ?? rules.density
  const lift = [0, 5, 7, 12, -5][Math.floor(random() * 5)]
  const centre = register + lift
  const busyness = Math.max(0.12, Math.min(0.95, density + (random() - 0.5) * 0.4))
  const low = centre - 9
  const high = centre + 14

  const pickCell = (): readonly number[] => {
    const cells = rules.cells.filter((c) =>
      busyness > 0.62 ? c.length >= 3 : busyness < 0.33 ? c.length <= 3 : true,
    )
    const source = cells.length ? cells : rules.cells
    return source[Math.floor(random() * source.length)]
  }

  /**
   * The chord tone a singer would actually go to: usually the nearest one, now
   * and then a reach. Picking at random is what makes generated lines leap
   * about — especially over power chords, where the tones are a fifth apart.
   */
  const chordTone = (chord: number[], from: number | null): number => {
    const options = chord.flatMap((step) => [step - 12, step, step + 12])
    if (from === null) return chord[Math.floor(random() * chord.length)]
    const sorted = [...options].sort((a, b) => Math.abs(a - from) - Math.abs(b - from))
    // Mostly the closest, sometimes the next one out — that is the reach.
    const index = random() < 0.72 ? 0 : random() < 0.75 ? 1 : 2
    return sorted[Math.min(index, sorted.length - 1)]
  }

  const degreeToStep = (degree: number): number => {
    const octave = Math.floor(degree / usable.length)
    const within = ((degree % usable.length) + usable.length) % usable.length
    return scale[usable[within]] + octave * 12
  }

  const writeBar = (
    bar: number,
    chord: number[],
    cell: readonly number[],
    degreeIn: number,
    /** Restate this shape, measured in semitones from its own first note */
    shape: number[] | null,
  ) => {
    const notes: DemoNote[] = []
    let degree = degreeIn
    let at = bar * 4
    let anchor: number | null = null

    for (let i = 0; i < cell.length; i++) {
      const len = cell[i]
      const strong = i === 0 || at % 2 < 0.01

      if (!strong && random() < rules.rest) {
        at += len
        continue
      }

      let step: number
      if (shape && i < shape.length) {
        // Restating a phrase a step or a third away is how tunes are built.
        if (anchor === null) anchor = chord[Math.floor(random() * chord.length)]
        step = anchor + shape[i]
      } else if (!strong && notes.length && random() < rules.repeat) {
        // Saying the same note again — the backbone of sung melody.
        step = notes[notes.length - 1].step
      } else if (strong) {
        step = chordTone(chord, notes.length ? notes[notes.length - 1].step : null)
        const pc = ((step % 12) + 12) % 12
        let best = 0
        for (let d = 0; d < usable.length; d++) {
          if (Math.abs(scale[usable[d]] - pc) < Math.abs(scale[usable[best]] - pc)) best = d
        }
        degree = best
      } else if (random() < rules.arpeggio) {
        // Run through the chord rather than the scale — arpeggio phrasing.
        step = chordTone(chord, notes.length ? notes[notes.length - 1].step : null)
      } else if (random() < rules.chromatic) {
        // Approach the next chord tone from a semitone away, as jazz lines do.
        const target = chordTone(chord, notes.length ? notes[notes.length - 1].step : null)
        step = target + (random() < 0.5 ? -1 : 1)
      } else {
        const roll = random()
        const move =
          roll < 1 - rules.leap
            ? random() < 0.5
              ? 1
              : -1
            : roll < 1 - rules.leap * 0.3
              ? random() < 0.5
                ? 2
                : -2
              : random() < 0.5
                ? 4
                : -4
        degree += move
        step = degreeToStep(degree)
      }

      while (step < low) step += 12
      while (step > high) step -= 12

      const swung = !strong && rules.swing > 0 && Math.abs((at % 1) - 0.5) < 0.02 ? rules.swing : 0
      notes.push({
        step,
        at: at + swung,
        len: Math.max(0.35, len * 0.92),
        vel: strong ? 0.82 : 0.64,
      })
      at += len
    }
    return { notes, degree }
  }

  const notes: DemoNote[] = []
  const cells: (readonly number[])[] = []
  const shapes: number[][] = []
  let degree = 0

  for (let bar = 0; bar < bars; bar++) {
    const chord = widenChord(chords[bar % chords.length], scale)
    // Restate an earlier bar now and then — both its rhythm and its shape — so
    // the line is built from an idea instead of wandering. That is most of what
    // separates a melody from a sequence of notes.
    const back = bar >= 2 ? 2 : bar >= 1 ? 1 : 0
    const echo = back > 0 && random() < rules.motif
    const cell = echo ? cells[bar - back] : pickCell()
    const shape = echo ? shapes[bar - back] : null

    cells.push(cell)
    const written = writeBar(bar, chord, cell, degree, shape)
    degree = written.degree
    notes.push(...written.notes)

    const bars0 = written.notes
    shapes.push(bars0.length ? bars0.map((n) => n.step - bars0[0].step) : [])
  }

  return notes
}
