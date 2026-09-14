import * as Tone from 'tone'
import type { DrumVoice, InstrumentId } from '../types'
import { midiToToneNote } from '../music'
import { PRESETS, preset, type FxSpec, type Preset } from './presets'
import {
  drumBuffer,
  drumVariantCount,
  loadDrumKit,
  loadInstrumentSamples,
  sampleBuffers,
  samplesReady,
} from './samples'

export {
  PRESETS,
  preset,
  presetsByFamily,
  searchPresets,
  MELODIC_PRESETS,
  SAMPLED_PRESETS,
  FAMILY_ORDER,
} from './presets'
export type { Preset, Family } from './presets'

/** Kept for the places that still ask for "the instrument list". */
export const INSTRUMENTS = PRESETS

export function instrumentMeta(id: InstrumentId): Preset {
  return preset(id)
}

export interface Instrument {
  readonly id: InstrumentId
  readonly isDrum: boolean
  output: Tone.Volume
  trigger(midi: number, durationSec: number, time: number, velocity: number): void
  triggerDrum(voice: DrumVoice, time: number, velocity: number): void
  attack(midi: number, time: number, velocity: number): void
  release(midi: number, time: number): void
  releaseAll(): void
  dispose(): void
}

/** Keep a note inside what the instrument can actually play, by whole octaves. */
export function foldIntoRange(midi: number, id: InstrumentId): number {
  const { low, high } = preset(id)
  if (high <= low) return midi
  let m = midi
  while (m < low) m += 12
  while (m > high) m -= 12
  return Math.max(low, Math.min(high, m))
}

function buildFx(spec: FxSpec): Tone.ToneAudioNode {
  switch (spec.type) {
    case 'filter': {
      const filter = new Tone.Filter({
        frequency: spec.frequency,
        type: spec.kind ?? 'lowpass',
        rolloff: spec.rolloff ?? -12,
        Q: spec.Q ?? 1,
      })
      if (spec.gain !== undefined) filter.gain.value = spec.gain
      return filter
    }
    case 'gain':
      return new Tone.Volume(spec.db)
    case 'vibrato':
      return new Tone.Vibrato({ frequency: spec.frequency, depth: spec.depth })
    case 'chorus':
      return new Tone.Chorus({
        frequency: spec.frequency,
        delayTime: spec.delayTime,
        depth: spec.depth,
        wet: spec.wet,
      }).start()
    case 'reverb':
      return new Tone.Freeverb({
        roomSize: spec.roomSize,
        dampening: spec.dampening ?? 3000,
        wet: spec.wet,
      })
    case 'delay':
      return new Tone.FeedbackDelay({
        delayTime: spec.delayTime,
        feedback: spec.feedback,
        wet: spec.wet,
      })
    case 'distortion':
      return new Tone.Distortion({
        distortion: spec.amount,
        wet: spec.wet,
        oversample: spec.oversample ?? '2x',
      })
    case 'tremolo':
      return new Tone.Tremolo({ frequency: spec.frequency, depth: spec.depth, wet: spec.wet }).start()
    case 'bitcrush': {
      const crusher = new Tone.BitCrusher(spec.bits)
      crusher.wet.value = spec.wet
      return crusher
    }
  }
}

/** The subset of a Tone instrument this app drives. */
interface Voice {
  triggerAttackRelease(note: string, duration: number, time: number, velocity: number): void
  triggerAttack(note: string, time: number, velocity: number): void
  triggerRelease(note: string, time: number): void
  releaseAll(): void
  connect(node: Tone.InputNode): void
  dispose(): void
}

/** A recorded instrument that is still downloading stays quiet rather than faking it. */
class SilentVoice implements Voice {
  triggerAttackRelease(): void {}
  triggerAttack(): void {}
  triggerRelease(): void {}
  releaseAll(): void {}
  connect(): void {}
  dispose(): void {}
}

