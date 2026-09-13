/**
 * YIN fundamental frequency estimator.
 * de Cheveigné & Kawahara (2002), with parabolic refinement and an explicit
 * octave check — a sung voice has a strong 2nd harmonic, which otherwise makes
 * YIN lock onto the half period and report the note an octave too high.
 */
export interface PitchResult {
  freq: number
  /** 0..1 — how periodic the frame is */
  clarity: number
}

const SILENT: PitchResult = { freq: 0, clarity: 0 }

export interface PitchDetectorOptions {
  sampleRate: number
  /** Analysis window in samples; the frame handed to `detect` must be twice this. */
  windowSize: number
  minFreq?: number
  maxFreq?: number
  threshold?: number
}

export class PitchDetector {
  private readonly window: number
  private readonly minTau: number
  private readonly maxTau: number
  private readonly threshold: number
  private readonly sampleRate: number
  private readonly yin: Float32Array

  constructor(options: PitchDetectorOptions) {
    const { sampleRate, windowSize, minFreq = 60, maxFreq = 1100, threshold = 0.14 } = options
    this.sampleRate = sampleRate
    this.window = windowSize
    this.threshold = threshold
    this.minTau = Math.max(2, Math.floor(sampleRate / maxFreq))
    this.maxTau = Math.min(windowSize - 1, Math.ceil(sampleRate / minFreq))
    this.yin = new Float32Array(this.maxTau + 1)
  }

  /** `frame` must hold at least `windowSize + maxTau` samples. */
  detect(frame: Float32Array): PitchResult {
    const { yin, window, minTau, maxTau } = this

    // 1. squared difference function, only over the tau range we care about
    yin[0] = 1
    for (let tau = 1; tau <= maxTau; tau++) {
      let sum = 0
      for (let i = 0; i < window; i++) {
        const delta = frame[i] - frame[i + tau]
        sum += delta * delta
      }
      yin[tau] = sum
    }

    // 2. cumulative mean normalised difference
    let running = 0
    for (let tau = 1; tau <= maxTau; tau++) {
      running += yin[tau]
      yin[tau] = running === 0 ? 1 : (yin[tau] * tau) / running
    }

    if (minTau >= maxTau) return SILENT

    // 3. first local minimum below the absolute threshold
    let tauEstimate = -1
    for (let tau = minTau; tau <= maxTau; tau++) {
      if (yin[tau] < this.threshold) {
        while (tau + 1 <= maxTau && yin[tau + 1] < yin[tau]) tau++
        tauEstimate = tau
        break
      }
    }
    if (tauEstimate === -1) {
      let best = minTau
      for (let tau = minTau; tau <= maxTau; tau++) {
        if (yin[tau] < yin[best]) best = tau
      }
      if (yin[best] > 0.55) return SILENT
      tauEstimate = best
    }

    // 4. octave check — if a whole multiple of the period fits *better*, the
    //    first dip was a harmonic. A frame that is genuinely periodic at tau
    //    scores about the same at 2*tau, so we demand a clear improvement.
    for (let mult = 2; mult <= 4; mult++) {
      const candidate = this.refineDip(tauEstimate * mult)
      if (candidate < 0) break
      if (yin[candidate] < yin[tauEstimate] * 0.85) {
        tauEstimate = candidate
      }
    }

    // 5. parabolic interpolation around the dip
    const x0 = tauEstimate > 1 ? tauEstimate - 1 : tauEstimate
    const x2 = tauEstimate + 1 <= maxTau ? tauEstimate + 1 : tauEstimate
    let betterTau = tauEstimate
    if (x0 !== tauEstimate && x2 !== tauEstimate) {
      const s0 = yin[x0]
      const s1 = yin[tauEstimate]
      const s2 = yin[x2]
      const denom = 2 * (2 * s1 - s2 - s0)
      if (denom !== 0) betterTau = tauEstimate + (s2 - s0) / denom
    }

    const freq = this.sampleRate / betterTau
    if (!isFinite(freq) || betterTau < minTau || betterTau > maxTau) return SILENT

    return { freq, clarity: Math.max(0, Math.min(1, 1 - yin[tauEstimate])) }
  }

  /** Nearest local minimum to `tau`, or -1 if it falls outside the search range. */
  private refineDip(tau: number): number {
    const { yin, maxTau, minTau } = this
    if (tau > maxTau || tau < minTau) return -1
    let best = tau
    const span = Math.max(2, Math.round(tau * 0.06))
    for (let t = Math.max(minTau, tau - span); t <= Math.min(maxTau, tau + span); t++) {
      if (yin[t] < yin[best]) best = t
    }
    return best
  }
}

export function rms(buffer: Float32Array, length = buffer.length): number {
  let sum = 0
  for (let i = 0; i < length; i++) sum += buffer[i] * buffer[i]
  return Math.sqrt(sum / length)
}
