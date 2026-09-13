import type { InstrumentId } from '../types'

export type Family =
  | 'Streichinstrumente'
  | 'Blasinstrumente'
  | 'Tasteninstrumente'
  | 'Zupfinstrumente'
  | 'Stabspiele'
  | 'Synthesizer'
  | 'Chor'
  | 'Bass'
  | 'Schlagzeug'

export type VoiceKind = 'synth' | 'fm' | 'am' | 'mono' | 'drums' | 'sampler'

export type FxSpec =
  | {
      type: 'filter'
      frequency: number
      kind?: BiquadFilterType
      rolloff?: -12 | -24 | -48
      Q?: number
      /** Only for peaking and shelf filters, in dB */
      gain?: number
    }
  | { type: 'vibrato'; frequency: number; depth: number }
  | { type: 'chorus'; frequency: number; delayTime: number; depth: number; wet: number }
  | { type: 'reverb'; roomSize: number; dampening?: number; wet: number }
  | { type: 'delay'; delayTime: string; feedback: number; wet: number }
  | { type: 'distortion'; amount: number; wet: number; oversample?: '2x' | '4x' | 'none' }
  | { type: 'gain'; db: number }
  | { type: 'tremolo'; frequency: number; depth: number; wet: number }
  | { type: 'bitcrush'; bits: number; wet: number }

export interface Preset {
  id: InstrumentId
  label: string
  family: Family
  /** One line the UI shows while you are picking */
  hint: string
  emoji: string
  /** Words people might search for — spellings, relatives, genres */
  tags?: string[]
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
  /** Natural release in seconds, used as the centre of the Ausklang control */
  release?: number
}

const room = (roomSize: number, wet: number, dampening = 3000): FxSpec => ({
  type: 'reverb',
  roomSize,
  dampening,
  wet,
})

/** A preset backed by real recordings under public/samples. */
function real(
  id: string,
  label: string,
  family: Family,
  hint: string,
  emoji: string,
  sample: string,
  low: number,
  high: number,
  options: {
    fx?: FxSpec[]
    tags?: string[]
    gain?: number
    release?: number
    attack?: number
  } = {},
): Preset {
  return {
    id,
    label,
    family,
    hint,
    emoji,
    sample,
    low,
    high,
    voice: 'sampler',
    tags: options.tags,
    fx: options.fx ?? [room(0.55, 0.2)],
    gain: options.gain ?? 0,
    release: options.release ?? 0.8,
    options: {
      release: options.release ?? 0.8,
      ...(options.attack !== undefined ? { attack: options.attack } : {}),
    },
  }
}