function buildVoice(spec: Preset): Voice {
  const options = (spec.options ?? {}) as never
  switch (spec.voice) {
    case 'sampler': {
      const buffers = spec.sample ? sampleBuffers(spec.sample) : null
      if (!buffers || !Object.keys(buffers).length) return new SilentVoice()
      return new Tone.Sampler({ urls: buffers, ...(spec.options ?? {}) } as never)
    }
    case 'fm':
      return new Tone.PolySynth(Tone.FMSynth, options)
    case 'am':
      return new Tone.PolySynth(Tone.AMSynth, options)
    case 'mono':
      return new Tone.PolySynth(Tone.MonoSynth, options)
    default:
      return new Tone.PolySynth(Tone.Synth, options)
  }
}

/** Make sure an instrument's recordings are in memory before it has to play. */
export async function prepareInstrument(id: InstrumentId): Promise<void> {
  const spec = preset(id)
  if (spec.voice === 'sampler' && spec.sample) await loadInstrumentSamples(spec.sample)
}

export function instrumentReady(id: InstrumentId): boolean {
  const spec = preset(id)
  if (spec.voice !== 'sampler' || !spec.sample) return true
  return samplesReady(spec.sample)
}

class MelodicInstrument implements Instrument {
  readonly isDrum = false
  output: Tone.Volume
  private synth: Voice
  private chain: Tone.ToneAudioNode[]
  private disposed = false
  /** Last time each pitch was struck — a voice cannot be attacked twice at once. */
  private lastAt = new Map<number, number>()
  private spec: Preset
  /** Notes landing on the same instant belong to one chord, and get strummed. */
  private chordAt = -1
  private chordIndex = 0

  constructor(readonly id: InstrumentId) {
    const spec = preset(id)
    this.spec = spec
    this.output = new Tone.Volume(spec.gain ?? 0)
    this.chain = (spec.fx ?? []).map(buildFx)
    for (let i = 0; i < this.chain.length; i++) {
      this.chain[i].connect(this.chain[i + 1] ?? this.output)
    }

    this.synth = buildVoice(spec)
    this.attachVoice()

    // Recorded instruments arrive over the network. Swap the real sampler in as
    // soon as it lands so the lane starts sounding without a reload.
    if (spec.voice === 'sampler' && spec.sample && !samplesReady(spec.sample)) {
      void loadInstrumentSamples(spec.sample).then(() => {
        if (this.disposed) return
        this.synth.dispose()
        this.synth = buildVoice(spec)
        this.attachVoice()
      })
    }
  }

  private attachVoice(): void {
    if (this.synth instanceof Tone.PolySynth) this.synth.maxPolyphony = 24
    this.synth.connect(this.chain[0] ?? this.output)
  }

  trigger(midi: number, durationSec: number, time: number, velocity: number): void {
    // Swapping a lane's instrument disposes this one, but events already on the
    // transport keep firing until the schedule is rebuilt a moment later.
    if (this.disposed) return
    // Times and durations arrive from arithmetic on floats; a value a hair
    // below zero makes Tone throw rather than simply play.
    const pitch = foldIntoRange(midi, this.id)

    // A chord is a pick crossing the strings, not one simultaneous event.
    // Spreading the notes by a few milliseconds is the difference between a
    // guitar and a stack of identical samples cancelling each other out.
    const base = Math.max(0, time || 0)
    if (Math.abs(base - this.chordAt) < 0.002) this.chordIndex += 1
    else {
      this.chordAt = base
      this.chordIndex = 0
    }
    const spread = (this.spec.strum ?? 0) * this.chordIndex
    const at = this.slot(pitch, base + spread)
    try {
      this.synth.triggerAttackRelease(
        midiToToneNote(pitch),
        Math.max(0.03, durationSec || 0),
        at,
        Math.max(0.05, Math.min(1, velocity || 0.8)),
      )
    } catch {
      // Two schedules can briefly overlap while a lane is being rebuilt.
      // Dropping one note is far better than tearing down playback.
    }
  }

