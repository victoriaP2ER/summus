import type { InstrumentId } from '../types'

export type Family = 'Streicher' | 'Bläser' | 'Tasten' | 'Zupf' | 'Synth' | 'Bass' | 'Chor' | 'Drums'

export type VoiceKind = 'synth' | 'fm' | 'am' | 'mono' | 'pluck' | 'drums' | 'sampler'

export type FxSpec =
  | { type: 'filter'; frequency: number; kind?: BiquadFilterType; rolloff?: -12 | -24 | -48; Q?: number }
  | { type: 'vibrato'; frequency: number; depth: number }
  | { type: 'chorus'; frequency: number; delayTime: number; depth: number; wet: number }
  | { type: 'reverb'; roomSize: number; dampening?: number; wet: number }
  | { type: 'delay'; delayTime: string; feedback: number; wet: number }
  | { type: 'distortion'; amount: number; wet: number }
  | { type: 'tremolo'; frequency: number; depth: number; wet: number }
  | { type: 'bitcrush'; bits: number; wet: number }

export interface Preset {
  id: InstrumentId
  label: string
  family: Family
  /** One line the UI shows while you are picking */
  hint: string
  emoji: string
  /** Comfortable MIDI range — a hummed take gets folded into this */
  low: number
  high: number
  voice: VoiceKind
  /** Passed straight to the Tone voice constructor */
  options?: Record<string, unknown>
  fx?: FxSpec[]
  /** Trim so every preset lands at a similar loudness */
  gain?: number
  /** Folder under public/samples — set for every recorded instrument */
  sample?: string
  /** True when the sound is synthesised rather than recorded */
  synthetic?: boolean
}

/** A preset backed by real recordings under public/samples. */
function sampled(
  id: string,
  label: string,
  family: Family,
  hint: string,
  emoji: string,
  sample: string,
  low: number,
  high: number,
  fx: FxSpec[] = [],
  options: Record<string, unknown> = {},
  gain = 0,
): Preset {
  return { id, label, family, hint, emoji, low, high, voice: 'sampler', sample, fx, options, gain }
}