export const PRESETS: Preset[] = [
  // ------------------------------------------------------ Streichinstrumente
  real('violin', 'Violine', 'Streichinstrumente', 'Gestrichene Geige, singend und beweglich', '🎻', 'violin', 55, 91, {
    tags: ['geige', 'fiddle', 'streicher', 'klassik'],
    fx: [room(0.7, 0.26, 2800)],
    release: 0.9,
  }),
  real('strings', 'Streichorchester', 'Streichinstrumente', 'Viele Geigen zusammen, breit und getragen', '🎼', 'violin', 48, 88, {
    tags: ['ensemble', 'orchester', 'film', 'streicher'],
    fx: [
      { type: 'chorus', frequency: 0.45, delayTime: 8, depth: 0.75, wet: 0.55 },
      room(0.92, 0.45, 2400),
    ],
    attack: 0.35,
    release: 1.8,
    gain: -3,
  }),
  real('cello', 'Cello', 'Streichinstrumente', 'Tiefe Streicher, warm und tragend', '🎻', 'cello', 36, 74, {
    tags: ['violoncello', 'streicher', 'tief'],
    fx: [room(0.75, 0.28, 2000)],
    release: 1,
  }),
  real('contrabass', 'Kontrabass', 'Streichinstrumente', 'Das tiefste Streichinstrument, gestrichen', '🎻', 'contrabass', 28, 60, {
    tags: ['bass', 'streicher', 'orchester', 'jazz'],
    fx: [room(0.6, 0.2, 1500)],
    release: 0.9,
  }),
  real('psaltery', 'Psalterium', 'Streichinstrumente', 'Gestrichene Zither, gläsern und schwebend', '🪕', 'psaltery', 57, 84, {
    tags: ['zither', 'mittelalter', 'bogen', 'psalter'],
    fx: [room(0.85, 0.4)],
    release: 1.4,
  }),

  // --------------------------------------------------------- Blasinstrumente
  real('flute', 'Querflöte', 'Blasinstrumente', 'Luftig und hell, die klassische Flöte', '🪈', 'flute', 60, 96, {
    tags: ['floete', 'flöte', 'orchester'],
    fx: [room(0.62, 0.26)],
  }),
  real('recorder', 'Blockflöte', 'Blasinstrumente', 'Sopranblockflöte, klar und schlicht', '🪈', 'recorder', 60, 91, {
    tags: ['sopran', 'barock', 'floete', 'flöte', 'schule'],
    fx: [room(0.6, 0.24)],
  }),
  real('recorderAlto', 'Altblockflöte', 'Blasinstrumente', 'Tiefer und runder als die Sopranflöte', '🪈', 'recorderAlto', 53, 84, {
    tags: ['alt', 'barock', 'floete', 'flöte'],
    fx: [room(0.65, 0.26)],
  }),
  real('ocarina', 'Okarina', 'Blasinstrumente', 'Rund und hohl, fast wie ein Pfeifton', '🏺', 'ocarina', 57, 84, {
    tags: ['ocarina', 'gefaessfloete', 'zelda', 'ton'],
    fx: [room(0.7, 0.3)],
  }),
  real('clarinet', 'Klarinette', 'Blasinstrumente', 'Rund und holzig, sehr gesanglich', '🎶', 'clarinet', 50, 86, {
    tags: ['holzblaeser', 'klassik', 'klezmer'],
    fx: [room(0.55, 0.2)],
  }),
  real('bassoon', 'Fagott', 'Blasinstrumente', 'Tiefes Holz, näselnd und markant', '🎶', 'bassoon', 41, 74, {
    tags: ['holzblaeser', 'orchester', 'tief'],
    fx: [room(0.6, 0.22, 2200)],
  }),
  real('sax', 'Saxophon', 'Blasinstrumente', 'Rauchig, mit Biss — Jazz pur', '🎷', 'saxophone', 50, 84, {
    tags: ['jazz', 'blues', 'tenor', 'sax'],
    fx: [room(0.6, 0.22)],
  }),
  real('trumpet', 'Trompete', 'Blasinstrumente', 'Strahlend und vorlaut', '🎺', 'trumpet', 53, 86, {
    tags: ['blech', 'fanfare', 'jazz', 'ska'],
    fx: [room(0.55, 0.2)],
  }),
  real('trombone', 'Posaune', 'Blasinstrumente', 'Warm und breit, mit Schmelz', '🎺', 'trombone', 40, 72, {
    tags: ['blech', 'ska', 'big band'],
    fx: [room(0.6, 0.22)],
  }),
  real('frenchHorn', 'Waldhorn', 'Blasinstrumente', 'Weich und weit, wie aus der Ferne', '📯', 'french-horn', 41, 77, {
    tags: ['horn', 'blech', 'film', 'orchester'],
    fx: [room(0.85, 0.36, 2200)],
    release: 1.1,
  }),
  real('tuba', 'Tuba', 'Blasinstrumente', 'Das tiefste Blech, mächtig und rund', '🎺', 'tuba', 29, 58, {
    tags: ['blech', 'blasmusik', 'oompah', 'tief'],
    fx: [room(0.65, 0.24, 1800)],
  }),
  real('harmonica', 'Mundharmonika', 'Blasinstrumente', 'Blues-Harp, rau und beweglich', '🎵', 'harmonica', 48, 84, {
    tags: ['blues', 'harp', 'folk', 'country'],
    fx: [room(0.5, 0.18)],
  }),
  real('accordion', 'Akkordeon', 'Blasinstrumente', 'Zieharmonika — Volksmusik, Chanson, Polka', '🪗', 'accordion', 46, 84, {
    tags: ['zieharmonika', 'folk', 'chanson', 'polka', 'schifferklavier'],
    fx: [room(0.6, 0.22)],
    release: 0.25,
  }),
  {
    id: 'panflute',
    label: 'Panflöte',
    family: 'Blasinstrumente',
    hint: 'Hauchig und weit — elektronisch nachgebaut',
    emoji: '🪈',
    tags: ['panfloete', 'anden', 'synth'],
    low: 58,
    high: 92,
    voice: 'am',
    options: {
      harmonicity: 2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.11, decay: 0.2, sustain: 0.75, release: 0.5 },
      modulation: { type: 'square' },
    },
    fx: [{ type: 'vibrato', frequency: 4.8, depth: 0.1 }, room(0.85, 0.38, 2400)],
    release: 0.5,
  },

  // -------------------------------------------------------- Tasteninstrumente
  real('piano', 'Flügel', 'Tasteninstrumente', 'Klassisches Klavier', '🎹', 'piano', 28, 96, {
    tags: ['klavier', 'piano', 'grand', 'tasten'],
    fx: [room(0.5, 0.15)],
    release: 1.2,
  }),
  real('harpsichord', 'Cembalo', 'Tasteninstrumente', 'Gezupfte Tasten, barock und silbrig', '🎹', 'harpsichord', 36, 88, {
    tags: ['barock', 'bach', 'kielfluegel', 'tasten'],
    fx: [room(0.6, 0.22)],
    release: 0.6,
  }),
  real('organ', 'Orgel', 'Tasteninstrumente', 'Durchgehend und tragend, wie in der Kirche', '🎹', 'organ', 36, 92, {
    tags: ['kirche', 'pfeifen', 'tasten', 'rock'],
    fx: [room(0.85, 0.32)],
    release: 0.15,
  }),
  real('harmonium', 'Harmonium', 'Tasteninstrumente', 'Schnurrendes Zungenorgel-Timbre', '🎹', 'harmonium', 36, 84, {
    tags: ['indien', 'orgel', 'folk', 'tasten'],
    fx: [room(0.7, 0.26)],
    release: 0.35,
  }),
  real('wurlitzer', 'Wurlitzer E-Piano', 'Tasteninstrumente', 'Echtes Vintage-E-Piano, bellend und warm', '🎹', 'wurlitzer', 33, 96, {
    tags: ['rhodes', 'vintage', 'soul', 'jazz', 'lofi', 'e-piano'],
    fx: [
      { type: 'tremolo', frequency: 5.2, depth: 0.22, wet: 0.3 },
      room(0.55, 0.2),
    ],
    release: 0.9,
  }),
  {
    id: 'epiano',
    label: 'E-Piano',
    family: 'Tasteninstrumente',
    hint: 'Weich und glockig, sehr 70er — elektronisch erzeugt',
    emoji: '🎹',
    tags: ['rhodes', 'wurlitzer', 'soul', 'lofi', 'synth'],
    low: 32,
    high: 96,
    voice: 'fm',
    options: {
      harmonicity: 3.01,
      modulationIndex: 14,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.003, decay: 1.1, sustain: 0.12, release: 0.8 },
      modulationEnvelope: { attack: 0.002, decay: 0.25, sustain: 0, release: 0.2 },
    },
    fx: [{ type: 'chorus', frequency: 1.2, delayTime: 3, depth: 0.4, wet: 0.35 }, room(0.55, 0.2)],
    release: 0.8,
  },

  // ---------------------------------------------------------- Zupfinstrumente
  real('guitarNylon', 'Konzertgitarre', 'Zupfinstrumente', 'Warme Nylonsaiten, gezupft', '🎸', 'guitar-nylon', 40, 84, {
    tags: ['gitarre', 'klassik', 'spanisch', 'nylon'],
    fx: [room(0.55, 0.2)],
    release: 1,
  }),
  real('guitarSteel', 'Westerngitarre', 'Zupfinstrumente', 'Stahlsaiten, hell und drahtig', '🎸', 'guitar-acoustic', 40, 84, {
    tags: ['gitarre', 'folk', 'country', 'akustik'],
    fx: [room(0.55, 0.2)],
    release: 1,
  }),
  real('guitarClean', 'E-Gitarre clean', 'Zupfinstrumente', 'Echte E-Gitarre, klar und mit Federhall', '🎸', 'guitarTwang', 40, 86, {
    tags: ['gitarre', 'clean', 'surf', 'indie', 'e-gitarre'],
    fx: [
      { type: 'filter', frequency: 90, kind: 'highpass', rolloff: -12 },
      { type: 'tremolo', frequency: 4.5, depth: 0.28, wet: 0.28 },
      room(0.66, 0.28),
    ],
    release: 1,
  }),
  real('guitarCrunch', 'E-Gitarre angezerrt', 'Zupfinstrumente', 'Angeblasener Amp — Rock-Leads und Riffs', '🎸', 'guitarTwang', 40, 86, {
    tags: ['gitarre', 'rock', 'overdrive', 'lead', 'e-gitarre'],
    fx: [
      { type: 'gain', db: 10 },
      { type: 'filter', frequency: 110, kind: 'highpass', rolloff: -12 },
      { type: 'distortion', amount: 0.7, wet: 1, oversample: '4x' },
      { type: 'filter', frequency: 1300, kind: 'peaking', Q: 0.8, gain: 6 },
      { type: 'filter', frequency: 5000, rolloff: -24 },
      room(0.5, 0.16),
    ],
    gain: -15,
    release: 0.8,
  }),
  real('guitarDist', 'E-Gitarre verzerrt', 'Zupfinstrumente', 'Abgedämpfte Powerchords — Punk, Rock, alles was kracht', '🤘', 'guitarStac', 38, 84, {
    tags: ['gitarre', 'distortion', 'punk', 'rock', 'metal', 'powerchord'],
    // Staccato picking through a cranked amp: cut the mud, push the mids that
    // make a riff cut, then roll the top off the way a speaker cabinet does.
    fx: [
      { type: 'gain', db: 13 },
      { type: 'filter', frequency: 105, kind: 'highpass', rolloff: -12 },
      { type: 'distortion', amount: 0.88, wet: 1, oversample: '4x' },
      { type: 'filter', frequency: 1150, kind: 'peaking', Q: 0.9, gain: 7 },
      { type: 'filter', frequency: 4400, rolloff: -24 },
      room(0.38, 0.1),
    ],
    gain: -17,
    release: 0.35,
  }),
  real('banjo', 'Banjo', 'Zupfinstrumente', 'Hell und schnarrend — Bluegrass und Country', '🪕', 'banjo', 40, 84, {
    tags: ['bluegrass', 'country', 'folk', 'americana'],
    fx: [{ type: 'filter', frequency: 160, kind: 'highpass', rolloff: -12 }, room(0.5, 0.2)],
    release: 0.7,
  }),
  real('ukulele', 'Ukulele', 'Zupfinstrumente', 'Klein, hell und gut gelaunt', '🎸', 'ukulele', 55, 88, {
    tags: ['hawaii', 'folk', 'sommer', 'kleine gitarre'],
    fx: [room(0.55, 0.22)],
    release: 0.8,
  }),
  real('concertharp', 'Konzertharfe', 'Zupfinstrumente', 'Große Harfe, perlend und weit', '🪕', 'concertharp', 28, 100, {
    tags: ['harfe', 'orchester', 'engel', 'glissando'],
    fx: [room(0.82, 0.34)],
    release: 1.6,
  }),
  real('folkharp', 'Volksharfe', 'Zupfinstrumente', 'Kleinere Harfe, intimer und holziger', '🪕', 'folkharp', 36, 88, {
    tags: ['harfe', 'keltisch', 'folk', 'irisch'],
    fx: [room(0.72, 0.3)],
    release: 1.4,
  }),
  real('dantranh', 'Đàn tranh', 'Zupfinstrumente', 'Vietnamesische Wölbbrettzither, hell und biegsam', '🪕', 'dantranh', 45, 84, {
    tags: ['zither', 'asien', 'vietnam', 'koto', 'guzheng'],
    fx: [room(0.7, 0.3)],
    release: 1.2,
  }),
  real('strumstick', 'Strumstick', 'Zupfinstrumente', 'Dreisaitiges Wanderinstrument, rau und einfach', '🪕', 'strumstick', 38, 81, {
    tags: ['dulcimer', 'folk', 'appalachian', 'banjo'],
    fx: [room(0.6, 0.24)],
    release: 1,
  }),

  // ---------------------------------------------------------------- Stabspiele
  real('vibraphone', 'Vibraphon', 'Stabspiele', 'Metallstäbe mit Schweben, sehr jazzig', '🎵', 'vibraphone', 41, 84, {
    tags: ['vibes', 'jazz', 'mallet', 'metall'],
    fx: [{ type: 'tremolo', frequency: 5, depth: 0.4, wet: 0.5 }, room(0.7, 0.3)],
    release: 2,
  }),
  real('marimba', 'Marimba', 'Stabspiele', 'Weiches Holz, warm und freundlich', '🪵', 'marimba', 41, 84, {
    tags: ['mallet', 'holz', 'xylophon', 'afrika'],
    fx: [room(0.55, 0.22)],
    release: 1,
  }),
  real('balafon', 'Balafon', 'Stabspiele', 'Westafrikanisches Xylophon mit Schnarrton', '🪵', 'balafon', 49, 88, {
    tags: ['afrika', 'mallet', 'xylophon', 'kalebasse'],
    fx: [room(0.6, 0.24)],
    release: 0.9,
  }),
  real('steelpan', 'Steeldrum', 'Stabspiele', 'Karibisches Ölfass — Reggae, Calypso, Strand', '🛢️', 'steelpan', 60, 88, {
    tags: ['karibik', 'calypso', 'reggae', 'steelpan', 'trinidad'],
    fx: [room(0.68, 0.3)],
    release: 1.4,
  }),
  real('xylophone', 'Xylophon', 'Stabspiele', 'Hart und hell, springt hervor', '🪵', 'xylophone', 67, 100, {
    tags: ['mallet', 'holz', 'orchester'],
    fx: [room(0.5, 0.2)],
    release: 0.5,
  }),
  real('glockenspiel', 'Glockenspiel', 'Stabspiele', 'Metallisch und glitzernd', '🔔', 'glockenspiel', 67, 103, {
    tags: ['mallet', 'metall', 'celesta', 'spieluhr'],
    fx: [room(0.8, 0.34)],
    release: 1.6,
  }),
  real('tubularbells', 'Röhrenglocken', 'Stabspiele', 'Große Glocken, feierlich und lang', '🔔', 'tubularbells', 48, 77, {
    tags: ['glocken', 'kirche', 'film', 'chimes'],
    fx: [room(0.9, 0.42)],
    release: 3,
  }),
  real('kalimba', 'Kalimba', 'Stabspiele', 'Daumenklavier, rund und holzig', '🪘', 'kalimba', 43, 84, {
    tags: ['mbira', 'afrika', 'daumenklavier', 'lofi'],
    fx: [room(0.6, 0.25)],
    release: 1,
  }),

  // ------------------------------------------------------------- Synthesizer
  {
    id: 'synthLead',
    label: 'Synth Lead',
    family: 'Synthesizer',
    hint: 'Klarer Leadsound, schneidet durch',
    emoji: '⚡',
    tags: ['lead', 'saw', 'elektronisch'],
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
      room(0.55, 0.2),
    ],
    gain: -3,
    release: 0.35,
  },
  {
    id: 'supersaw',
    label: 'Supersaw',
    family: 'Synthesizer',
    hint: 'Breit und laut, moderner Dance-Lead',
    emoji: '🔊',
    tags: ['trance', 'edm', 'dance', 'saw'],
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
      room(0.6, 0.25),
    ],
    gain: -6,
    release: 0.4,
  },
  {
    id: 'squareLead',
    label: 'Chiptune',
    family: 'Synthesizer',
    hint: 'Pieps-Sound wie aus einem alten Spiel',
    emoji: '🕹️',
    tags: ['8bit', 'gameboy', 'square', 'retro'],
    low: 48,
    high: 100,
    voice: 'synth',
    options: {
      oscillator: { type: 'square' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.6, release: 0.1 },
    },
    fx: [{ type: 'bitcrush', bits: 6, wet: 0.5 }, { type: 'filter', frequency: 7000 }],
    gain: -8,
    release: 0.1,
  },
  {
    id: 'pluckSynth',
    label: 'Pluck Synth',
    family: 'Synthesizer',
    hint: 'Kurz angerissen, gut für Rhythmisches',
    emoji: '💧',
    tags: ['house', 'pluck', 'arp', 'deep'],
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
      room(0.6, 0.28),
    ],
    gain: -4,
    release: 0.25,
  },
  {
    id: 'synthPad',
    label: 'Warme Fläche',
    family: 'Synthesizer',
    hint: 'Legt sich als Teppich unter alles',
    emoji: '🌫️',
    tags: ['pad', 'ambient', 'flaeche', 'atmo'],
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
      room(0.88, 0.45),
    ],
    gain: -6,
    release: 1.8,
  },
  {
    id: 'dreamy',
    label: 'Traumsynth',
    family: 'Synthesizer',
    hint: 'Verhallt und verträumt, viel Echo',
    emoji: '🌙',
    tags: ['dream', 'ambient', 'echo', 'lofi'],
    low: 48,
    high: 100,
    voice: 'fm',
    options: {
      harmonicity: 2,
      modulationIndex: 5,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.7, sustain: 0.2, release: 1.4 },
    },
    fx: [{ type: 'delay', delayTime: '4n.', feedback: 0.42, wet: 0.35 }, room(0.92, 0.5)],
    release: 1.4,
  },
  {
    id: 'choirPad',
    label: 'Chor-Fläche',
    family: 'Chor',
    hint: 'Schwebende Stimmen, sehr feierlich',
    emoji: '👥',
    tags: ['chor', 'stimmen', 'film', 'aah'],
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
      room(0.92, 0.55),
    ],
    gain: -4,
    release: 2.2,
  },

  // -------------------------------------------------------------------- Bass
  real('bassGuitar', 'Bassgitarre', 'Bass', 'Gezupfte Bassgitarre mit vollem Tiefgang', '🎸', 'bassGuitar', 23, 57, {
    tags: ['bass', 'funk', 'rock', 'soul', 'motown'],
    fx: [{ type: 'filter', frequency: 3200 }],
    release: 0.7,
  }),
  real('bass', 'E-Bass', 'Bass', 'Gezupfter Elektrobass für das Fundament', '🎸', 'bass-electric', 28, 60, {
    tags: ['bassgitarre', 'funk', 'rock', 'pop'],
    fx: [{ type: 'filter', frequency: 3000 }],
    release: 0.6,
  }),
  {
    id: 'synthBass',
    label: 'Synth-Bass',
    family: 'Bass',
    hint: 'Drückend und elektronisch',
    emoji: '🎚️',
    tags: ['808', 'elektronisch', 'techno', 'house'],
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
    release: 0.2,
  },
  {
    id: 'subBass',
    label: 'Sub-Bass',
    family: 'Bass',
    hint: 'Nur Tiefe — spürt man mehr als man hört',
    emoji: '🔉',
    tags: ['808', 'sub', 'dnb', 'dubstep'],
    low: 24,
    high: 52,
    voice: 'synth',
    options: {
      oscillator: { type: 'sine' },
      envelope: { attack: 0.02, decay: 0.3, sustain: 0.7, release: 0.4 },
    },
    fx: [{ type: 'filter', frequency: 400 }],
    release: 0.4,
  },

  // --------------------------------------------------------------- Schlagzeug
  {
    id: 'drums',
    label: 'Drumkit',
    family: 'Schlagzeug',
    hint: 'Kick, Snare, Hi-Hat — dein Beatbox-Beat',
    emoji: '🥁',
    tags: ['schlagzeug', 'beat', 'percussion'],
    low: 0,
    high: 0,
    voice: 'drums',
  },
]

