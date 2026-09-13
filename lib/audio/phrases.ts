/**
 * Short melodies for auditioning instruments.
 *
 * Everything here is either public domain (the composer died well over a
 * century ago) or traditional with no known author — plus a couple of plain
 * riffs written for this app, because the electronic genres have no old
 * standard to borrow from.
 */
export interface PhraseNote {
  /** Semitones above the phrase's tonic */
  step: number
  /** Length in beats */
  beats: number
}

export interface Phrase {
  id: string
  label: string
  /** Shown under the player so it is clear what is being played and why it is free to use */
  source: string
  /** Beats per minute the phrase is meant to be heard at */
  bpm: number
  /** Where the tonic sits relative to the instrument's comfortable centre */
  offset: number
  notes: PhraseNote[]
}

const q = (step: number): PhraseNote => ({ step, beats: 1 })
const h = (step: number): PhraseNote => ({ step, beats: 2 })
const e = (step: number): PhraseNote => ({ step, beats: 0.5 })

export const PHRASES: Phrase[] = [
  {
    id: 'ode',
    label: 'Ode an die Freude',
    source: 'Beethoven, 1824 — gemeinfrei',
    bpm: 112,
    offset: 0,
    notes: [
      q(4), q(4), q(5), q(7),
      q(7), q(5), q(4), q(2),
      q(0), q(0), q(2), q(4),
      { step: 4, beats: 1.5 }, e(2), h(2),
    ],
  },
  {
    id: 'elise',
    label: 'Für Elise',
    source: 'Beethoven, 1810 — gemeinfrei',
    bpm: 76,
    offset: 0,
    notes: [
      e(12), e(11), e(12), e(11), e(12), e(7), e(10), e(8),
      { step: 5, beats: 1.5 },
    ],
  },
  {
    id: 'mountain',
    label: 'In der Halle des Bergkönigs',
    source: 'Edvard Grieg, 1875 — gemeinfrei',
    bpm: 116,
    offset: 0,
    notes: [
      e(0), e(3), e(5), e(7), e(3), e(7),
      e(5), e(8), e(7), e(3), e(7), e(3),
      { step: 0, beats: 1.5 },
    ],
  },
  {
    id: 'greensleeves',
    label: 'Greensleeves',
    source: 'englisches Volkslied, 16. Jahrhundert — gemeinfrei',
    bpm: 92,
    offset: 0,
    notes: [
      e(0), q(3), e(5),
      { step: 7, beats: 1.5 }, e(8), e(7),
      q(5), e(2), { step: -1, beats: 1.5 }, e(0), h(2),
    ],
  },
  {
    id: 'saints',
    label: 'When the Saints Go Marching In',
    source: 'amerikanisches Traditional — gemeinfrei',
    bpm: 118,
    offset: 0,
    notes: [q(0), q(4), q(5), h(7), q(0), q(4), q(5), h(7), q(0), q(4), q(5), q(7), h(4), h(0)],
  },
  {
    id: 'entchen',
    label: 'Alle meine Entchen',
    source: 'deutsches Kinderlied — gemeinfrei',
    bpm: 108,
    offset: 0,
    notes: [q(0), q(2), q(4), q(5), h(7), h(7), q(9), q(9), q(9), q(9), h(7)],
  },
  {
    id: 'morning',
    label: 'Morgenstimmung',
    source: 'Edvard Grieg, 1875 — gemeinfrei',
    bpm: 84,
    offset: 0,
    notes: [
      e(0), e(-2), e(-5), e(-7), e(-5), e(-2),
      e(0), e(-2), e(-5), e(-7), e(-5), e(-2),
      { step: 0, beats: 1.5 },
    ],
  },
  {
    id: 'canon',
    label: 'Kanon in D',
    source: 'Johann Pachelbel, um 1690 — gemeinfrei',
    bpm: 72,
    offset: 0,
    notes: [h(4), h(2), h(0), h(-1), h(-3), h(-5), h(-3), h(-1)],
  },
  {
    id: 'neonRiff',
    label: 'Neon-Riff',
    source: 'für summus geschrieben',
    bpm: 118,
    offset: 0,
    notes: [e(0), e(7), e(10), e(12), e(10), e(7), e(10), e(3), e(0), e(7), e(10), h(12)],
  },
  {
    id: 'powerRiff',
    label: 'Power-Riff',
    source: 'für summus geschrieben',
    bpm: 160,
    offset: 0,
    notes: [e(0), e(0), e(7), e(0), e(0), e(7), e(5), e(3), h(0)],
  },
  {
    id: 'bassRiff',
    label: 'Bass-Riff',
    source: 'für summus geschrieben',
    bpm: 140,
    offset: 0,
    notes: [e(0), e(0), e(12), e(0), e(10), e(0), e(7), e(0), e(0), e(0), e(12), h(0)],
  },
]

/** Which phrase suits which style — an instrument is easier to judge on a tune you know. */
const BY_STYLE: Record<string, string> = {
  orchestra: 'ode',
  cinematic: 'mountain',
  musicbox: 'elise',
  lofi: 'elise',
  folk: 'greensleeves',
  jazz: 'saints',
  punk: 'powerRiff',
  synthwave: 'neonRiff',
  gridrunner: 'neonRiff',
  frenchHouse: 'neonRiff',
  dnb: 'bassRiff',
  chiptune: 'entchen',
}

export function phrase(id: string): Phrase {
  return PHRASES.find((p) => p.id === id) ?? PHRASES[0]
}

export function phraseForStyle(styleId: string | undefined): Phrase {
  return phrase(styleId ? (BY_STYLE[styleId] ?? 'ode') : 'ode')
}

/** What each family sounds most like itself playing. */
const BY_FAMILY: Record<string, string> = {
  Streicher: 'canon',
  Bläser: 'morning',
  Tasten: 'elise',
  Zupf: 'greensleeves',
  Chor: 'ode',
  Synth: 'neonRiff',
  Bass: 'bassRiff',
  Drums: 'powerRiff',
}

/** Styles whose phrase is idiomatic for an acoustic instrument. */
const ACOUSTIC_STYLES = new Set(['orchestra', 'cinematic', 'musicbox', 'lofi', 'folk', 'jazz'])

/**
 * Pick the phrase that shows an instrument off.
 * A violin and a flute should not be judged on the same tune — and a bass
 * should not be judged on a tune at all.
 */
export function phraseFor(family: string, styleId?: string): Phrase {
  if (family === 'Bass') return phrase('bassRiff')
  if (family === 'Drums') return phrase('powerRiff')
  if (family === 'Synth') return phraseForStyle(styleId)
  if (styleId && ACOUSTIC_STYLES.has(styleId)) return phraseForStyle(styleId)
  return phrase(BY_FAMILY[family] ?? 'ode')
}
