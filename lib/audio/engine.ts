'use client'

import * as Tone from 'tone'
import { createInstrument, prepareInstrument, type Instrument } from './instruments'
import { MicRecorder, nativeContext, type MicMode } from './recorder'
import { renderCorrectedVocal } from './autotune'
import type { Clip, DrumVoice, Loop } from '../types'
import type { StyleDemo } from './demos'
import { uid } from '../music'

/** Beats → Tone's bars:beats:sixteenths, so scheduling survives tempo changes. */
export function beatsToBBS(beats: number): string {
  const safe = Math.max(0, beats)
  const bar = Math.floor(safe / 4)
  const beat = Math.floor(safe % 4)
  const sixteenth = (safe % 1) * 4
  return `${bar}:${beat}:${sixteenth}`
}

export interface RecordRequest {
  countInBars: number
  bars: number
  /** Play the existing arrangement while recording */
  overdub: boolean
  metronome: boolean
  micMode: MicMode
  /** Manual input-latency compensation, in milliseconds */
  latencyMs: number
  onTick?: (beatsIntoTake: number, countingIn: boolean) => void
  onFinished?: (buffer: AudioBuffer | null) => void
}

class SummusEngine {
  private started = false
  private instruments = new Map<string, Instrument>()
  private parts: Tone.Part[] = []
  private players: Tone.Player[] = []
  private master: Tone.Volume | null = null
  private limiter: Tone.Limiter | null = null
  private click: Tone.MembraneSynth | null = null
  private clickHi: Tone.MembraneSynth | null = null
  private metronomeLoop: Tone.Loop | null = null
  private recorder: MicRecorder | null = null
  private recordTimer: number | null = null
  private finishRecording: (() => void) | null = null

  /** Scratch instruments used only for previewing presets */
  private auditions = new Map<string, Instrument>()
  private demoTimer: number | null = null
  private demoRoles: { lead: string; chords: string; bass: string } | null = null
  /** Raw takes, keyed so the store only has to remember an id */
  readonly buffers = new Map<string, AudioBuffer>()
  /** Autotuned renders, keyed by loop id */
  readonly rendered = new Map<string, AudioBuffer>()

  metronomeEnabled = true

  /** Exposed so the UI can draw a live count-in and bar counter. */
  recordWindow: { countInStart: number; transportStart: number; end: number; bars: number } | null = null

  now(): number {
    return Tone.now()
  }

  get isStarted(): boolean {
    return this.started
  }

  get context(): AudioContext {
    return nativeContext(Tone.getContext().rawContext)
  }

  get transport() {
    return Tone.getTransport()
  }

  private starting: Promise<void> | null = null

  async start(): Promise<void> {
    if (this.started) return
    // Concurrent callers must not each build a second set of instruments.
    if (this.starting) return this.starting
    this.starting = this.boot().finally(() => {
      this.starting = null
    })
    return this.starting
  }

