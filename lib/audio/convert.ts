import { analyzePitchTrack, segmentNotes, type DetectedNote } from './analyze'
import { detectOnsets } from './onset'
import { buildSlices } from './autotune'
import { quantize, secondsToBeats, snapToScale, uid, clamp } from '../music'
import type { DrumVoice, Note, VocalSlice } from '../types'

export interface ConvertOptions {
  bpm: number
  /** Seconds trimmed from the front so the first downbeat lands on beat 0 */
  offset?: number
  /** Quantise grid in beats; 0 disables quantising */
  grid?: number
  /** How hard to pull notes onto the grid, 0..1 */
  quantiseAmount?: number
  /** Snap pitches into the project scale */
  snapScale?: boolean
  scaleRoot?: number
  scaleId?: string
  /** Notes shorter than this many beats get stretched to it */
  minBeats?: number
  /** Extend each note up to the next one instead of leaving gaps */
  legato?: boolean
}

/** Hummed audio → notes on the grid. */
export function takeToNotes(buffer: AudioBuffer, options: ConvertOptions): Note[] {
  const detected = segmentNotes(analyzePitchTrack(buffer))
  return detectedToNotes(detected, options)
}

export function detectedToNotes(detected: DetectedNote[], options: ConvertOptions): Note[] {
  const {
    bpm,
    offset = 0,
    grid = 0.25,
    quantiseAmount = 1,
    snapScale = false,
    scaleRoot = 0,
    scaleId = 'major',
    minBeats = 0.25,
    legato = false,
  } = options

  const notes: Note[] = detected.map((d) => {
    const startBeats = secondsToBeats(d.startTime - offset, bpm)
    const endBeats = secondsToBeats(d.endTime - offset, bpm)

    let start = startBeats
    let end = endBeats
    if (grid > 0) {
      start = startBeats + (quantize(startBeats, grid) - startBeats) * quantiseAmount
      end = endBeats + (quantize(endBeats, grid) - endBeats) * quantiseAmount
    }
    const duration = Math.max(minBeats, end - start)

    const rounded = Math.round(d.pitch)
    const pitch = snapScale ? Math.round(snapToScale(d.pitch, scaleRoot, scaleId, 1)) : rounded

    return {
      id: uid('n'),
      start: Math.max(0, start),
      duration,
      pitch,
      velocity: d.velocity,
      sourcePitch: d.pitch,
    }
  })

  notes.sort((a, b) => a.start - b.start)

  if (legato) {
    for (let i = 0; i < notes.length - 1; i++) {
      notes[i].duration = Math.max(minBeats, notes[i + 1].start - notes[i].start)
    }
  } else {
    // Never let a quantised note run past the start of the next one.
    for (let i = 0; i < notes.length - 1; i++) {
      const room = notes[i + 1].start - notes[i].start
      if (room > 0) notes[i].duration = Math.min(notes[i].duration, room)
    }
  }

  return notes.filter((n) => n.duration > 0.02)
}

export interface DrumConvertOptions extends ConvertOptions {
  sensitivity?: number
  /** Force everything onto a smaller palette — a beat reads better with fewer voices */
  simplify?: boolean
}

/** Beatboxed audio → drum hits on the grid. */
export function takeToDrumNotes(buffer: AudioBuffer, options: DrumConvertOptions): Note[] {
  const {
    bpm,
    offset = 0,
    grid = 0.25,
    quantiseAmount = 1,
    sensitivity = 1.45,
    simplify = false,
  } = options

  const onsets = detectOnsets(buffer, { sensitivity })
  const peak = onsets.reduce((m, o) => Math.max(m, o.strength), 0) || 1

  const simplifyVoice = (v: DrumVoice): DrumVoice => {
    if (!simplify) return v
    if (v === 'tom') return 'kick'
    if (v === 'rim' || v === 'openhat') return 'hat'
    if (v === 'clap') return 'snare'
    return v
  }

  const notes = onsets.map((o) => {
    const beats = secondsToBeats(o.time - offset, bpm)
    const start = grid > 0 ? beats + (quantize(beats, grid) - beats) * quantiseAmount : beats
    return {
      id: uid('d'),
      start: Math.max(0, start),
      duration: Math.max(0.125, grid || 0.25),
      pitch: 36,
      velocity: clamp(0.35 + 0.65 * (o.strength / peak), 0.2, 1),
      drum: simplifyVoice(o.voice),
    } satisfies Note
  })

  // Two hits of the same voice on the same grid slot are one hit.
  const seen = new Set<string>()
  return notes.filter((n) => {
    const key = `${n.drum}@${n.start.toFixed(3)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Sung audio → vocal slices that autotune can re-pitch and re-time. */
export function takeToVocalSlices(buffer: AudioBuffer, options: ConvertOptions): VocalSlice[] {
  const detected = segmentNotes(analyzePitchTrack(buffer))
  const quantised = detectedToNotes(detected, { ...options, legato: false })
  return buildSlices(detected, quantised)
}
