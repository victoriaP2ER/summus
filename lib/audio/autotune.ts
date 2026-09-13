import { beatsToSeconds } from '../music'
import type { VocalSlice } from '../types'

export interface CorrectionOptions {
  bpm: number
  /** 0 = leave the pitch alone, 1 = fully on the target note */
  strength: number
  /** 0 = original timing, 1 = snapped to the grid */
  timeFix: number
  /** Grain length in seconds — shorter tracks transients, longer sounds smoother */
  grainSize?: number
}

const OVERLAP = 4

function hann(size: number): Float32Array {
  const w = new Float32Array(size)
  for (let i = 0; i < size; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size)
  return w
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Linear interpolation read — the read head sits between samples once pitch shifts. */
function sampleAt(data: Float32Array, pos: number, from: number, to: number): number {
  if (pos < from || pos >= to - 1) return 0
  const i = Math.floor(pos)
  const frac = pos - i
  return data[i] * (1 - frac) + data[i + 1] * frac
}

/**
 * Re-pitches and re-times a vocal take slice by slice using overlap-add granular
 * synthesis. Each slice is placed at its quantised position, stretched to fill it,
 * and transposed towards its target note.
 *
 * This is granular, not PSOLA — on big shifts it takes on a slight chorus-y
 * character rather than staying perfectly transparent.
 */
export function renderCorrectedVocal(
  ctx: BaseAudioContext,
  source: AudioBuffer,
  slices: VocalSlice[],
  options: CorrectionOptions,
): AudioBuffer {
  const { bpm, strength, timeFix, grainSize = 0.055 } = options
  const sr = source.sampleRate
  const active = slices.filter((s) => s.enabled)

  const placements = active.map((slice) => {
    const targetStart = beatsToSeconds(slice.start, bpm)
    const targetDur = beatsToSeconds(slice.duration, bpm)
    return {
      slice,
      outStart: Math.max(0, lerp(slice.offset, targetStart, timeFix)),
      outDur: Math.max(0.02, lerp(slice.length, targetDur, timeFix)),
    }
  })

  const totalSeconds = placements.reduce((m, p) => Math.max(m, p.outStart + p.outDur), 0) + 0.25
  const length = Math.max(1, Math.ceil(totalSeconds * sr))
  const out = ctx.createBuffer(1, length, sr)
  const dst = out.getChannelData(0)

  const channels: Float32Array[] = []
  for (let c = 0; c < source.numberOfChannels; c++) channels.push(source.getChannelData(c))
  const src =
    channels.length === 1
      ? channels[0]
      : (() => {
          const mix = new Float32Array(source.length)
          for (const ch of channels) for (let i = 0; i < mix.length; i++) mix[i] += ch[i] / channels.length
          return mix
        })()

  const G = Math.max(256, Math.round(grainSize * sr))
  const window = hann(G)
  const Hs = Math.round(G / OVERLAP)

  for (const { slice, outStart, outDur } of placements) {
    const semitones = (slice.targetPitch - slice.sourcePitch) * strength
    const pitchRatio = Math.pow(2, semitones / 12)
    const inFrom = Math.max(0, Math.round(slice.offset * sr))
    const inTo = Math.min(src.length, Math.round((slice.offset + slice.length) * sr))
    if (inTo - inFrom < 64) continue

    // How fast the read head walks through the source per second of output.
    const speed = slice.length / outDur
    const outFrom = Math.round(outStart * sr)
    const outLen = Math.round(outDur * sr)

    // A short fade keeps slice boundaries from clicking.
    const fade = Math.min(Math.round(sr * 0.006), Math.floor(outLen / 2))

    for (let n = 0; n * Hs < outLen; n++) {
      const grainOut = outFrom + n * Hs
      const readStart = inFrom + n * Hs * speed
      for (let j = 0; j < G; j++) {
        const o = grainOut + j
        if (o < 0 || o >= length) continue
        const value = sampleAt(src, readStart + j * pitchRatio, inFrom, inTo)
        if (value === 0) continue
        dst[o] += value * window[j]
      }
    }

    // Hann at 75% overlap sums to a constant 2 — undo that, and fade the edges.
    for (let i = 0; i < outLen; i++) {
      const o = outFrom + i
      if (o < 0 || o >= length) continue
      let gain = 0.5
      if (i < fade) gain *= i / fade
      else if (i > outLen - fade) gain *= Math.max(0, (outLen - i) / fade)
      dst[o] *= gain
    }
  }

  // Guard against overlapping slices summing past full scale.
  let peak = 0
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(dst[i]))
  if (peak > 0.99) {
    const g = 0.99 / peak
    for (let i = 0; i < length; i++) dst[i] *= g
  }

  return out
}

/** Slices a detected-note list into vocal slices ready for correction. */
export function buildSlices(
  notes: { id: string; startTime: number; endTime: number; pitch: number; velocity: number }[],
  quantised: { start: number; duration: number; pitch: number }[],
): VocalSlice[] {
  return notes.map((note, i) => ({
    id: note.id,
    offset: note.startTime,
    length: Math.max(0.03, note.endTime - note.startTime),
    start: quantised[i]?.start ?? 0,
    duration: quantised[i]?.duration ?? 1,
    sourcePitch: note.pitch,
    targetPitch: quantised[i]?.pitch ?? Math.round(note.pitch),
    velocity: note.velocity,
    enabled: true,
  }))
}
