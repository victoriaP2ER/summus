import { preset } from './presets'
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
  /** Whole band line-ups for this style. Clicking the style again picks the
   *  next one, so the same genre can sound like several records. */
  sets: { lead: InstrumentId; chords: InstrumentId; bass: InstrumentId }[]
  /** Artwork shown while picking — gradient plus a simple motif */
  colors: [string, string]
  motif: Motif
}

/**
 * A style is a shortcut past the instrument list: pick a direction you can
 * picture, get a set that already works together.
 */
const STYLE_DEFS: Style[] = [
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
    sets: [
      { lead: 'supersaw', chords: 'synthPad', bass: 'synthBass' },
      { lead: 'synthLead', chords: 'dreamy', bass: 'subBass' },
      { lead: 'squareLead', chords: 'choirPad', bass: 'synthBass' },
    ],
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
    sets: [
      { lead: 'pluckSynth', chords: 'epiano', bass: 'synthBass' },
      { lead: 'strings', chords: 'piano', bass: 'bass' },
      { lead: 'epiano', chords: 'guitarClean', bass: 'bass' },
    ],
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
    alternates: ['guitarDist', 'guitarClean'],
    picks: ['guitarDist', 'guitarCrunch', 'guitarClean', 'organ', 'piano', 'epiano', 'harmonica', 'trumpet', 'bass', 'bassGuitar'],
    sets: [
      { lead: 'guitarCrunch', chords: 'guitarDist', bass: 'bass' },
      { lead: 'guitarDist', chords: 'guitarClean', bass: 'bass' },
      { lead: 'organ', chords: 'guitarDist', bass: 'bass' },
    ],
    colors: ['#f43f5e', '#1f2937'],
    motif: 'bolt',
  },
  {
    id: 'classicRock',
    label: 'Classic Rock',
    emoji: '🎸',
    hint: 'Breite E-Gitarren über Orgel — zum Reinsingen gemacht',
    bpm: 124,
    scaleId: 'mixolydian',
    lead: 'guitarCrunch',
    chords: 'organ',
    bass: 'bass',
    alternates: ['guitarDist', 'guitarClean'],
    picks: ['guitarCrunch', 'guitarDist', 'guitarClean', 'organ', 'piano', 'epiano', 'bass', 'harmonica', 'sax', 'trumpet', 'wurlitzer', 'bassGuitar'],
    sets: [
      { lead: 'guitarCrunch', chords: 'organ', bass: 'bass' },
      { lead: 'guitarDist', chords: 'guitarClean', bass: 'bass' },
      { lead: 'harmonica', chords: 'wurlitzer', bass: 'bassGuitar' },
    ],
    colors: ['#fb923c', '#7f1d1d'],
    motif: 'amp',
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
    sets: [
      { lead: 'violinSolo', chords: 'strings', bass: 'cello' },
      { lead: 'flute', chords: 'strings', bass: 'contrabass' },
      { lead: 'frenchHorn', chords: 'strings', bass: 'cello' },
    ],
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
    picks: ['strings', 'choirPad', 'brass', 'frenchHorn', 'trombone', 'cello', 'violinSolo', 'piano', 'harp', 'dreamy', 'subBass', 'accordion'],
    sets: [
      { lead: 'strings', chords: 'choirPad', bass: 'cello' },
      { lead: 'frenchHorn', chords: 'strings', bass: 'contrabass' },
      { lead: 'piano', chords: 'choirPad', bass: 'subBass' },
    ],
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
    chords: 'piano',
    bass: 'bass',
    alternates: ['vibraphone', 'guitarNylon'],
    picks: ['epiano', 'piano', 'dreamy', 'marimba', 'kalimba', 'guitarNylon', 'harp', 'synthPad', 'organ', 'subBass', 'wurlitzer', 'bassGuitar'],
    sets: [
      { lead: 'epiano', chords: 'piano', bass: 'bass' },
      { lead: 'vibraphone', chords: 'wurlitzer', bass: 'bassGuitar' },
      { lead: 'guitarNylon', chords: 'piano', bass: 'contrabass' },
    ],
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
    picks: ['guitarNylon', 'guitarSteel', 'flute', 'panflute', 'folkharp', 'violin', 'clarinet', 'harmonica', 'piano', 'bass', 'accordion', 'banjo', 'ukulele'],
    sets: [
      { lead: 'guitarNylon', chords: 'folkharp', bass: 'bass' },
      { lead: 'accordion', chords: 'guitarSteel', bass: 'contrabass' },
      { lead: 'banjo', chords: 'guitarNylon', bass: 'bassGuitar' },
    ],
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
    picks: ['celesta', 'glockenspiel', 'concertharp', 'folkharp', 'xylophone', 'marimba', 'kalimba', 'vibraphone', 'piano', 'flute', 'harmonium', 'tubularbells', 'ukulele'],
    sets: [
      { lead: 'glockenspiel', chords: 'concertharp', bass: 'subBass' },
      { lead: 'vibraphone', chords: 'folkharp', bass: 'contrabass' },
      { lead: 'kalimba', chords: 'harmonium', bass: 'contrabass' },
    ],
    colors: ['#f9a8d4', '#818cf8'],
    motif: 'sparkle',
  },
  {
    id: 'jazz',
    label: 'Jazz',
    emoji: '🎷',
    hint: 'Saxophon über Klavier, Walking Bass und Besen auf dem Ride',
    bpm: 128,
    scaleId: 'major',
    lead: 'sax',
    chords: 'piano',
    bass: 'contrabass',
    alternates: ['trumpet', 'clarinet'],
    picks: ['sax', 'trumpet', 'trombone', 'piano', 'epiano', 'organ', 'guitarClean', 'clarinet', 'vibraphone', 'flute', 'contrabass', 'wurlitzer'],
    sets: [
      { lead: 'sax', chords: 'piano', bass: 'contrabass' },
      { lead: 'trumpet', chords: 'wurlitzer', bass: 'contrabass' },
      { lead: 'clarinet', chords: 'piano', bass: 'contrabass' },
    ],
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
    sets: [
      { lead: 'squareLead', chords: 'synthPad', bass: 'synthBass' },
      { lead: 'supersaw', chords: 'dreamy', bass: 'subBass' },
      { lead: 'pluckSynth', chords: 'organ', bass: 'synthBass' },
    ],
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
    sets: [
      { lead: 'pluckSynth', chords: 'dreamy', bass: 'subBass' },
      { lead: 'supersaw', chords: 'synthPad', bass: 'synthBass' },
      { lead: 'epiano', chords: 'choirPad', bass: 'subBass' },
    ],
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
    picks: ['flute', 'strings', 'concertharp', 'glockenspiel', 'piano', 'choirPad', 'frenchHorn', 'marimba', 'vibraphone', 'epiano', 'dreamy', 'contrabass', 'accordion'],
    sets: [
      { lead: 'flute', chords: 'strings', bass: 'contrabass' },
      { lead: 'glockenspiel', chords: 'concertharp', bass: 'cello' },
      { lead: 'frenchHorn', chords: 'choirPad', bass: 'contrabass' },
    ],
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
    picks: ['epiano', 'dreamy', 'glockenspiel', 'concertharp', 'piano', 'marimba', 'vibraphone', 'choirPad', 'subBass', 'synthBass', 'wurlitzer'],
    sets: [
      { lead: 'glockenspiel', chords: 'dreamy', bass: 'subBass' },
      { lead: 'epiano', chords: 'synthPad', bass: 'subBass' },
      { lead: 'concertharp', chords: 'piano', bass: 'subBass' },
    ],
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
    picks: ['organ', 'guitarClean', 'guitarNylon', 'trumpet', 'trombone', 'sax', 'piano', 'epiano', 'harmonica', 'vibraphone', 'bass', 'steelpan', 'bassGuitar'],
    sets: [
      { lead: 'organ', chords: 'guitarClean', bass: 'bass' },
      { lead: 'trumpet', chords: 'guitarNylon', bass: 'bass' },
      { lead: 'steelpan', chords: 'organ', bass: 'bassGuitar' },
    ],
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
    chords: 'piano',
    bass: 'bass',
    alternates: ['trumpet', 'sax'],
    picks: ['strings', 'epiano', 'piano', 'guitarClean', 'trumpet', 'trombone', 'sax', 'organ', 'bass', 'vibraphone', 'wurlitzer', 'bassGuitar'],
    sets: [
      { lead: 'strings', chords: 'piano', bass: 'bass' },
      { lead: 'trumpet', chords: 'guitarClean', bass: 'bass' },
      { lead: 'sax', chords: 'wurlitzer', bass: 'bassGuitar' },
    ],
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
    picks: ['guitarNylon', 'flute', 'sax', 'vibraphone', 'piano', 'epiano', 'clarinet', 'trumpet', 'contrabass', 'bass', 'wurlitzer', 'ukulele'],
    sets: [
      { lead: 'flute', chords: 'guitarNylon', bass: 'contrabass' },
      { lead: 'sax', chords: 'piano', bass: 'contrabass' },
      { lead: 'vibraphone', chords: 'guitarNylon', bass: 'bass' },
    ],
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
    sets: [
      { lead: 'concertharp', chords: 'synthPad', bass: 'subBass' },
      { lead: 'glockenspiel', chords: 'choirPad', bass: 'subBass' },
      { lead: 'flute', chords: 'dreamy', bass: 'subBass' },
    ],
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
    sets: [
      { lead: 'squareLead', chords: 'pluckSynth', bass: 'synthBass' },
      { lead: 'glockenspiel', chords: 'organ', bass: 'synthBass' },
      { lead: 'marimba', chords: 'epiano', bass: 'subBass' },
    ],
    colors: ['#4ade80', '#065f46'],
    motif: 'pixel',
  },
]

