import { detectOnsets } from './onset'
import type { Onset } from '../types'

export interface TempoEstimate {
  bpm: number
  /** Seconds from the start of the buffer to the first downbeat */
  offset: number
  /** 0..1 — how strongly the onsets line up with this grid */
  confidence: number
  onsets: Onset[]
}

const ENVELOPE_RATE = 100

/** Onset strengths rendered as a continuous envelope we can autocorrelate. */
function onsetEnvelope(onsets: Onset[], duration: number): Float32Array {
  const length = Math.max(1, Math.ceil(duration * ENVELOPE_RATE))
  const env = new Float32Array(length)
  for (const o of onsets) {
    const idx = Math.round(o.time * ENVELOPE_RATE)
    if (idx < 0 || idx >= length) continue
    // a short triangular blob so near-misses still correlate
    for (let k = -2; k <= 2; k++) {
      const j = idx + k
      if (j >= 0 && j < length) env[j] += o.strength * (1 - Math.abs(k) / 3)
    }
  }
  return env
}

function autocorrelate(env: Float32Array, lag: number): number {
  let sum = 0
  let count = 0
  for (let i = 0; i + lag < env.length; i++) {
    sum += env[i] * env[i + lag]
    count++
  }
  return count > 0 ? sum / count : 0
}

/**
 * Estimate tempo and downbeat from a recording.
 * Used to lock the project grid to whatever the first take was actually feeling.
 */
export function detectTempo(
  buffer: AudioBuffer,
  minBpm = 60,
  maxBpm = 190,
): TempoEstimate {
  const onsets = detectOnsets(buffer, { sensitivity: 1.25 })
  const fallback: TempoEstimate = { bpm: 100, offset: 0, confidence: 0, onsets }
  if (onsets.length < 4) return fallback

  const env = onsetEnvelope(onsets, buffer.duration)
  const minLag = Math.floor((60 / maxBpm) * ENVELOPE_RATE)
  const maxLag = Math.ceil((60 / minBpm) * ENVELOPE_RATE)

  let bestLag = minLag
  let bestScore = -1
  const scores: number[] = []
  for (let lag = minLag; lag <= maxLag && lag < env.length; lag++) {
    // Sum the lag and its first two multiples: a real beat period repeats,
    // a coincidence usually does not.
    const score =
      autocorrelate(env, lag) +
      0.6 * autocorrelate(env, lag * 2) +
      0.35 * autocorrelate(env, lag * 3)
    scores[lag] = score
    if (score > bestScore) {
      bestScore = score
      bestLag = lag
    }
  }
  if (bestScore <= 0) return fallback

  let bpm = (60 * ENVELOPE_RATE) / bestLag

  // Prefer a tempo people would actually count in: fold octaves into 70..160.
  while (bpm < 70) bpm *= 2
  while (bpm > 160) bpm /= 2

  const beatLag = (60 / bpm) * ENVELOPE_RATE

  // Phase: slide a pulse train across the envelope and keep the best alignment.
  let bestOffset = 0
  let bestPhase = -1
  for (let shift = 0; shift < beatLag; shift += 0.5) {
    let sum = 0
    for (let b = 0; ; b++) {
      const idx = Math.round(shift + b * beatLag)
      if (idx >= env.length) break
      sum += env[idx]
    }
    if (sum > bestPhase) {
      bestPhase = sum
      bestOffset = shift
    }
  }

  // Confidence: how much of the onset energy actually sits on the grid.
  const total = env.reduce((s, v) => s + v, 0) || 1
  const onGrid = (() => {
    let sum = 0
    for (let b = 0; ; b++) {
      const idx = Math.round(bestOffset + b * beatLag)
      if (idx >= env.length) break
      for (let k = -2; k <= 2; k++) {
        const j = idx + k
        if (j >= 0 && j < env.length) sum += env[j]
      }
    }
    return sum
  })()

  return {
    bpm: Math.round(bpm * 10) / 10,
    offset: bestOffset / ENVELOPE_RATE,
    confidence: Math.min(1, onGrid / total),
    onsets,
  }
}

/** Round to a tempo a human would type in, when the estimate is close enough. */
export function tidyBpm(bpm: number): number {
  const nearest = Math.round(bpm)
  return Math.abs(bpm - nearest) < 0.35 ? nearest : Math.round(bpm * 2) / 2
}