export const FAMILY_ORDER: Family[] = [
  'Streichinstrumente',
  'Blasinstrumente',
  'Tasteninstrumente',
  'Zupfinstrumente',
  'Stabspiele',
  'Synthesizer',
  'Chor',
  'Bass',
  'Schlagzeug',
]

export function preset(id: InstrumentId): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0]
}

export function presetsByFamily(family: Family): Preset[] {
  return PRESETS.filter((p) => p.family === family)
}

/** Presets worth offering for a hummed melody — everything but the drum kit. */
export const MELODIC_PRESETS = PRESETS.filter((p) => p.voice !== 'drums')

/** Instruments that are real recordings rather than synthesis. */
export const SAMPLED_PRESETS = PRESETS.filter((p) => p.voice === 'sampler')

/** Free-text search across names, descriptions and tags. */
export function searchPresets(query: string): Preset[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const words = needle.split(/\s+/)
  return MELODIC_PRESETS.map((p) => {
    const haystack = `${p.label} ${p.family} ${p.hint} ${(p.tags ?? []).join(' ')}`.toLowerCase()
    let score = 0
    for (const word of words) {
      if (p.label.toLowerCase().startsWith(word)) score += 6
      else if (p.label.toLowerCase().includes(word)) score += 4
      else if ((p.tags ?? []).some((t) => t.includes(word))) score += 3
      else if (haystack.includes(word)) score += 1
    }
    return { p, score }
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.p)
}
