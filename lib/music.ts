import type { ScaleDef } from './types'

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const SCALES: ScaleDef[] = [
  { id: 'chromatic', name: 'Chromatisch', steps: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { id: 'major', name: 'Dur', steps: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'minor', name: 'Moll (natürlich)', steps: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'harmonicMinor', name: 'Moll (harmonisch)', steps: [0, 2, 3, 5, 7, 8, 11] },
  { id: 'dorian', name: 'Dorisch', steps: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'mixolydian', name: 'Mixolydisch', steps: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'pentaMajor', name: 'Pentatonik Dur', steps: [0, 2, 4, 7, 9] },
  { id: 'pentaMinor', name: 'Pentatonik Moll', steps: [0, 3, 5, 7, 10] },
  { id: 'blues', name: 'Blues', steps: [0, 3, 5, 6, 7, 10] },
]

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440)
}

export function midiToName(midi: number): string {
  const m = Math.round(midi)
  const name = NOTE_NAMES[((m % 12) + 12) % 12]
  const octave = Math.floor(m / 12) - 1
  return `${name}${octave}`
}

/** Tone.js wants note names like "C#4" */
export function midiToToneNote(midi: number): string {
  return midiToName(midi)
}

export function getScale(scaleId: string): ScaleDef {
  return SCALES.find((s) => s.id === scaleId) ?? SCALES[0]
}

/**
 * Snap a (possibly fractional) MIDI pitch to the nearest note of the given scale.
 * `amount` blends between the original pitch (0) and the snapped pitch (1).
 */
export function snapToScale(midi: number, rootPc: number, scaleId: string, amount = 1): number {
  const scale = getScale(scaleId)
  if (scale.steps.length === 12) {
    return midi + (Math.round(midi) - midi) * amount
  }
  const octave = Math.floor((midi - rootPc) / 12)
  let best = midi
  let bestDist = Infinity
  for (let o = octave - 1; o <= octave + 1; o++) {
    for (const step of scale.steps) {
      const candidate = rootPc + o * 12 + step
      const dist = Math.abs(candidate - midi)
      if (dist < bestDist) {
        bestDist = dist
        best = candidate
      }
    }
  }
  return midi + (best - midi) * amount
}

export function isInScale(midi: number, rootPc: number, scaleId: string): boolean {
  const scale = getScale(scaleId)
  const pc = (((Math.round(midi) - rootPc) % 12) + 12) % 12
  return scale.steps.includes(pc)
}

export function quantize(value: number, grid: number): number {
  if (grid <= 0) return value
  return Math.round(value / grid) * grid
}

/** Blend a value towards its quantised position. */
export function softQuantize(value: number, grid: number, amount: number): number {
  const q = quantize(value, grid)
  return value + (q - value) * amount
}

export function beatsToSeconds(beats: number, bpm: number): number {
  return (beats * 60) / bpm
}

export function secondsToBeats(seconds: number, bpm: number): number {
  return (seconds * bpm) / 60
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export const GRID_OPTIONS = [
  { id: '1', label: '1/1', beats: 4 },
  { id: '2', label: '1/2', beats: 2 },
  { id: '4', label: '1/4', beats: 1 },
  { id: '8', label: '1/8', beats: 0.5 },
  { id: '8t', label: '1/8T', beats: 1 / 3 },
  { id: '16', label: '1/16', beats: 0.25 },
  { id: '16t', label: '1/16T', beats: 1 / 6 },
  { id: '32', label: '1/32', beats: 0.125 },
  { id: 'off', label: 'aus', beats: 0 },
]

export const LOOP_COLORS = [
  '#f472b6',
  '#a78bfa',
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#fb7185',
  '#22d3ee',
  '#c084fc',
  '#4ade80',
  '#f97316',
]

/**
 * Two notes of the same pitch starting at the same instant are not a chord —
 * they are a duplicate, and a synth voice cannot be attacked twice at one time.
 */
export function dedupeNotes<T extends { start: number; pitch: number; drum?: string }>(
  notes: T[],
): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const note of [...notes].sort((a, b) => a.start - b.start)) {
    const key = `${note.drum ?? Math.round(note.pitch)}@${note.start.toFixed(4)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(note)
  }
  return out
}

let idCounter = 0
export function uid(prefix = 'id'): string {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`
}
