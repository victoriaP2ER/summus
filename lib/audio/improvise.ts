import { DEMOS, type DemoHit, type DemoNote, type StyleDemo } from './demos'
import { PROGRESSIONS, withProgression } from './progressions'
import { style as findStyle } from './styles'
import { getScale } from '../music'
import type { DrumVoice } from '../types'

function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(list: T[], random: () => number): T {
  return list[Math.floor(random() * list.length)]
}

/** What the style's own groove implies about how it is built. */
interface Rules {
  bars: number
  /** Where the kick may fall and how many hits to place */
  kickGrid: number
  kickCount: number
  /** The backbeat is the genre's signature — it is kept, not re-rolled */
  backbeat: { voice: DrumVoice; at: number }[]
  hatVoice: DrumVoice | null
  hatDivision: number
  /** Onsets the chords sat on, reused so the comping style survives */
  chordOnsets: { at: number; len: number }[]
  bassOnsets: { at: number; len: number }[]
  hasDrums: boolean
}

function readRules(demo: StyleDemo): Rules {
  const total = demo.bars * 4
  const kicks = demo.drums.filter((h) => h.voice === 'kick')
  const backbeat = demo.drums
    .filter((h) => h.voice === 'snare' || h.voice === 'clap' || h.voice === 'rim')
    .map((h) => ({ voice: h.voice, at: h.at }))
  const hats = demo.drums.filter((h) => h.voice === 'hat' || h.voice === 'openhat')

  const spacing = (items: { at: number }[]) => {
    if (items.length < 2) return 1
    const gaps = items.slice(1).map((h, i) => h.at - items[i].at).filter((g) => g > 0.01)
    return gaps.length ? Math.min(...gaps) : 1
  }

  const uniqueOnsets = (notes: DemoNote[]) => {
    const seen = new Map<number, number>()
    for (const n of notes) if (!seen.has(n.at)) seen.set(n.at, n.len)
    return [...seen.entries()].map(([at, len]) => ({ at, len })).sort((a, b) => a.at - b.at)
  }

  return {
    bars: demo.bars,
    kickGrid: Math.max(0.25, spacing(kicks)),
    kickCount: Math.max(2, kicks.length),
    backbeat,
    hatVoice: hats.length ? (hats[0].voice as DrumVoice) : null,
    hatDivision: hats.length ? spacing(hats) : 0,
    chordOnsets: uniqueOnsets(demo.chords),
    bassOnsets: uniqueOnsets(demo.bass),
    hasDrums: demo.drums.length > 0,
  }
  void total
}

/** Progressions that carry a genre without leaving it. */
const MINOR_MOVES = [
  [0, -4, -9, -2],
  [0, -2, -4, -5],
  [0, 3, -4, -2],
  [0, -5, -4, 0],
  [0, -9, -4, -2],
  [0, 0, -4, -5],
]
const MAJOR_MOVES = [
  [0, 7, 9, 5],
  [0, 5, 7, 7],
  [0, 9, 5, 7],
  [0, -3, 5, 7],
  [0, 5, 2, 7],
]

function triad(root: number, minor: boolean, seventh: boolean): number[] {
  const chord = [root, root + (minor ? 3 : 4), root + 7]
  if (seventh) chord.push(root + (minor ? 10 : 11))
  return chord
}

/**
 * Roll a new arrangement inside the style's own rules.
 *
 * The backbeat and the comping rhythm come from the style's written groove —
 * they are what make it recognisable. The bass drum placement, the harmony and
 * the hi-hat pattern are re-rolled, so the result is new but still in genre.
 */
export function improviseGroove(styleId: string, seed: number): StyleDemo {
  const style = findStyle(styleId)
  const base = withProgression(DEMOS[styleId] ?? DEMOS.synthwave, PROGRESSIONS[styleId])
  const rules = readRules(base)
  const random = rng(seed + styleId.length * 7919)
  const total = rules.bars * 4
  const minor = ['minor', 'harmonicMinor', 'dorian', 'pentaMinor', 'blues'].includes(style.scaleId)
  const scale = getScale(style.scaleId).steps

  // --- drums
  const drums: DemoHit[] = []
  if (rules.hasDrums) {
    const slots: number[] = []
    for (let at = 0; at < total; at += rules.kickGrid) slots.push(Number(at.toFixed(3)))
    const chosen = new Set<number>([0])
    let guard = 0
    while (chosen.size < rules.kickCount && guard++ < 200) {
      chosen.add(pick(slots, random))
    }
    for (const at of chosen) drums.push({ voice: 'kick', at, vel: 0.9 + random() * 0.1 })

    for (const hit of rules.backbeat) drums.push({ voice: hit.voice, at: hit.at, vel: 0.75 })

    if (rules.hatVoice && rules.hatDivision > 0) {
      for (let at = 0; at < total; at += rules.hatDivision) {
        // Leaving the odd hat out is what keeps a pattern from sounding typed in.
        if (random() < 0.12) continue
        drums.push({ voice: rules.hatVoice, at: Number(at.toFixed(3)), vel: 0.3 + random() * 0.2 })
      }
    }
    if (random() < 0.5) drums.push({ voice: 'crash', at: 0, vel: 0.65 })
  }

  // --- harmony
  const moves = pick(minor ? MINOR_MOVES : MAJOR_MOVES, random)
  const seventh = ['jazz', 'bossa', 'lofi', 'trap', 'dnb', 'frenchHouse'].includes(styleId)
  const roots = Array.from({ length: rules.bars }, (_, bar) => moves[bar % moves.length])

  const chords: DemoNote[] = []
  for (const onset of rules.chordOnsets) {
    const bar = Math.min(rules.bars - 1, Math.floor(onset.at / 4))
    const shape = triad(roots[bar], minor, seventh)
    const inversion = Math.floor(random() * 2)
    for (let i = 0; i < shape.length; i++) {
      const step = i < inversion ? shape[i] + 12 : shape[i]
      chords.push({ step, at: onset.at, len: onset.len, vel: 0.45 + random() * 0.15 })
    }
  }

  // --- bass
  const bass: DemoNote[] = rules.bassOnsets.map((onset) => {
    const bar = Math.min(rules.bars - 1, Math.floor(onset.at / 4))
    const root = roots[bar]
    const strong = onset.at % 2 < 0.01
    // Off the beat the bass reaches for another chord tone or a passing note.
    const offset = strong
      ? 0
      : pick([0, 7, 12, scale[Math.floor(random() * scale.length)]], random)
    return {
      step: root - 12 + offset,
      at: onset.at,
      len: onset.len,
      vel: strong ? 0.95 : 0.8,
    }
  })

  return { bars: rules.bars, drums, chords, bass, lead: base.lead }
}