/**
 * The order they are offered in: the broadly recognisable directions first,
 * the more particular ones at the end.
 */
const DISPLAY_ORDER = [
  'synthwave',
  'classicRock',
  'punk',
  'lofi',
  'trap',
  'disco',
  'frenchHouse',
  'dnb',
  'jazz',
  'orchestra',
  'cinematic',
  'jrpg',
  'reggae',
  'bossa',
  'gridrunner',
  'chiptune',
  'ambient',
  'folk',
  'musicbox',
]

export const STYLES: Style[] = [...STYLE_DEFS].sort(
  (a, b) =>
    (DISPLAY_ORDER.indexOf(a.id) + 1 || 99) - (DISPLAY_ORDER.indexOf(b.id) + 1 || 99),
)

export function style(id: string): Style {
  return STYLE_DEFS.find((s) => s.id === id) ?? STYLE_DEFS[0]
}

const BASS_FAMILIES = new Set(['Bass'])
const CHORD_FAMILIES = new Set([
  'Tasteninstrumente',
  'Zupfinstrumente',
  'Streichinstrumente',
  'Synthesizer',
  'Chor',
])

/** Everything in this style's pool that can hold down each role. */
function pools(id: string): { lead: InstrumentId[]; chords: InstrumentId[]; bass: InstrumentId[] } {
  const s = style(id)
  const all = [...new Set([...s.picks, ...s.alternates, s.lead, s.chords, s.bass])]
  const bass = all.filter(
    (i) => BASS_FAMILIES.has(preset(i).family) || ['contrabass', 'tuba'].includes(i),
  )
  const isLow = (i: InstrumentId) => bass.includes(i)
  return {
    lead: all.filter((i) => !isLow(i)),
    // Chords need something that can hold a voicing, not a bass instrument.
    chords: all.filter((i) => CHORD_FAMILIES.has(preset(i).family) && !isLow(i)),
    bass: bass.length ? bass : [s.bass],
  }
}