  /**
   * Nudge a repeat of the same pitch a millisecond later. Tone's timeline
   * rejects two events at one instant, and two identical notes at the same
   * moment are inaudible as a chord anyway.
   */
  private slot(pitch: number, time: number): number {
    const previous = this.lastAt.get(pitch)
    const at = previous !== undefined && time <= previous ? previous + 0.001 : time
    this.lastAt.set(pitch, at)
    return at
  }

  attack(midi: number, time: number, velocity: number): void {
    if (this.disposed) return
    this.synth.triggerAttack(
      midiToToneNote(foldIntoRange(midi, this.id)),
      Math.max(0, time || 0),
      Math.max(0.05, Math.min(1, velocity || 0.8)),
    )
  }

  release(midi: number, time: number): void {
    if (this.disposed) return
    this.synth.triggerRelease(midiToToneNote(foldIntoRange(midi, this.id)), Math.max(0, time || 0))
  }

  triggerDrum(): void {
    /* not a drum kit */
  }

  releaseAll(): void {
    if (this.disposed) return
    this.synth.releaseAll()
  }

  dispose(): void {
    this.disposed = true
    this.synth.dispose()
    for (const fx of this.chain) fx.dispose()
    this.output.dispose()
  }
}

class DrumKit implements Instrument {
  readonly id: InstrumentId = 'drums'
  readonly isDrum = true
  output: Tone.Volume
  private disposed = false
  /** Hi-hat and open hat share one metal synth, so their times must not collide. */
  private lastAt = new Map<string, number>()
  private kick: Tone.MembraneSynth
  private tom: Tone.MembraneSynth
  private snare: Tone.NoiseSynth
  private snareTone: Tone.Synth
  private clap: Tone.NoiseSynth
  private hat: Tone.MetalSynth
  private rim: Tone.MetalSynth
  private nodes: Tone.ToneAudioNode[] = []

  constructor() {
    this.output = new Tone.Volume(0)

    this.kick = new Tone.MembraneSynth({
      pitchDecay: 0.045,
      octaves: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.42, sustain: 0.01, release: 1.2, attackCurve: 'exponential' },
    }).connect(this.output)

