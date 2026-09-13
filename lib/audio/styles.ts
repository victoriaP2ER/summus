import type { InstrumentId } from '../types'

export type Motif =
  | 'grid'
  | 'sun'
  | 'disco'
  | 'bolt'
  | 'arcs'
  | 'film'
  | 'waves'
  | 'campfire'
  | 'sparkle'
  | 'horn'
  | 'pixel'
  | 'pulse'
  | 'amp'
  | 'crystal'
  | 'bars'
  | 'leaf'
  | 'ring'

export interface Style {
  id: string
  label: string
  emoji: string
  /** What it sounds like, in one line a non-musician understands */
  hint: string
  bpm: number
  scaleId: string
  /** Instruments for each role in the arrangement */
  lead: InstrumentId
  chords: InstrumentId
  bass: InstrumentId
  /** Two alternative leads offered next to the main one */
  alternates: InstrumentId[]
  /** Everything worth trying in this style, keys included — every genre has
   *  some kind of keyboard, it just looks different each time. */
  picks: InstrumentId[]
  /** Artwork shown while picking — gradient plus a simple motif */
  colors: [string, string]
  motif: Motif
}

/**
 * A style is a shortcut past the instrument list: pick a direction you can
 * picture, get a set that already works together.
 */
export const STYLES: Style[] = [
  {
    id: 'synthwave',
    label: '80s Synthwave',
    emoji: '🌆',
    hint: 'Neon, breite Synths, treibender Bass',
    bpm: 112,
    scaleId: 'minor',
    lead: 'supersaw',
    chords: 'synthPad',
    bass: 'synthBass',
    alternates: ['synthLead', 'dreamy'],
    picks: ['supersaw', 'synthLead', 'squareLead', 'pluckSynth', 'synthPad', 'dreamy', 'epiano', 'organ', 'choirPad', 'synthBass', 'subBass'],
    colors: ['#f472b6', '#7c3aed'],
    motif: 'sun',
  },
  {
    id: 'frenchHouse',
    label: 'French House',
    emoji: '🪩',
    hint: 'Daft-Punk-Gefühl: kurze Plucks, tanzbarer Bass',
    bpm: 122,
    scaleId: 'minor',
    lead: 'pluckSynth',
    chords: 'epiano',
    bass: 'synthBass',
    alternates: ['supersaw', 'organ'],
    picks: ['pluckSynth', 'supersaw', 'epiano', 'organ', 'synthPad', 'guitarClean', 'dreamy', 'squareLead', 'synthBass', 'bass'],
    colors: ['#fbbf24', '#f43f5e'],
    motif: 'disco',
  },
  {
    id: 'punk',
    label: 'Punk Rock',
    emoji: '🤘',
    hint: 'Verzerrte Gitarren, schnell und laut',
    bpm: 168,
    scaleId: 'major',
    lead: 'guitarDist',
    chords: 'guitarClean',
    bass: 'bass',
    alternates: ['organ', 'squareLead'],
    picks: ['guitarDist', 'guitarClean', 'organ', 'piano', 'squareLead', 'synthLead', 'trumpet', 'bass', 'synthBass'],
    colors: ['#f43f5e', '#1f2937'],
    motif: 'bolt',
  },
  {
    id: 'orchestra',
    label: 'Orchester',
    emoji: '🎻',
    hint: 'Streicher und Bläser, wie im Konzertsaal',
    bpm: 84,
    scaleId: 'minor',
    lead: 'violinSolo',
    chords: 'strings',
    bass: 'cello',
    alternates: ['flute', 'brass'],
    picks: ['violinSolo', 'violin', 'strings', 'cello', 'contrabass', 'flute', 'clarinet', 'frenchHorn', 'brass', 'harp', 'piano'],
    colors: ['#fcd34d', '#92400e'],
    motif: 'arcs',
  },
  {
    id: 'cinematic',
    label: 'Filmmusik',
    emoji: '🎬',
    hint: 'Groß und episch, mit Chor darunter',
    bpm: 90,
    scaleId: 'harmonicMinor',
    lead: 'strings',
    chords: 'choirPad',
    bass: 'cello',
    alternates: ['brass', 'violinSolo'],
    picks: ['strings', 'choirPad', 'brass', 'frenchHorn', 'trombone', 'cello', 'violinSolo', 'piano', 'harp', 'dreamy', 'subBass'],
    colors: ['#60a5fa', '#1e1b4b'],
    motif: 'film',
  },
  {
    id: 'lofi',
    label: 'Lo-Fi Chill',
    emoji: '🛋️',
    hint: 'Entspannt, verwaschenes E-Piano, weicher Bass',
    bpm: 78,
    scaleId: 'dorian',
    lead: 'epiano',
    chords: 'dreamy',
    bass: 'subBass',
    alternates: ['marimba', 'kalimba'],
    picks: ['epiano', 'piano', 'dreamy', 'marimba', 'kalimba', 'guitarNylon', 'harp', 'synthPad', 'organ', 'subBass'],
    colors: ['#a78bfa', '#4c1d95'],
    motif: 'waves',
  },
  {
    id: 'folk',
    label: 'Lagerfeuer',
    emoji: '🔥',
    hint: 'Akustische Gitarre und Flöte, ganz ohne Strom',
    bpm: 100,
    scaleId: 'major',
    lead: 'guitarNylon',
    chords: 'harp',
    bass: 'bass',
    alternates: ['flute', 'panflute'],
    picks: ['guitarNylon', 'guitarSteel', 'flute', 'panflute', 'harp', 'violin', 'clarinet', 'piano', 'marimba', 'bass'],
    colors: ['#fb923c', '#7c2d12'],
    motif: 'campfire',
  },
  {
    id: 'musicbox',
    label: 'Spieluhr',
    emoji: '✨',
    hint: 'Zart und märchenhaft, viel Glitzern',
    bpm: 88,
    scaleId: 'major',
    lead: 'celesta',
    chords: 'harp',
    bass: 'subBass',
    alternates: ['glockenspiel', 'kalimba'],
    picks: ['celesta', 'glockenspiel', 'harp', 'xylophone', 'marimba', 'kalimba', 'piano', 'flute', 'choirPad', 'subBass'],
    colors: ['#f9a8d4', '#818cf8'],
    motif: 'sparkle',
  },
  {
    id: 'jazz',
    label: 'Jazz',
    emoji: '🎷',
    hint: 'Saxophon über weichem E-Piano',
    bpm: 104,
    scaleId: 'mixolydian',
    lead: 'sax',
    chords: 'epiano',
    bass: 'bass',
    alternates: ['trumpet', 'clarinet'],
    picks: ['sax', 'trumpet', 'trombone', 'epiano', 'piano', 'organ', 'guitarClean', 'clarinet', 'contrabass', 'bass'],
    colors: ['#f59e0b', '#7f1d1d'],
    motif: 'horn',
  },
  {
    id: 'gridrunner',
    label: 'Gitterläufer',
    emoji: '🟦',
    hint: 'Kaltes digitales Neon — Synths wie aus einem Computer-Raster',
    bpm: 128,
    scaleId: 'minor',
    lead: 'squareLead',
    chords: 'synthPad',
    bass: 'synthBass',
    alternates: ['supersaw', 'dreamy'],
    picks: ['squareLead', 'supersaw', 'synthLead', 'synthPad', 'dreamy', 'organ', 'epiano', 'pluckSynth', 'synthBass', 'subBass'],
    colors: ['#22d3ee', '#1e3a8a'],
    motif: 'grid',
  },
  {
    id: 'dnb',
    label: 'Drum & Bass',
    emoji: '🔊',
    hint: 'Festival-Tempo, harte Breaks und ein Bass der drückt',
    bpm: 174,
    scaleId: 'minor',
    lead: 'pluckSynth',
    chords: 'dreamy',
    bass: 'subBass',
    alternates: ['supersaw', 'squareLead'],
    picks: ['pluckSynth', 'supersaw', 'squareLead', 'dreamy', 'synthPad', 'epiano', 'organ', 'subBass', 'synthBass'],
    colors: ['#34d399', '#0f766e'],
    motif: 'pulse',
  },
  {
    id: 'jrpg',
    label: 'Videospiel-Epos',
    emoji: '⚔️',
    hint: 'Große Abenteuermusik: Streicher, Glocken und eine Melodie zum Mitsummen',
    bpm: 104,
    scaleId: 'minor',
    lead: 'flute',
    chords: 'strings',
    bass: 'contrabass',
    alternates: ['glockenspiel', 'concertharp'],
    picks: ['flute','strings','concertharp','glockenspiel','piano','choirPad','frenchHorn','marimba','vibraphone','epiano','dreamy','contrabass'],
    colors: ['#60a5fa', '#4c1d95'],
    motif: 'crystal',
  },
  {
    id: 'trap',
    label: 'Trap',
    emoji: '💎',
    hint: 'Wenig Beat, viel Platz — tiefe 808er und flirrende Hi-Hats',
    bpm: 140,
    scaleId: 'minor',
    lead: 'epiano',
    chords: 'dreamy',
    bass: 'subBass',
    alternates: ['glockenspiel', 'harp'],
    picks: ['epiano','dreamy','glockenspiel','concertharp','piano','marimba','vibraphone','choirPad','subBass','synthBass'],
    colors: ['#a78bfa', '#111827'],
    motif: 'bars',
  },
  {
    id: 'reggae',
    label: 'Reggae',
    emoji: '🌴',
    hint: 'Akkorde auf den Offbeats, tiefer Bass, viel Entspannung',
    bpm: 76,
    scaleId: 'minor',
    lead: 'organ',
    chords: 'guitarClean',
    bass: 'bass',
    alternates: ['trumpet', 'sax'],
    picks: ['organ','guitarClean','guitarNylon','trumpet','trombone','sax','piano','epiano','bass','harmonica'],
    colors: ['#4ade80', '#14532d'],
    motif: 'leaf',
  },
  {
    id: 'disco',
    label: 'Disco',
    emoji: '🕺',
    hint: 'Vier auf die Eins, Streicher-Stabs und ein hüpfender Bass',
    bpm: 118,
    scaleId: 'minor',
    lead: 'strings',
    chords: 'epiano',
    bass: 'bass',
    alternates: ['guitarClean', 'trumpet'],
    picks: ['strings','epiano','piano','guitarClean','trumpet','trombone','sax','organ','bass','vibraphone'],
    colors: ['#f472b6', '#7c3aed'],
    motif: 'disco',
  },
  {
    id: 'bossa',
    label: 'Bossa Nova',
    emoji: '🍸',
    hint: 'Nylonsaiten und leiser Groove, wie ein Abend am Meer',
    bpm: 128,
    scaleId: 'dorian',
    lead: 'flute',
    chords: 'guitarNylon',
    bass: 'contrabass',
    alternates: ['sax', 'vibraphone'],
    picks: ['guitarNylon','flute','sax','vibraphone','piano','epiano','clarinet','trumpet','contrabass','bass'],
    colors: ['#fbbf24', '#0f766e'],
    motif: 'waves',
  },
  {
    id: 'ambient',
    label: 'Ambient',
    emoji: '🌌',
    hint: 'Kein Schlagzeug, nur Flächen — zum Schweben und Ausprobieren',
    bpm: 68,
    scaleId: 'major',
    lead: 'concertharp',
    chords: 'synthPad',
    bass: 'subBass',
    alternates: ['choirPad', 'glockenspiel'],
    picks: ['synthPad','choirPad','dreamy','concertharp','glockenspiel','tubularbells','vibraphone','flute','strings','subBass'],
    colors: ['#22d3ee', '#312e81'],
    motif: 'ring',
  },
  {
    id: 'chiptune',
    label: '8-Bit',
    emoji: '🕹️',
    hint: 'Wie ein altes Videospiel',
    bpm: 140,
    scaleId: 'major',
    lead: 'squareLead',
    chords: 'pluckSynth',
    bass: 'synthBass',
    alternates: ['glockenspiel', 'organ'],
    picks: ['squareLead', 'pluckSynth', 'glockenspiel', 'xylophone', 'organ', 'epiano', 'supersaw', 'marimba', 'synthBass'],
    colors: ['#4ade80', '#065f46'],
    motif: 'pixel',
  },
]

export function style(id: string): Style {
  return STYLES.find((s) => s.id === id) ?? STYLES[0]
}

/** Everything this style suggests, with the roles first. */
export function styleInstruments(id: string): InstrumentId[] {
  const s = style(id)
  return [...new Set([s.lead, s.chords, s.bass, ...s.alternates, ...s.picks])]
}

/** Instrument palette the song split hands to its generated lanes. */
export function stylePalette(id: string): InstrumentId[] {
  const s = style(id)
  return [s.bass, s.chords, s.lead, s.alternates[0] ?? s.lead]
}
