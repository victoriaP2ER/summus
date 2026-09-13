/** Preset id — see INSTRUMENTS in lib/audio/instruments.ts for the full list. */
export type InstrumentId = string

export type DrumVoice = 'kick' | 'snare' | 'clap' | 'hat' | 'openhat' | 'tom' | 'rim' | 'crash'

export type LoopKind = 'melodic' | 'drum' | 'vocal'

export interface Note {
  id: string
  /** Start in beats, relative to the loop start */
  start: number
  /** Length in beats */
  duration: number
  /** MIDI note number (integer after snapping) */
  pitch: number
  /** 0..1 */
  velocity: number
  /** Raw detected pitch (MIDI float) before snapping — used for "reset" */
  sourcePitch?: number
  /** Only for drum loops */
  drum?: DrumVoice
}

export interface VocalSlice {
  id: string
  /** Seconds into the recorded buffer */
  offset: number
  /** Length in seconds of the source region */
  length: number
  /** Quantised start in beats */
  start: number
  /** Quantised length in beats */
  duration: number
  /** Detected pitch of the slice (MIDI float) */
  sourcePitch: number
  /** Pitch the slice should be tuned to (MIDI, editable) */
  targetPitch: number
  velocity: number
  enabled: boolean
}

export interface VocalTake {
  bufferId: string
  slices: VocalSlice[]
  /** 0 = original, 1 = fully snapped */
  strength: number
  /** Pull timing onto the grid, 0..1 */
  timeFix: number
  /** dry/wet of the corrected signal against the raw take */
  blend: number
}

export interface Loop {
  id: string
  name: string
  bars: number
  kind: LoopKind
  instrument: InstrumentId
  notes: Note[]
  vocal?: VocalTake
  color: string
  muted: boolean
  solo: boolean
  /** dB */
  volume: number
  /** Semitone transpose applied at playback */
  transpose: number
}

export interface Clip {
  id: string
  loopId: string
  /** Bar index in the song */
  startBar: number
  /** Number of times the loop repeats */
  repeats: number
  track: number
}

export interface ScaleDef {
  id: string
  name: string
  steps: number[]
}

export interface PitchFrame {
  time: number
  midi: number
  clarity: number
  rms: number
}

export interface Onset {
  time: number
  strength: number
  voice: DrumVoice
}

export type CaptureMode = 'hum' | 'beatbox' | 'vocal' | 'song'