export const PRESETS: Preset[] = [
  // ---------------------------------------------------------------- Streicher
  sampled('violin', 'Violine', 'Streicher', 'Weich gestrichen, echtes Instrument', '🎻', 'violin', 55, 91, [
    { type: 'reverb', roomSize: 0.7, dampening: 3000, wet: 0.26 },
  ]),
  sampled('violinSolo', 'Violine solo', 'Streicher', 'Nah und direkt, wenig Raum — für die Hauptmelodie', '🎻', 'violin', 55, 91, [
    { type: 'filter', frequency: 9000, kind: 'highshelf' },
    { type: 'reverb', roomSize: 0.45, wet: 0.12 },
  ]),
  sampled('strings', 'Streicher-Ensemble', 'Streicher', 'Breit und getragen, wie ein ganzes Orchester', '🎼', 'violin', 48, 88, [
    { type: 'chorus', frequency: 0.45, delayTime: 8, depth: 0.75, wet: 0.55 },
    { type: 'reverb', roomSize: 0.9, dampening: 2400, wet: 0.45 },
  ], { attack: 0.35, release: 1.6 }, -3),
  sampled('cello', 'Cello', 'Streicher', 'Dunkel und tragend', '🎻', 'cello', 36, 74, [
    { type: 'reverb', roomSize: 0.75, dampening: 2000, wet: 0.28 },
  ]),
  sampled('contrabass', 'Kontrabass', 'Streicher', 'Das tiefste Streichinstrument', '🎻', 'contrabass', 28, 60, [
    { type: 'reverb', roomSize: 0.6, dampening: 1500, wet: 0.2 },
  ]),
  {
    id: 'pizzicato',
    label: 'Pizzicato',
    family: 'Streicher',
    hint: 'Kurz gezupfte Saiten — nachgebaut, nicht aufgenommen',
    emoji: '🎻',
    low: 45,
    high: 92,
    voice: 'synth',
    synthetic: true,
    options: {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.002, decay: 0.22, sustain: 0, release: 0.18 },
    },
    fx: [{ type: 'filter', frequency: 3800 }, { type: 'reverb', roomSize: 0.5, wet: 0.18 }],
  },

  // ------------------------------------------------------------------ Bläser
  sampled('flute', 'Flöte', 'Bläser', 'Luftig und hell', '🪈', 'flute', 60, 96, [
    { type: 'reverb', roomSize: 0.62, wet: 0.26 },
  ]),
  sampled('clarinet', 'Klarinette', 'Bläser', 'Rund und holzig', '🎶', 'clarinet', 50, 86, [
    { type: 'reverb', roomSize: 0.55, wet: 0.2 },
  ]),
  sampled('sax', 'Saxophon', 'Bläser', 'Rauchig, mit Biss', '🎷', 'saxophone', 50, 84, [
    { type: 'reverb', roomSize: 0.6, wet: 0.22 },
  ]),
  sampled('trumpet', 'Trompete', 'Bläser', 'Strahlend und vorlaut', '🎺', 'trumpet', 53, 86, [
    { type: 'reverb', roomSize: 0.55, wet: 0.2 },
  ]),
  sampled('trombone', 'Posaune', 'Bläser', 'Warm und breit', '🎺', 'trombone', 40, 72, [
    { type: 'reverb', roomSize: 0.6, wet: 0.22 },
  ]),
  sampled('frenchHorn', 'Waldhorn', 'Bläser', 'Weich und weit, wie aus der Ferne', '📯', 'french-horn', 41, 77, [
    { type: 'reverb', roomSize: 0.82, dampening: 2200, wet: 0.35 },
  ]),
  sampled('brass', 'Bläser-Section', 'Bläser', 'Mehrere Bläser zusammen, wie in einer Big Band', '🎺', 'trumpet', 50, 84, [
    { type: 'chorus', frequency: 0.8, delayTime: 6, depth: 0.55, wet: 0.4 },
    { type: 'reverb', roomSize: 0.6, wet: 0.24 },
  ], { attack: 0.04 }, -3),
  {
    id: 'panflute',
    label: 'Panflöte',
    family: 'Bläser',
    hint: 'Hauchig und weit — nachgebaut',
    emoji: '🪈',
    low: 58,
    high: 92,
    voice: 'am',
    synthetic: true,
    options: {
      harmonicity: 2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.11, decay: 0.2, sustain: 0.75, release: 0.5 },
      modulation: { type: 'square' },
    },
    fx: [
      { type: 'vibrato', frequency: 4.8, depth: 0.1 },
      { type: 'reverb', roomSize: 0.85, dampening: 2400, wet: 0.38 },
    ],
  },

  // ------------------------------------------------------------------ Tasten
  sampled('piano', 'Flügel', 'Tasten', 'Klassisches Klavier', '🎹', 'piano', 28, 96, [
    { type: 'reverb', roomSize: 0.5, wet: 0.15 },
  ]),
  sampled('organ', 'Orgel', 'Tasten', 'Durchgehend und tragend', '🎹', 'organ', 36, 92, [
    { type: 'reverb', roomSize: 0.85, wet: 0.32 },
  ], { release: 0.15 }),
  {
    id: 'epiano',
    label: 'E-Piano',
    family: 'Tasten',
    hint: 'Weich und glockig, sehr 70er — nachgebaut',
    emoji: '🎹',
    low: 32,
    high: 96,
    voice: 'fm',
    synthetic: true,
    options: {
      harmonicity: 3.01,
      modulationIndex: 14,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.003, decay: 1.1, sustain: 0.12, release: 0.8 },
      modulationEnvelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.2 },
    },
    fx: [
      { type: 'chorus', frequency: 1.2, delayTime: 3, depth: 0.4, wet: 0.35 },
      { type: 'reverb', roomSize: 0.55, wet: 0.2 },
    ],
  },
  {
    id: 'celesta',
    label: 'Celesta',
    family: 'Tasten',
    hint: 'Zart und funkelnd, wie eine Spieluhr — nachgebaut',
    emoji: '✨',
    low: 55,
    high: 104,
    voice: 'fm',
    synthetic: true,
    options: {
      harmonicity: 5,
      modulationIndex: 3,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.9, sustain: 0, release: 0.7 },
    },
    fx: [{ type: 'reverb', roomSize: 0.85, wet: 0.38 }],
  },

  // -------------------------------------------------------------------- Zupf
  sampled('guitarNylon', 'Konzertgitarre', 'Zupf', 'Warme Nylonsaiten', '🎸', 'guitar-nylon', 40, 84, [
    { type: 'reverb', roomSize: 0.55, wet: 0.2 },
  ]),
  sampled('guitarSteel', 'Westerngitarre', 'Zupf', 'Hell und drahtig', '🎸', 'guitar-acoustic', 40, 84, [
    { type: 'reverb', roomSize: 0.55, wet: 0.2 },
  ]),
  sampled('guitarClean', 'E-Gitarre clean', 'Zupf', 'Klar, mit etwas Federhall', '🎸', 'guitar-acoustic', 40, 84, [
    { type: 'filter', frequency: 5200 },
    { type: 'tremolo', frequency: 4.5, depth: 0.3, wet: 0.3 },
    { type: 'reverb', roomSize: 0.68, wet: 0.3 },
  ]),
  sampled('guitarDist', 'E-Gitarre verzerrt', 'Zupf', 'Dreckig und laut — Punk, Rock, alles was kracht', '🤘', 'guitar-acoustic', 38, 84, [
    { type: 'distortion', amount: 0.75, wet: 1 },
    { type: 'filter', frequency: 3400, rolloff: -24 },
    { type: 'reverb', roomSize: 0.45, wet: 0.14 },
  ], { release: 0.4 }, -12),
  sampled('harp', 'Harfe', 'Zupf', 'Perlend, mit viel Nachklang', '🪕', 'harp', 45, 96, [
    { type: 'reverb', roomSize: 0.82, wet: 0.34 },
  ]),
  sampled('xylophone', 'Xylophon', 'Zupf', 'Holzig und hell, springt hervor', '🪵', 'xylophone', 67, 100, [
    { type: 'reverb', roomSize: 0.5, wet: 0.2 },
  ]),
  {
    id: 'kalimba',
    label: 'Kalimba',
    family: 'Zupf',
    hint: 'Kleine Daumenklaviatur, rund und holzig — nachgebaut',
    emoji: '🪘',
    low: 52,
    high: 92,
    voice: 'fm',
    synthetic: true,
    options: {
      harmonicity: 4,
      modulationIndex: 2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.002, decay: 0.55, sustain: 0, release: 0.4 },
    },
    fx: [{ type: 'filter', frequency: 3400 }, { type: 'reverb', roomSize: 0.6, wet: 0.25 }],
  },
  {
    id: 'marimba',
    label: 'Marimba',
    family: 'Zupf',
    hint: 'Weiches Holz, sehr freundlich — nachgebaut',
    emoji: '🎼',
    low: 45,
    high: 92,
    voice: 'fm',
    synthetic: true,
    options: {
      harmonicity: 3,
      modulationIndex: 1.6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.7, sustain: 0, release: 0.5 },
    },
    fx: [{ type: 'reverb', roomSize: 0.55, wet: 0.22 }],
  },
  {
    id: 'glockenspiel',
    label: 'Glockenspiel',
    family: 'Zupf',
    hint: 'Metallisch und glitzernd — nachgebaut',
    emoji: '🔔',
    low: 64,
    high: 104,
    voice: 'fm',
    synthetic: true,
    options: {
      harmonicity: 7,
      modulationIndex: 6,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 1.2, sustain: 0, release: 1 },
    },
    fx: [{ type: 'reverb', roomSize: 0.85, wet: 0.4 }],
    gain: -4,
  },

  // ------------------------------------------------------------------- Synth
  {
    id: 'synthLead',
    label: 'Synth Lead',
    family: 'Synth',
    hint: 'Klarer Leadsound, schneidet durch',
    emoji: '⚡',
    low: 48,
    high: 96,
    voice: 'synth',
    options: {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 24 },
      envelope: { attack: 0.012, decay: 0.18, sustain: 0.7, release: 0.35 },
    },
    fx: [
      { type: 'filter', frequency: 5200, rolloff: -24 },
      { type: 'delay', delayTime: '8n.', feedback: 0.24, wet: 0.18 },
      { type: 'reverb', roomSize: 0.55, wet: 0.2 },
    ],
    gain: -3,
  },
  {
    id: 'supersaw',
    label: 'Supersaw',
    family: 'Synth',
    hint: 'Breit und laut, moderner Dance-Lead',
    emoji: '🔊',
    low: 48,
    high: 96,
    voice: 'synth',
    options: {
      oscillator: { type: 'fatsawtooth', count: 7, spread: 50 },
      envelope: { attack: 0.02, decay: 0.25, sustain: 0.75, release: 0.4 },
    },
    fx: [
      { type: 'filter', frequency: 6000, rolloff: -24 },
      { type: 'chorus', frequency: 0.7, delayTime: 4, depth: 0.5, wet: 0.4 },
      { type: 'reverb', roomSize: 0.6, wet: 0.25 },
    ],
    gain: -6,
  },
  {
    id: 'squareLead',
    label: 'Chiptune',
    family: 'Synth',
    hint: 'Pieps-Sound wie aus einem alten Spiel',
    emoji: '🕹️',
    low: 48,
    high: 100,
    voice: 'synth',
    options: {
      oscillator: { type: 'square' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.6, release: 0.1 },
    },
    fx: [{ type: 'bitcrush', bits: 6, wet: 0.5 }, { type: 'filter', frequency: 7000 }],
    gain: -8,
  },
  {
    id: 'pluckSynth',
    label: 'Pluck Synth',
    family: 'Synth',
    hint: 'Kurz angerissen, gut für Rhythmisches',
    emoji: '💧',
    low: 45,
    high: 96,
    voice: 'synth',
    options: {
      oscillator: { type: 'fatsawtooth', count: 2, spread: 18 },
      envelope: { attack: 0.002, decay: 0.3, sustain: 0.02, release: 0.25 },
    },
    fx: [
      { type: 'filter', frequency: 3200, rolloff: -24 },
      { type: 'delay', delayTime: '16n', feedback: 0.2, wet: 0.2 },
      { type: 'reverb', roomSize: 0.6, wet: 0.28 },
    ],
    gain: -4,
  },
  {
    id: 'synthPad',
    label: 'Warme Fläche',
    family: 'Synth',
    hint: 'Legt sich als Teppich unter alles',
    emoji: '🌫️',
    low: 36,
    high: 88,
    voice: 'synth',
    options: {
      oscillator: { type: 'fatsawtooth', count: 4, spread: 40 },
      envelope: { attack: 0.7, decay: 0.6, sustain: 0.8, release: 1.8 },
    },
    fx: [
      { type: 'filter', frequency: 2400, rolloff: -24 },
      { type: 'chorus', frequency: 0.6, delayTime: 5, depth: 0.7, wet: 0.5 },
      { type: 'reverb', roomSize: 0.88, wet: 0.45 },
    ],
    gain: -6,
  },
  {
    id: 'choirPad',
    label: 'Chor-Fläche',
    family: 'Chor',
    hint: 'Schwebende Stimmen, sehr feierlich',
    emoji: '👥',
    low: 40,
    high: 88,
    voice: 'am',
    options: {
      harmonicity: 1.5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.8, decay: 0.5, sustain: 0.9, release: 2.2 },
      modulation: { type: 'triangle' },
    },
    fx: [
      { type: 'vibrato', frequency: 4.2, depth: 0.08 },
      { type: 'chorus', frequency: 0.4, delayTime: 8, depth: 0.8, wet: 0.6 },
      { type: 'reverb', roomSize: 0.92, wet: 0.55 },
    ],
    gain: -4,
  },
  {
    id: 'dreamy',
    label: 'Traumsynth',
    family: 'Synth',
    hint: 'Verhallt und verträumt, viel Echo',
    emoji: '🌙',
    low: 48,
    high: 100,
    voice: 'fm',
    options: {
      harmonicity: 2,
      modulationIndex: 5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.7, sustain: 0.2, release: 1.4 },
    },
    fx: [
      { type: 'delay', delayTime: '4n.', feedback: 0.42, wet: 0.35 },
      { type: 'reverb', roomSize: 0.92, wet: 0.5 },
    ],
  },

  // -------------------------------------------------------------------- Bass
  sampled('bass', 'E-Bass', 'Bass', 'Echter Bass für das Fundament', '🎸', 'bass-electric', 28, 60, [
    { type: 'filter', frequency: 3000 },
  ]),
  {
    id: 'synthBass',
    label: 'Synth-Bass',
    family: 'Bass',
    hint: 'Drückend und elektronisch',
    emoji: '🎚️',
    low: 26,
    high: 58,
    voice: 'mono',
    options: {
      oscillator: { type: 'square' },
      envelope: { attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.2 },
      filter: { Q: 6, type: 'lowpass', rolloff: -24 },
      filterEnvelope: {
        attack: 0.005,
        decay: 0.16,
        sustain: 0.2,
        release: 0.2,
        baseFrequency: 70,
        octaves: 3.6,
      },
    },
    fx: [{ type: 'distortion', amount: 0.18, wet: 0.3 }, { type: 'filter', frequency: 2600 }],
    gain: -3,
  },
  {
    id: 'subBass',
    label: 'Sub-Bass',
    family: 'Bass',
    hint: 'Nur Tiefe — spürt man mehr als man hört',
    emoji: '🔉',
    low: 24,
    high: 52,
    voice: 'synth',
    options: {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.7, release: 0.4 },
    },
    fx: [{ type: 'filter', frequency: 400 }],
  },

  // ------------------------------------------------------------------- Drums
  {
    id: 'drums',
    label: 'Drumkit',
    family: 'Drums',
    hint: 'Kick, Snare, Hi-Hat — dein Beatbox-Beat',
    emoji: '🥁',
    low: 0,
    high: 0,
    voice: 'drums',
  },
]

export const FAMILY_ORDER: Family[] = [
  'Streicher',
  'Bläser',
  'Tasten',
  'Zupf',
  'Synth',
  'Chor',
  'Bass',
  'Drums',
]

export function preset(id: InstrumentId): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]
}

export function presetsByFamily(family: Family): Preset[] {
  return PRESETS.filter((p) => p.family === family)
}

/** Presets worth offering for a hummed melody — everything but drums and sub. */
export const MELODIC_PRESETS = PRESETS.filter((p) => p.voice !== 'drums')

/** Instruments that are real recordings rather than synthesis. */
export const SAMPLED_PRESETS = PRESETS.filter((p) => p.voice === 'sampler')
