import { analyzePitchTrack, segmentNotes, type DetectedNote } from './analyze'
import { detectTempo, tidyBpm, type TempoEstimate } from './tempo'
import { detectedToNotes, takeToDrumNotes } from './convert'
import { instrumentMeta } from './instruments'
import { LOOP_COLORS, uid, secondsToBeats } from '../music'
import type { Clip, InstrumentId, Loop, Note } from '../types'

export type SplitMode = 'arrange' | 'register' | 'phrase' | 'section'

export interface SplitOptions {
  bpm: number
  offset: number
  grid: number
  mode: SplitMode
  /** Length of each generated loop when splitting by section */
  barsPerSection: number
  snapScale: boolean
  scaleRoot: number
  scaleId: string
  /** Also pull a drum part out of the percussive hits */
  includeDrums: boolean
  /** Instruments to hand the melodic voices, low to high */
  palette: InstrumentId[]
}

export const DEFAULT_PALETTE: InstrumentId[] = ['bass', 'epiano', 'violin', 'synthLead']

export const SPLIT_MODES: { id: SplitMode; label: string; hint: string }[] = [
  { id: 'arrange', label: 'Arrangement', hint: 'Lead, Bass, Fläche und Drums aus einer Aufnahme' },
  { id: 'phrase', label: 'Phrasen', hint: 'Jede Phrase zwischen zwei Atempausen wird ein Loop' },
  { id: 'section', label: 'Abschnitte', hint: 'Alle paar Takte ein neuer Loop' },
  { id: 'register', label: 'Tonlage', hint: 'Tiefe und hohe Töne auf getrennte Instrumente' },
]

/**
 * The note that carries each bar — longest total sounding time wins, which
 * tracks what the ear hears as the bar's root far better than the first note.
 */
function barRoots(notes: Note[], bars: number): (number | null)[] {
  const roots: (number | null)[] = []
  for (let bar = 0; bar < bars; bar++) {
    const from = bar * 4
    const to = from + 4
    const weight = new Map<number, number>()
    for (const n of notes) {
      const overlap = Math.min(n.start + n.duration, to) - Math.max(n.start, from)
      if (overlap <= 0) continue
      weight.set(n.pitch, (weight.get(n.pitch) ?? 0) + overlap)
    }
    if (!weight.size) {
      roots.push(null)
      continue
    }
    let best = 0
    let bestWeight = -1
    for (const [pitch, w] of weight) {
      if (w > bestWeight) {
        bestWeight = w
        best = pitch
      }
    }
    roots.push(best)
  }
  return roots
}

/** One sustained note per bar, built from that bar's root. */
function partFromRoots(roots: (number | null)[], beatsPerNote: number, velocity: number): Note[] {
  const out: Note[] = []
  let last: number | null = null
  for (let bar = 0; bar < roots.length; bar++) {
    const root: number | null = roots[bar] ?? last
    if (root === null) continue
    last = root
    const steps = Math.max(1, Math.round(4 / beatsPerNote))
    for (let s = 0; s < steps; s++) {
      out.push({
        id: uid('n'),
        start: bar * 4 + s * beatsPerNote,
        duration: beatsPerNote * 0.92,
        pitch: root,
        velocity,
      })
    }
  }
  return out
}

export interface SplitResult {
  loops: Loop[]
  clips: Clip[]
  bars: number
  tempo: TempoEstimate
  noteCount: number
}

function makeLoop(
  name: string,
  instrument: InstrumentId,
  notes: Note[],
  bars: number,
  colorIndex: number,
  kind: Loop['kind'] = 'melodic',
): Loop {
  return {
    id: uid('loop'),
    name,
    bars: Math.max(1, bars),
    kind,
    instrument,
    notes,
    color: LOOP_COLORS[colorIndex % LOOP_COLORS.length],
    muted: false,
    solo: false,
    volume: 0,
    transpose: 0,
  }
}

/** Shift a whole voice by octaves until it sits inside the instrument's range. */
function fitToInstrument(notes: Note[], instrument: InstrumentId): Note[] {
  if (!notes.length) return notes
  const meta = instrumentMeta(instrument)
  const centre = (meta.low + meta.high) / 2
  const median = [...notes.map((n) => n.pitch)].sort((a, b) => a - b)[Math.floor(notes.length / 2)]
  const octaves = Math.round((centre - median) / 12)
  if (octaves === 0) return notes
  return notes.map((n) => ({ ...n, pitch: n.pitch + octaves * 12 }))
}

/** Split the pitch range into bands so each voice gets its own instrument. */
function splitByRegister(notes: Note[], voices: number): Note[][] {
  if (notes.length < voices * 2) return [notes]
  const sorted = [...notes].sort((a, b) => a.pitch - b.pitch)
  const bands: Note[][] = []
  const per = Math.ceil(sorted.length / voices)
  const edges: number[] = []
  for (let i = 1; i < voices; i++) {
    edges.push(sorted[Math.min(sorted.length - 1, i * per)].pitch)
  }
  for (let v = 0; v < voices; v++) {
    const low = v === 0 ? -Infinity : edges[v - 1]
    const high = v === voices - 1 ? Infinity : edges[v]
    const band = notes.filter((n) => n.pitch >= low && n.pitch < high)
    if (band.length) bands.push(band)
  }
  return bands.length ? bands : [notes]
}