  private async boot(): Promise<void> {
    // Tone builds on standardized-audio-context, whose context object is a
    // wrapper rather than a real BaseAudioContext. Web Audio constructors such
    // as AudioWorkletNode reject it, which breaks microphone capture — so hand
    // Tone a native context to run on instead.
    if (typeof AudioContext !== 'undefined') {
      try {
        const native = new AudioContext({ latencyHint: 'interactive' })
        Tone.setContext(native)
      } catch {
        /* keep Tone's own context if the browser refuses a fresh one */
      }
    }
    await Tone.start()
    if (Tone.getContext().state !== 'running') {
      await Tone.getContext().resume()
    }

    this.limiter = new Tone.Limiter(-1).toDestination()
    this.master = new Tone.Volume(-3).connect(this.limiter)

    this.click = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.14, sustain: 0 },
      volume: -10,
    }).connect(this.master)
    this.clickHi = new Tone.MembraneSynth({
      pitchDecay: 0.006,
      octaves: 2,
      envelope: { attack: 0.001, decay: 0.09, sustain: 0 },
      volume: -16,
    }).connect(this.master)

    this.transport.bpm.value = 100
    this.started = true
  }

  setBpm(bpm: number): void {
    if (this.started) this.transport.bpm.value = bpm
  }

  /** Pull down every recorded instrument a set of lanes needs. */
  async prepare(loops: Loop[]): Promise<void> {
    await Promise.all([...new Set(loops.map((l) => l.instrument))].map(prepareInstrument))
  }

  /** Create, reuse or drop instrument instances so they mirror the loop list. */
  syncInstruments(loops: Loop[]): void {
    if (!this.started || !this.master) return
    const wanted = new Map(loops.map((l) => [l.id, l]))

    for (const [id, instrument] of this.instruments) {
      const loop = wanted.get(id)
      if (!loop || loop.instrument !== instrument.id) {
        instrument.dispose()
        this.instruments.delete(id)
      }
    }

    for (const loop of loops) {
      if (loop.kind === 'vocal') continue
      let instrument = this.instruments.get(loop.id)
      if (!instrument) {
        instrument = createInstrument(loop.instrument)
        instrument.output.connect(this.master)
        this.instruments.set(loop.id, instrument)
      }
      const anySolo = loops.some((l) => l.solo)
      const audible = anySolo ? loop.solo : !loop.muted
      instrument.output.volume.value = audible ? loop.volume : -Infinity
    }
  }

  instrumentFor(loopId: string): Instrument | undefined {
    return this.instruments.get(loopId)
  }

  /** Play a single note right now — used for previews and live MIDI. */
  preview(loopId: string, midi: number, durationSec = 0.4, velocity = 0.8): void {
    const instrument = this.instruments.get(loopId)
    if (!instrument) return
    instrument.trigger(midi, durationSec, Tone.now(), velocity)
  }

  previewDrum(loopId: string, voice: Parameters<Instrument['triggerDrum']>[0], velocity = 0.9): void {
    this.instruments.get(loopId)?.triggerDrum(voice, Tone.now(), velocity)
  }

  /**
   * Play a note on an instrument that has no lane yet — used when auditioning
   * presets in the picker. Scratch instruments are kept so repeated clicks do
   * not rebuild a whole effect chain each time.
   */
  auditionNote(id: string, midi: number, durationSec: number, time: number, velocity = 0.8): void {
    if (!this.master) return
    let instrument = this.auditions.get(id)
    if (!instrument) {
      instrument = createInstrument(id)
      instrument.output.connect(this.master)
      this.auditions.set(id, instrument)
    }
    instrument.trigger(midi, durationSec, time, velocity)
  }

  private clearSchedule(): void {
    for (const part of this.parts) {
      part.stop()
      part.dispose()
    }
    this.parts = []
    for (const player of this.players) {
      player.stop()
      player.dispose()
    }
    this.players = []
    this.metronomeLoop?.stop()
    this.metronomeLoop?.dispose()
    this.metronomeLoop = null
    this.transport.cancel(0)
  }

  private schedulePart(loop: Loop, startBar: number, repeats: number): void {
    const instrument = this.instruments.get(loop.id)
    const bpm = this.transport.bpm.value

    if (loop.kind === 'vocal') {
      const buffer = this.rendered.get(loop.id) ?? (loop.vocal ? this.buffers.get(loop.vocal.bufferId) : undefined)
      if (!buffer || !this.master) return
      const anySolo = false
      const player = new Tone.Player(buffer).connect(this.master)
      player.volume.value = loop.muted && !anySolo ? -Infinity : loop.volume
      this.players.push(player)
      for (let r = 0; r < repeats; r++) {
        const at = beatsToBBS((startBar + r * loop.bars) * 4)
        this.transport.schedule((time) => {
          player.start(time)
        }, at)
      }
      return
    }

    if (!instrument || !loop.notes.length) return

    const events = loop.notes.map((note) => ({ time: beatsToBBS(note.start), note }))
    const part = new Tone.Part((time, event) => {
      const note = (event as { note: Loop['notes'][number] }).note
      const seconds = (note.duration * 60) / this.transport.bpm.value
      if (loop.kind === 'drum' || instrument.isDrum) {
        instrument.triggerDrum(note.drum ?? 'kick', time, note.velocity)
      } else {
        instrument.trigger(note.pitch + loop.transpose, seconds, time, note.velocity)
      }
    }, events)

    part.loop = repeats
    part.loopStart = 0
    part.loopEnd = `${loop.bars}m`
    part.start(beatsToBBS(startBar * 4))
    this.parts.push(part)
    void bpm
  }

  private scheduleMetronome(): void {
    if (!this.metronomeEnabled || !this.click || !this.clickHi) return
    this.metronomeLoop = new Tone.Loop((time) => {
      const beat = Math.floor(this.transport.ticks / this.transport.PPQ) % 4
      if (beat === 0) this.click?.triggerAttackRelease('C3', 0.05, time, 0.9)
      else this.clickHi?.triggerAttackRelease('C4', 0.03, time, 0.5)
    }, '4n').start(0)
  }

  private buildLoopSchedule(loop: Loop, loops: Loop[]): void {
    this.stopDemo()
    this.clearSchedule()
    this.syncInstruments(loops)
    this.schedulePart(loop, 0, Infinity)
    this.scheduleMetronome()
    this.transport.loop = true
    this.transport.loopStart = 0
    this.transport.loopEnd = `${loop.bars}m`
  }

  private buildSongSchedule(loops: Loop[], clips: Clip[], totalBars: number): void {
    this.stopDemo()
    this.clearSchedule()
    this.syncInstruments(loops)
    for (const clip of clips) {
      const loop = loops.find((l) => l.id === clip.loopId)
      if (!loop) continue
      this.schedulePart(loop, clip.startBar, Math.max(1, clip.repeats))
    }
    this.scheduleMetronome()
    this.transport.loop = true
    this.transport.loopStart = 0
    this.transport.loopEnd = `${Math.max(1, totalBars)}m`
  }

  /** Loop a single loop over and over, starting at `fromBeat`. */
  playLoop(loop: Loop, loops: Loop[], fromBeat = 0): void {
    this.buildLoopSchedule(loop, loops)
    this.seek(fromBeat)
    this.transport.start()
  }

  /** Play the whole arrangement, starting at `fromBeat`. */
  playSong(loops: Loop[], clips: Clip[], totalBars: number, fromBeat = 0): void {
    this.buildSongSchedule(loops, clips, totalBars)
    this.seek(fromBeat)
    this.transport.start()
  }

  /** Move the playhead without starting or stopping. */
  seek(beats: number): void {
    if (!this.started) return
    this.transport.ticks = Math.max(0, Math.round(beats * this.transport.PPQ))
  }

  /** Stop sounding but leave the playhead where it is, so it can be scrubbed. */
  pause(): void {
    this.stopDemo()
    this.transport.pause()
    for (const instrument of this.instruments.values()) instrument.releaseAll()
  }

  /**
   * Rebuild the schedule under a running transport, so edits are audible on the
   * next pass without the playhead jumping back to the top.
   */
  reschedule(
    mode: 'loop' | 'song',
    loops: Loop[],
    clips: Clip[],
    totalBars: number,
    activeLoop: Loop | null,
  ): void {
    if (!this.started || this.transport.state !== 'started') return
    const ticks = this.transport.ticks
    if (mode === 'loop') {
      if (!activeLoop) return
      this.buildLoopSchedule(activeLoop, loops)
    } else {
      this.buildSongSchedule(loops, clips, totalBars)
    }
    this.transport.ticks = Math.max(0, ticks)
  }

  /** Stop and rewind to the top. */
  stop(): void {
    this.stopDemo()
    this.transport.stop()
    this.transport.position = 0
    for (const instrument of this.instruments.values()) instrument.releaseAll()
    this.clearSchedule()
  }

  /** Current transport position in beats. */
  position(): number {
    if (!this.started) return 0
    return Math.max(0, this.transport.ticks / this.transport.PPQ)
  }

  /** A drum hit on the scratch kit, for previews outside the song. */
  auditionDrum(voice: DrumVoice, time: number, velocity = 0.9): void {
    if (!this.master) return
    let kit = this.auditions.get('drums')
    if (!kit) {
      kit = createInstrument('drums')
      kit.output.connect(this.master)
      this.auditions.set('drums', kit)
    }
    kit.triggerDrum(voice, time, velocity)
  }

  /**
   * Loop a genre's demo groove on scratch instruments, independently of the
   * song transport — so a style or an instrument can be judged against a beat
   * at the right tempo instead of against silence.
   *
   * Events are queued only a fraction of a second ahead. Scheduling a whole
   * loop at once would mean a swapped-out instrument keeps sounding for
   * several seconds, and stopping would not actually stop anything.
   */
  playDemo(
    demo: StyleDemo,
    roles: { lead: string; chords: string; bass: string },
    bpm: number,
    tonic = 60,
  ): void {
    this.stopDemo()
    if (!this.started) return

    // A demo and the song are never both the right thing to hear.
    if (this.transport.state === 'started') this.transport.pause()

    this.demoRoles = { ...roles }
    const beat = 60 / bpm
    const loopSeconds = demo.bars * 4 * beat

    type Event = { at: number; role?: 'lead' | 'chords' | 'bass'; note?: number; len?: number; vel: number; drum?: DrumVoice }
    const events: Event[] = [
      ...demo.lead.map((n) => ({ at: n.at * beat, role: 'lead' as const, note: tonic + n.step, len: n.len * beat, vel: n.vel ?? 0.8 })),
      ...demo.chords.map((n) => ({ at: n.at * beat, role: 'chords' as const, note: tonic + n.step, len: n.len * beat, vel: n.vel ?? 0.6 })),
      ...demo.bass.map((n) => ({ at: n.at * beat, role: 'bass' as const, note: tonic + n.step, len: n.len * beat, vel: n.vel ?? 0.9 })),
      ...demo.drums.map((h) => ({ at: h.at * beat, drum: h.voice, vel: h.vel ?? 0.9 })),
    ].sort((a, b) => a.at - b.at)

    let loopStart = Tone.now() + 0.2
    let index = 0

    this.demoTimer = window.setInterval(() => {
      const roleMap = this.demoRoles
      if (!roleMap) return
      const horizon = Tone.now() + 0.3
      // Walk the loop, wrapping round, queueing only what is about to happen.
      for (let guard = 0; guard < 64; guard++) {
        if (index >= events.length) {
          loopStart += loopSeconds
          index = 0
        }
        const event = events[index]
        const when = loopStart + event.at
        if (when > horizon) break
        if (when > Tone.now()) {
          if (event.drum) this.auditionDrum(event.drum, when, event.vel)
          else if (event.role && event.note !== undefined) {
            this.auditionNote(roleMap[event.role], event.note, event.len ?? 0.3, when, event.vel)
          }
        }
        index++
      }
    }, 45)
  }

  /** Swap an instrument in while the demo keeps running. */
  setDemoRole(role: 'lead' | 'chords' | 'bass', instrumentId: string): void {
    if (!this.demoRoles) return
    const previous = this.demoRoles[role]
    this.demoRoles[role] = instrumentId
    // Silence whatever the old instrument still has hanging.
    if (previous !== instrumentId && !Object.values(this.demoRoles).includes(previous)) {
      this.auditions.get(previous)?.releaseAll()
    }
  }

  get demoPlaying(): boolean {
    return this.demoTimer !== null
  }

  stopDemo(): void {
    if (this.demoTimer !== null) {
      window.clearInterval(this.demoTimer)
      this.demoTimer = null
    }
    this.demoRoles = null
    for (const instrument of this.auditions.values()) instrument.releaseAll()
  }

  // ---------------------------------------------------------------- recording

  async openMic(mode: MicMode): Promise<void> {
    await this.start()
    if (!this.recorder) this.recorder = new MicRecorder(this.context)
    await this.recorder.open(mode)
  }

  micLevel(): number {
    return this.recorder?.level() ?? 0
  }

  micLabel(): string {
    return this.recorder?.deviceLabel ?? ''
  }

  closeMic(): void {
    this.recorder?.close()
    this.recorder = null
  }

  /**
   * Count in, then record `bars` bars while the arrangement plays underneath.
   * The take comes back trimmed so its sample 0 is the downbeat of bar 1.
   */
  async record(request: RecordRequest, loops: Loop[], clips: Clip[], totalBars: number): Promise<void> {
    await this.openMic(request.micMode)
    if (!this.recorder) throw new Error('Mikrofon nicht verfügbar')

    this.clearSchedule()
    this.syncInstruments(loops)

    const beatDur = 60 / this.transport.bpm.value
    const countInBeats = Math.max(0, request.countInBars) * 4
    const startAt = Tone.now() + 0.18
    const transportStart = startAt + countInBeats * beatDur

    if (request.countInBars > 0 && this.click && this.clickHi) {
      for (let i = 0; i < countInBeats; i++) {
        const at = startAt + i * beatDur
        if (i % 4 === 0) this.click.triggerAttackRelease('C3', 0.06, at, 1)
        else this.clickHi.triggerAttackRelease('C4', 0.04, at, 0.6)
      }
    }

    if (request.overdub) {
      for (const clip of clips) {
        const loop = loops.find((l) => l.id === clip.loopId)
        if (!loop) continue
        this.schedulePart(loop, clip.startBar, Math.max(1, clip.repeats))
      }
    }
    this.metronomeEnabled = request.metronome
    this.scheduleMetronome()

    this.transport.loop = true
    this.transport.loopStart = 0
    this.transport.loopEnd = `${Math.max(request.bars, totalBars)}m`
    this.transport.position = 0

    const takeSeconds = request.bars * 4 * beatDur
    this.recordWindow = {
      countInStart: startAt,
      transportStart,
      end: transportStart + takeSeconds,
      bars: request.bars,
    }

    this.recorder.start()
    this.transport.start(transportStart)

    await new Promise<void>((resolve) => {
      this.recordTimer = window.setTimeout(() => resolve(), (transportStart - Tone.now() + takeSeconds) * 1000 + 120)
    })

    // Compensating for input latency means starting the take slightly *later*
    // than the transport, because the mic signal arrives after the fact.
    const buffer = this.recorder.stop(transportStart + request.latencyMs / 1000)
    this.recordWindow = null
    this.transport.stop()
    this.transport.position = 0
    this.clearSchedule()
    request.onFinished?.(buffer)
  }

  /**
   * Stop early but keep what was sung — ending a take should never throw the
   * performance away.
   */
  cancelRecord(): void {
    if (this.recordTimer !== null) {
      window.clearTimeout(this.recordTimer)
      this.recordTimer = null
    }
    const finish = this.finishRecording
    this.finishRecording = null
    if (finish) {
      // Let record() run its normal finish path so the take still comes back.
      finish()
      return
    }
    this.recordWindow = null
    this.recorder?.stop()
    this.transport.stop()
    this.transport.position = 0
    this.clearSchedule()
  }

  // ------------------------------------------------------------------ buffers

  storeBuffer(buffer: AudioBuffer, id = uid('buf')): string {
    this.buffers.set(id, buffer)
    return id
  }

  getBuffer(id: string): AudioBuffer | undefined {
    return this.buffers.get(id)
  }

  /** Re-render a vocal loop through the autotune chain. */
  renderVocal(loop: Loop, bpm: number): AudioBuffer | null {
    if (!loop.vocal) return null
    const source = this.buffers.get(loop.vocal.bufferId)
    if (!source) return null
    const corrected = renderCorrectedVocal(this.context, source, loop.vocal.slices, {
      bpm,
      strength: loop.vocal.strength,
      timeFix: loop.vocal.timeFix,
    })
    this.rendered.set(loop.id, corrected)
    return corrected
  }

  /** One-off playback of a buffer, for auditioning a take. */
  playBuffer(buffer: AudioBuffer): Tone.Player | null {
    if (!this.master) return null
    const player = new Tone.Player(buffer).connect(this.master)
    player.autostart = true
    player.onstop = () => player.dispose()
    return player
  }

  async decode(file: File | Blob): Promise<AudioBuffer> {
    await this.start()
    return this.context.decodeAudioData(await file.arrayBuffer())
  }
}

let engineInstance: SummusEngine | null = null

export function engine(): SummusEngine {
  if (!engineInstance) engineInstance = new SummusEngine()
  return engineInstance
}

export type { SummusEngine }
