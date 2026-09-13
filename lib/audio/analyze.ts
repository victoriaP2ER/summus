import { PitchDetector, rms } from './pitch'
import { freqToMidi, uid, clamp } from '../music'
import type { PitchFrame } from '../types'

/**
 * YIN is O(n²) per frame, so we run it on a decimated signal.
 * 24 kHz still resolves everything a voice can produce (Nyquist 12 kHz)
 * and cuts the work by roughly 4x compared to 48 kHz.
 */
export const TARGET_RATE = 24000
/** Analysis window. 1024 samples at 24 kHz = 43 ms, enough periods for a low voice. */
export const WINDOW_SIZE = 1024
/** YIN needs window + maxTau samples per frame. */
export const FRAME_SIZE = WINDOW_SIZE + 512
export const HOP_SIZE = 320

/** Mono mixdown of an AudioBuffer. */
export function toMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0).slice()
  const out = new Float32Array(buffer.length)
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) out[i] += data[i]
  }
  for (let i = 0; i < out.length; i++) out[i] /= buffer.numberOfChannels
  return out
}

/** Box-filtered integer decimation — cheap, and enough anti-aliasing for pitch work. */
function decimate(samples: Float32Array, factor: number): Float32Array {
  if (factor <= 1) return samples
  const out = new Float32Array(Math.floor(samples.length / factor))
  for (let i = 0; i < out.length; i++) {
    let sum = 0
    const base = i * factor
    for (let k = 0; k < factor; k++) sum += samples[base + k]
    out[i] = sum / factor
  }
  return out
}

/** Runs YIN across the whole buffer and returns a pitch/energy track. */
export function analyzePitchTrack(buffer: AudioBuffer): PitchFrame[] {
  const mono = toMono(buffer)
  const factor = Math.max(1, Math.round(buffer.sampleRate / TARGET_RATE))
  const samples = decimate(mono, factor)
  const sampleRate = buffer.sampleRate / factor

  const detector = new PitchDetector({ sampleRate, windowSize: WINDOW_SIZE, minFreq: 55, maxFreq: 1100 })
  const frames: PitchFrame[] = []
  const frame = new Float32Array(FRAME_SIZE)

  for (let start = 0; start + FRAME_SIZE <= samples.length; start += HOP_SIZE) {
    frame.set(samples.subarray(start, start + FRAME_SIZE))
    const level = rms(frame, WINDOW_SIZE)
    let midi = 0
    let clarity = 0
    if (level > 0.004) {
      const res = detector.detect(frame)
      if (res.freq > 0) {
        midi = freqToMidi(res.freq)
        clarity = res.clarity
      }
    }
    frames.push({ time: (start + WINDOW_SIZE / 2) / sampleRate, midi, clarity, rms: level })
  }
  return frames
}

/** Median of the voiced pitches inside a frame window. */
function localMedian(frames: PitchFrame[], index: number, radius: number): number {
  const window: number[] = []
  for (let j = Math.max(0, index - radius); j <= Math.min(frames.length - 1, index + radius); j++) {
    if (frames[j].midi > 0) window.push(frames[j].midi)
  }
  if (!window.length) return 0
  window.sort((a, b) => a - b)
  return window[Math.floor(window.length / 2)]
}

/** Median filter over the pitch values — smooths jitter without rounding off real slides. */
function medianFilterPitch(frames: PitchFrame[], radius = 2): void {
  const source = frames.map((f) => f.midi)
  for (let i = 0; i < frames.length; i++) {
    if (source[i] <= 0) continue
    const window: number[] = []
    for (let j = Math.max(0, i - radius); j <= Math.min(source.length - 1, i + radius); j++) {
      if (source[j] > 0) window.push(source[j])
    }
    if (window.length >= 3) {
      window.sort((a, b) => a - b)
      frames[i].midi = window[Math.floor(window.length / 2)]
    }
  }
}

/**
 * Octave errors are YIN's classic failure mode on a hummed voice: a single note
 * jumps a clean 12 semitones away from its neighbours. Fold every frame back
 * towards a robust local contour, then towards the take's overall register.
 */
function fixOctaveJumps(frames: PitchFrame[]): void {
  const voiced = frames.filter((f) => f.midi > 0).map((f) => f.midi)
  if (voiced.length < 8) return

  // A running median over ~0.4s survives isolated octave jumps, so it makes a
  // reliable reference to fold against.
  const contour = frames.map((_, i) => localMedian(frames, i, 20))
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]
    if (f.midi <= 0 || contour[i] <= 0) continue
    while (f.midi - contour[i] > 6) f.midi -= 12
    while (contour[i] - f.midi > 6) f.midi += 12
  }

  const sorted = [...frames.filter((f) => f.midi > 0).map((f) => f.midi)].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  for (const f of frames) {
    if (f.midi <= 0) continue
    while (f.midi - median > 13) f.midi -= 12
    while (median - f.midi > 13) f.midi += 12
  }
}

export interface DetectedNote {
  id: string
  startTime: number
  endTime: number
  pitch: number
  velocity: number
  confidence: number
}