/** Group notes into phrases, breaking wherever there is a real breath. */
function splitByPhrase(detected: DetectedNote[], gapSeconds: number): DetectedNote[][] {
  const phrases: DetectedNote[][] = []
  let current: DetectedNote[] = []
  for (const note of detected) {
    if (current.length && note.startTime - current[current.length - 1].endTime > gapSeconds) {
      phrases.push(current)
      current = []
    }
    current.push(note)
  }
  if (current.length) phrases.push(current)
  return phrases
}

/**
 * Turn one continuous take — a whole sung song sketch — into a set of loops
 * spread over different instruments, plus a drum part from the percussive hits.
 */
export function splitTake(buffer: AudioBuffer, options: SplitOptions): SplitResult {
  const { bpm, offset, grid, mode, barsPerSection, snapScale, scaleRoot, scaleId, includeDrums, palette } =
    options

  const tempo = detectTempo(buffer)
  const frames = analyzePitchTrack(buffer)
  const detected = segmentNotes(frames)

  const convertOptions = {
    bpm,
    offset,
    grid,
    snapScale,
    scaleRoot,
    scaleId,
  }

  const allNotes = detectedToNotes(detected, convertOptions)
  const totalBeats = secondsToBeats(buffer.duration - offset, bpm)
  const totalBars = Math.max(1, Math.ceil(totalBeats / 4))

  const loops: Loop[] = []
  const clips: Clip[] = []
  let track = 0
  let color = 0

  const addLoop = (loop: Loop, startBar: number) => {
    loops.push(loop)
    clips.push({ id: uid('clip'), loopId: loop.id, startBar, repeats: 1, track: track++ })
  }

  if (mode === 'arrange') {
    // One take, a whole band: the melody stays the melody, and the bass and pad
    // are derived from the harmony it implies rather than sliced out of it.
    const lead = palette[2] ?? 'violin'
    const bassInstrument = palette[0] ?? 'bass'
    const padInstrument = palette[1] ?? 'synthPad'

    addLoop(makeLoop('Lead', lead, fitToInstrument(allNotes, lead), totalBars, color++), 0)

    const roots = barRoots(allNotes, totalBars)
    if (roots.some((r) => r !== null)) {
      const bassNotes = fitToInstrument(partFromRoots(roots, 2, 0.85), bassInstrument)
      addLoop(makeLoop('Bass', bassInstrument, bassNotes, totalBars, color++), 0)

      const padNotes = fitToInstrument(partFromRoots(roots, 4, 0.5), padInstrument)
      addLoop(makeLoop('Fläche', padInstrument, padNotes, totalBars, color++), 0)
    }
  } else if (mode === 'register') {
    const pitches = allNotes.map((n) => n.pitch)
    const span = pitches.length ? Math.max(...pitches) - Math.min(...pitches) : 0
    // Splitting a one-octave hum into four bands produces nonsense, so only
    // split as far as the take's actual range supports.
    const voices = span < 7 ? 1 : Math.min(palette.length, Math.max(2, Math.floor(span / 7)))
    const bands = splitByRegister(allNotes, voices)
    const names = ['Tief', 'Mitte', 'Hoch', 'Höhen']
    bands.forEach((band, i) => {
      const instrument = palette[Math.min(i, palette.length - 1)]
      addLoop(
        makeLoop(names[i] ?? `Stimme ${i + 1}`, instrument, fitToInstrument(band, instrument), totalBars, color++),
        0,
      )
    })
  } else if (mode === 'phrase') {
    const phrases = splitByPhrase(detected, 0.42)
    phrases.forEach((phrase, i) => {
      const instrument = palette[i % palette.length]
      const phraseStartBeats = secondsToBeats(phrase[0].startTime - offset, bpm)
      const startBar = Math.max(0, Math.floor(phraseStartBeats / 4))
      const notes = detectedToNotes(phrase, convertOptions).map((n) => ({
        ...n,
        start: Math.max(0, n.start - startBar * 4),
      }))
      const lengthBars = Math.max(
        1,
        Math.ceil((Math.max(...notes.map((n) => n.start + n.duration)) || 4) / 4),
      )
      addLoop(
        makeLoop(`Phrase ${i + 1}`, instrument, fitToInstrument(notes, instrument), lengthBars, color++),
        startBar,
      )
    })
  } else {
    const sections = Math.max(1, Math.ceil(totalBars / barsPerSection))
    for (let s = 0; s < sections; s++) {
      const fromBeat = s * barsPerSection * 4
      const toBeat = fromBeat + barsPerSection * 4
      const notes = allNotes
        .filter((n) => n.start >= fromBeat && n.start < toBeat)
        .map((n) => ({ ...n, start: n.start - fromBeat }))
      if (!notes.length) continue
      const instrument = palette[s % palette.length]
      addLoop(
        makeLoop(
          `Teil ${s + 1}`,
          instrument,
          fitToInstrument(notes, instrument),
          barsPerSection,
          color++,
        ),
        s * barsPerSection,
      )
    }
  }

  if (includeDrums) {
    const drumNotes = takeToDrumNotes(buffer, { bpm, offset, grid, simplify: true })
    if (drumNotes.length >= 4) {
      addLoop(makeLoop('Drums', 'drums', drumNotes, totalBars, color++, 'drum'), 0)
    }
  }

  return {
    loops,
    clips,
    bars: totalBars,
    tempo: { ...tempo, bpm: tidyBpm(tempo.bpm) },
    noteCount: allNotes.length,
  }
}