    this.tom = new Tone.MembraneSynth({
      pitchDecay: 0.1,
      octaves: 3,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.28, sustain: 0.01, release: 0.6 },
    }).connect(this.output)

    const snareBus = new Tone.Filter(1400, 'bandpass').connect(this.output)
    this.snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.16, sustain: 0 },
    }).connect(snareBus)
    // A little tuned body under the noise so it reads as a snare, not a hiss.
    this.snareTone = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
      volume: -14,
    }).connect(this.output)

    const clapBus = new Tone.Filter(1100, 'bandpass').connect(this.output)
    this.clap = new Tone.NoiseSynth({
      noise: { type: 'pink' },
      envelope: { attack: 0.002, decay: 0.22, sustain: 0 },
    }).connect(clapBus)

    const hatBus = new Tone.Filter(8000, 'highpass').connect(this.output)
    this.hat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.055, release: 0.02 },
      harmonicity: 5.1,
      modulationIndex: 32,
      resonance: 5000,
      octaves: 1.5,
      volume: -18,
    }).connect(hatBus)

    const rimBus = new Tone.Filter(2200, 'bandpass').connect(this.output)
    this.rim = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.035, release: 0.01 },
      harmonicity: 8,
      modulationIndex: 22,
      resonance: 3200,
      octaves: 1,
      volume: -20,
    }).connect(rimBus)

    this.nodes = [snareBus, clapBus, hatBus, rimBus]

    // Real one-shots replace the synthesised kit as soon as they arrive.
    void loadDrumKit()
  }

  /**
   * A fresh buffer source per hit. Recorded drums overlap the way real ones do,
   * and a new source each time cannot collide with the previous one's timeline.
   */
  private playSample(voice: DrumVoice, at: number, velocity: number): boolean {
    // Step through the round robins by hit time, so the same bar renders the
    // same way offline as it sounded live.
    const variants = drumVariantCount(voice)
    const pick = variants > 1 ? Math.floor(at * 1000) % variants : 0
    const buffer = drumBuffer(voice, pick)
    if (!buffer) return false
    const source = new Tone.ToneBufferSource(buffer).connect(this.output)
    // No two strokes of a real drum are identical. A little tuning and level
    // movement per hit is what stops a programmed beat sounding mechanical.
    const wobble = Math.sin(at * 137.51) * 0.5 + Math.sin(at * 61.7) * 0.5
    source.playbackRate.value = 1 + wobble * 0.022
    source.onended = () => source.dispose()
    source.start(at, 0, undefined, Math.max(0.05, velocity * (1 + wobble * 0.09)))
    return true
  }

  triggerDrum(voice: DrumVoice, time: number, velocity: number): void {
    if (this.disposed) return
    // Each of these shares a monophonic synth, so they share a slot.
    const bus = voice === 'openhat' ? 'hat' : voice
    const wanted = Math.max(0, time || 0)
    const previous = this.lastAt.get(bus)
    const at = previous !== undefined && wanted <= previous ? previous + 0.001 : wanted
    this.lastAt.set(bus, at)
    const v = Math.max(0.08, Math.min(1, velocity || 0.8))
    try {
      this.strike(voice, at, v)
    } catch {
      // A dropped hit beats a thrown error mid-song.
    }
  }

  private strike(voice: DrumVoice, at: number, v: number): void {
    if (this.playSample(voice, at, v)) return
    switch (voice) {
      case 'kick':
        this.kick.triggerAttackRelease('C1', 0.5, at, v)
        break
      case 'tom':
        this.tom.triggerAttackRelease('G1', 0.35, at, v)
        break
      case 'snare':
        this.snare.triggerAttackRelease(0.16, at, v)
        this.snareTone.triggerAttackRelease('D3', 0.1, at, v * 0.7)
        break
      case 'clap':
        this.clap.triggerAttackRelease(0.2, at, v)
        break
      case 'hat':
        this.hat.triggerAttackRelease(0.04, at, v * 0.9)
        break
      case 'openhat':
        this.hat.triggerAttackRelease(0.3, at, v * 0.8)
        break
      case 'rim':
        this.rim.triggerAttackRelease(0.03, at, v)
        break
      case 'crash':
        // Only reached before the recordings land.
        this.hat.triggerAttackRelease(1.2, at, v * 0.7)
        break
    }
  }

  trigger(): void {
    /* drums are triggered by voice, not by pitch */
  }
  attack(): void {}
  release(): void {}
  releaseAll(): void {}

  dispose(): void {
    this.disposed = true
    for (const node of [
      this.kick,
      this.tom,
      this.snare,
      this.snareTone,
      this.clap,
      this.hat,
      this.rim,
      ...this.nodes,
      this.output,
    ]) {
      node.dispose()
    }
  }
}

export function createInstrument(id: InstrumentId): Instrument {
  const spec = preset(id)
  return spec.voice === 'drums' ? new DrumKit() : new MelodicInstrument(spec.id)
}

export const DRUM_VOICES: { id: DrumVoice; label: string; row: number }[] = [
  { id: 'crash', label: 'Crash', row: 0 },
  { id: 'openhat', label: 'Open Hat', row: 1 },
  { id: 'hat', label: 'Hi-Hat', row: 2 },
  { id: 'rim', label: 'Rim', row: 3 },
  { id: 'clap', label: 'Clap', row: 4 },
  { id: 'snare', label: 'Snare', row: 5 },
  { id: 'tom', label: 'Tom', row: 6 },
  { id: 'kick', label: 'Kick', row: 7 },
]
