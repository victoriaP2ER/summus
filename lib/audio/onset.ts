import { FFT, hannWindow } from './fft'
import { toMono } from './analyze'
import type { DrumVoice, Onset } from '../types'

const FRAME = 1024
const HOP = 256

interface Spectrum {
  time: number
  sample: number
  mags: Float32Array
  flux: number
}

function buildSpectra(samples: Float32Array, sampleRate: number): Spectrum[] {
  const fft = new FFT(FRAME)
  const win = hannWindow(FRAME)
  const frame = new Float32Array(FRAME)
  const bins = FRAME / 2 + 1
  const out: Spectrum[] = []
  let prev: Float32Array | null = null

  for (let start = 0; start + FRAME <= samples.length; start += HOP) {
    for (let i = 0; i < FRAME; i++) frame[i] = samples[start + i] * win[i]
    const mags = new Float32Array(bins)
    fft.magnitudes(frame, mags)

    let flux = 0
    if (prev) {
      for (let i = 0; i < bins; i++) {
        const d = mags[i] - prev[i]
        if (d > 0) flux += d
      }
    }
    out.push({ time: start / sampleRate, sample: start, mags, flux })
    prev = mags
  }
  return out
}

interface HitFeatures {
  /** Share of the energy below 250 Hz */
  lowRatio: number
  /** Share above 3 kHz */
  highRatio: number
  centroid: number
  /** Envelope 90 ms after the hit relative to the hit itself. >1 means it blooms. */
  decay: number
}

function bandSum(mags: Float32Array, binHz: number, lo: number, hi: number): number {
  const from = Math.max(1, Math.floor(lo / binHz))
  const to = Math.min(mags.length - 1, Math.ceil(hi / binHz))
  let sum = 0
  for (let i = from; i <= to; i++) sum += mags[i]
  return sum
}

function envelopeAt(samples: Float32Array, start: number, length: number): number {
  let sum = 0
  const end = Math.min(samples.length, start + length)
  for (let i = Math.max(0, start); i < end; i++) sum += Math.abs(samples[i])
  return sum
}

/**
 * Average the spectrum over the few frames right after the transient — a single
 * frame lands on the click and tells you very little about the body of the hit.
 */
function features(
  spectra: Spectrum[],
  index: number,
  samples: Float32Array,
  sampleRate: number,
): HitFeatures {
  const binHz = sampleRate / FRAME
  let low = 0
  let mid = 0
  let high = 0
  let centroidNum = 0
  let centroidDen = 0
  let used = 0

  for (let k = 0; k <= 2; k++) {
    const s = spectra[Math.min(index + k, spectra.length - 1)]
    if (!s) continue
    used++
    low += bandSum(s.mags, binHz, 20, 250)
    mid += bandSum(s.mags, binHz, 250, 3000)
    high += bandSum(s.mags, binHz, 3000, 12000)
    for (let i = 1; i < s.mags.length; i++) {
      centroidNum += i * binHz * s.mags[i]
      centroidDen += s.mags[i]
    }
  }
  if (!used) return { lowRatio: 0, highRatio: 0, centroid: 0, decay: 0 }

  const total = low + mid + high || 1
  const start = spectra[index].sample
  const window = Math.round(sampleRate * 0.023)
  const now = envelopeAt(samples, start, window)
  const later = envelopeAt(samples, start + Math.round(sampleRate * 0.09), window)

  return {
    lowRatio: low / total,
    highRatio: high / total,
    centroid: centroidDen > 0 ? centroidNum / centroidDen : 0,
    decay: now > 0 ? later / now : 0,
  }
}

/**
 * Map a beatboxed hit onto a drum voice.
 * Thresholds were fitted against real beatbox takes: a vocal kick is almost all
 * energy under 250 Hz with a low centroid and a body that *blooms* after the
 * transient, while "ts"/"k" consonants decay within a couple of milliseconds.
 */
function classify(f: HitFeatures): DrumVoice {
  if (f.lowRatio > 0.38 && f.centroid < 1150) return f.decay > 0.4 ? 'kick' : 'tom'
  if (f.highRatio > 0.34 || f.centroid > 3800) return f.decay > 0.5 ? 'openhat' : 'hat'
  if (f.highRatio > 0.15 && f.centroid > 1900) return 'snare'
  if (f.centroid > 1250) return 'snare'
  if (f.lowRatio > 0.28) return 'tom'
  return 'rim'
}

export interface OnsetOptions {
  /** Multiplier on the adaptive threshold — higher means fewer hits */
  sensitivity?: number
  /** Minimum time between two hits, in seconds */
  minInterval?: number
}

/** Spectral-flux onset detection with an adaptive median threshold. */
export function detectOnsets(buffer: AudioBuffer, options: OnsetOptions = {}): Onset[] {
  const { sensitivity = 1.45, minInterval = 0.07 } = options
  const samples = toMono(buffer)
  const sampleRate = buffer.sampleRate
  const spectra = buildSpectra(samples, sampleRate)
  if (spectra.length < 4) return []

  const maxFlux = spectra.reduce((m, s) => Math.max(m, s.flux), 0) || 1
  const norm = spectra.map((s) => s.flux / maxFlux)

  const win = 12
  const threshold = norm.map((_, i) => {
    const from = Math.max(0, i - win)
    const to = Math.min(norm.length - 1, i + win)
    const slice = norm.slice(from, to + 1).sort((a, b) => a - b)
    return slice[Math.floor(slice.length / 2)] * sensitivity + 0.035
  })

  // 1. pick every local peak above the adaptive threshold
  const peaks: { index: number; strength: number }[] = []
  for (let i = 1; i < norm.length - 1; i++) {
    if (norm[i] < threshold[i]) continue
    if (norm[i] < norm[i - 1] || norm[i] <= norm[i + 1]) continue
    peaks.push({ index: i, strength: norm[i] })
  }

  // 2. Collapse double triggers — one hit usually fires twice, on the click and
  //    again on the body. Keep the *earliest* peak of each cluster: that is the
  //    real attack. Keeping the loudest instead loses every kick, because a
  //    vocal kick carries little spectral flux next to a bright consonant.
  const minFrames = Math.max(1, Math.round((minInterval * sampleRate) / HOP))
  const kept: { index: number; strength: number }[] = []
  for (const peak of peaks) {
    const last = kept[kept.length - 1]
    if (last && peak.index - last.index < minFrames) {
      last.strength = Math.max(last.strength, peak.strength)
      continue
    }
    kept.push({ ...peak })
  }

  return kept.map(({ index, strength }) => ({
    time: spectra[index].time,
    strength,
    voice: classify(features(spectra, index, samples, sampleRate)),
  }))
}

/** How percussive vs. tonal a region is — used to split beatbox from melody. */
export function percussiveness(buffer: AudioBuffer, from: number, to: number): number {
  const samples = toMono(buffer)
  const sr = buffer.sampleRate
  const start = Math.max(0, Math.floor(from * sr))
  const end = Math.min(samples.length, Math.ceil(to * sr))
  if (end - start < FRAME * 2) return 0
  const spectra = buildSpectra(samples.subarray(start, end), sr)
  if (spectra.length < 2) return 0
  const fluxes = spectra.map((s) => s.flux)
  const peak = Math.max(...fluxes)
  const mean = fluxes.reduce((s, f) => s + f, 0) / fluxes.length
  const crest = mean > 0 ? peak / mean : 1
  return Math.min(1, crest / 8)
}
