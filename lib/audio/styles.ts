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
    colors: ['#34d399', '#0f766e'],
    motif: 'pulse',
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
    colors: ['#4ade80', '#065f46'],
    motif: 'pixel',
  },
]

export function style(id: string): Style {
  return STYLES.find((s) => s.id === id) ?? STYLES[0]
}

/** Instrument palette the song split hands to its generated lanes. */
export function stylePalette(id: string): InstrumentId[] {
  const s = style(id)
  return [s.bass, s.chords, s.lead, s.alternates[0] ?? s.lead]
}