/**
 * One of the style's line-ups.
 *
 * The first few are written by hand. Beyond those, further line-ups are drawn
 * from the style's own instrument pool — so clicking on for a fifth or sixth
 * variation still changes who is playing, not only what they play.
 */
export function styleSet(
  id: string,
  index: number,
): { lead: InstrumentId; chords: InstrumentId; bass: InstrumentId } {
  const s = style(id)
  const written = s.sets ?? []
  const total = styleSetCount(id)
  const wrapped = ((index % total) + total) % total
  if (wrapped < written.length) return written[wrapped]

  const pool = pools(id)
  const step = wrapped - written.length
  const pickFrom = (list: InstrumentId[], offset: number, fallback: InstrumentId) =>
    list.length ? list[(step * offset + written.length) % list.length] : fallback

  const lead = pickFrom(pool.lead, 3, s.lead)
  // Different offsets keep the three roles from moving in lockstep.
  let chords = pickFrom(pool.chords, 5, s.chords)
  if (chords === lead && pool.chords.length > 1) {
    chords = pool.chords[(pool.chords.indexOf(chords) + 1) % pool.chords.length]
  }
  return { lead, chords, bass: pickFrom(pool.bass, 2, s.bass) }
}

export function styleSetCount(id: string): number {
  const written = style(id).sets?.length ?? 1
  const pool = pools(id)
  // Enough derived line-ups to keep exploring, capped so the cycle stays finite.
  return written + Math.min(6, Math.max(0, pool.lead.length - written))
}

/** Everything this style suggests, with the roles first. */
export function styleInstruments(id: string): InstrumentId[] {
  const s = style(id)
  const fromSets = (s.sets ?? []).flatMap((set) => [set.lead, set.chords, set.bass])
  return [...new Set([s.lead, s.chords, s.bass, ...fromSets, ...s.alternates, ...s.picks])]
}

/** Instrument palette the song split hands to its generated lanes. */
export function stylePalette(id: string): InstrumentId[] {
  const s = style(id)
  return [s.bass, s.chords, s.lead, s.alternates[0] ?? s.lead]
}