export interface SegmentOptions {
  /** Below this clarity a frame counts as unvoiced */
  clarityThreshold?: number
  /** Below this RMS a frame counts as silence */
  levelThreshold?: number
  /** Sustained pitch change (semitones) that starts a new note */
  pitchDelta?: number
  /** Shortest note we keep, in seconds */
  minDuration?: number
  /** Silence that ends a note, in seconds */
  maxGap?: number
  /** Re-join neighbouring segments that land on the same note */
  mergeGap?: number
}

/** Weighted mean that leans on the loud, confident part of a segment. */
function segmentPitch(seg: PitchFrame[]): number {
  let num = 0
  let den = 0
  for (const f of seg) {
    const w = f.rms * f.clarity + 1e-6
    num += f.midi * w
    den += w
  }
  return den > 0 ? num / den : seg[0].midi
}

/** Turns a pitch track into discrete notes. */
export function segmentNotes(frames: PitchFrame[], options: SegmentOptions = {}): DetectedNote[] {
  const {
    clarityThreshold = 0.7,
    levelThreshold = 0.01,
    pitchDelta = 0.95,
    minDuration = 0.075,
    maxGap = 0.07,
    mergeGap = 0.1,
  } = options

  const work = frames.map((f) => ({ ...f }))
  medianFilterPitch(work)
  fixOctaveJumps(work)

  const peakRms = work.reduce((m, f) => Math.max(m, f.rms), 0)
  const gate = Math.max(levelThreshold, peakRms * 0.05)
  const frameDur = work.length > 1 ? work[1].time - work[0].time : HOP_SIZE / TARGET_RATE

  const raw: DetectedNote[] = []
  let current: PitchFrame[] | null = null
  let silentFor = 0
  let deviating: PitchFrame[] = []

  const flush = (endTime: number) => {
    const seg = current
    current = null
    if (!seg || seg.length < 2) return
    const duration = endTime - seg[0].time
    if (duration <= 0) return
    const peak = seg.reduce((m, f) => Math.max(m, f.rms), 0)
    raw.push({
      id: uid('n'),
      startTime: seg[0].time,
      endTime,
      pitch: segmentPitch(seg),
      velocity: peakRms > 0 ? clamp(0.25 + 0.75 * Math.pow(peak / peakRms, 0.6), 0.15, 1) : 0.7,
      confidence: seg.reduce((s, f) => s + f.clarity, 0) / seg.length,
    })
  }

  for (const f of work) {
    const voiced = f.midi > 0 && f.clarity >= clarityThreshold && f.rms >= gate

    if (!voiced) {
      silentFor += frameDur
      if (current && silentFor >= maxGap) {
        flush(f.time - silentFor + frameDur)
        deviating = []
      }
      continue
    }
    silentFor = 0

    if (!current) {
      current = [f]
      deviating = []
      continue
    }

    // Compare against the segment's own centre, not just the last few frames,
    // so vibrato and slow drift don't chop a held note into pieces.
    const ref = segmentPitch(current)
    if (Math.abs(f.midi - ref) > pitchDelta) {
      deviating.push(f)
      // Only commit to a new note once the pitch has actually settled elsewhere.
      if (deviating.length >= 4) {
        flush(deviating[0].time)
        current = deviating
        deviating = []
      }
    } else {
      if (deviating.length) {
        current.push(...deviating)
        deviating = []
      }
      current.push(f)
    }
  }
  if (current) {
    if (deviating.length) current.push(...deviating)
    flush(work[work.length - 1].time + frameDur)
  }

  return mergeNotes(
    raw.filter((n) => n.endTime - n.startTime >= minDuration),
    mergeGap,
  )
}

/** Join neighbouring notes that round to the same pitch — one held note, one bar. */
export function mergeNotes(notes: DetectedNote[], maxGap = 0.1, tolerance = 0.7): DetectedNote[] {
  if (notes.length < 2) return notes
  const out: DetectedNote[] = [notes[0]]
  for (let i = 1; i < notes.length; i++) {
    const prev = out[out.length - 1]
    const next = notes[i]
    const gap = next.startTime - prev.endTime
    const samePitch =
      Math.abs(next.pitch - prev.pitch) < tolerance &&
      Math.round(next.pitch) === Math.round(prev.pitch)
    if (gap <= maxGap && samePitch) {
      const prevLen = prev.endTime - prev.startTime
      const nextLen = next.endTime - next.startTime
      prev.pitch = (prev.pitch * prevLen + next.pitch * nextLen) / (prevLen + nextLen)
      prev.velocity = Math.max(prev.velocity, next.velocity)
      prev.confidence = (prev.confidence + next.confidence) / 2
      prev.endTime = next.endTime
    } else {
      out.push(next)
    }
  }
  return out
}

/** Median pitch of the confident part of a take — "what register did I hum in". */
export function dominantPitch(frames: PitchFrame[]): number {
  const voiced = frames.filter((f) => f.midi > 0 && f.clarity > 0.8)
  if (!voiced.length) return 60
  const sorted = voiced.map((f) => f.midi).sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

/** Where the take actually starts — used to trim silence before the first note. */
export function firstSoundTime(frames: PitchFrame[]): number {
  const peak = frames.reduce((m, f) => Math.max(m, f.rms), 0)
  const gate = Math.max(0.008, peak * 0.05)
  const hit = frames.find((f) => f.rms >= gate)
  return hit ? hit.time : 0
}
