import type { Note } from '../types'

/** Deterministic noise, so a song sounds the same every time it is played. */
function noise(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a += 0x9e3779b9
    let t = a
    t = Math.imul(t ^ (t >>> 16), 0x21f0aaad)
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97)
    return (((t ^ (t >>> 15)) >>> 0) / 4294967296) * 2 - 1
  }
}

export type Role = 'drums' | 'bass' | 'chords' | 'lead'

export interface Feel {
  /** How far off the grid notes may sit, in beats */
  drift: number
  /** How much the loudness varies, 0..1 */
  dynamics: number
  /** Delay applied to off-beat eighths, in beats — the shuffle in jazz and lo-fi */
  swing: number
  /** Whole-band push or drag against the click, in beats */
  push: number
}

/** Each genre sits against the beat differently — that is most of its feel. */
const FEELS: Record<string, Partial<Feel>> = {
  jazz: { drift: 0.02, dynamics: 0.3, swing: 0.09, push: -0.012 },
  lofi: { drift: 0.028, dynamics: 0.26, swing: 0.055, push: 0.022 },
  bossa: { drift: 0.016, dynamics: 0.24, swing: 0.02 },
  reggae: { drift: 0.018, dynamics: 0.26, push: 0.018 },
  folk: { drift: 0.02, dynamics: 0.26 },
  orchestra: { drift: 0.026, dynamics: 0.34 },
  cinematic: { drift: 0.026, dynamics: 0.34 },
  jrpg: { drift: 0.022, dynamics: 0.3 },
  musicbox: { drift: 0.018, dynamics: 0.28 },
  ambient: { drift: 0.035, dynamics: 0.3 },
  classicRock: { drift: 0.015, dynamics: 0.24, push: -0.008 },
  punk: { drift: 0.012, dynamics: 0.2, push: -0.014 },
  disco: { drift: 0.01, dynamics: 0.22 },
  trap: { drift: 0.008, dynamics: 0.22 },
  dnb: { drift: 0.006, dynamics: 0.18 },
  // Machine genres are meant to be tight, so they barely move at all.
  synthwave: { drift: 0.004, dynamics: 0.14 },
  frenchHouse: { drift: 0.005, dynamics: 0.16 },
  gridrunner: { drift: 0.003, dynamics: 0.12 },
  chiptune: { drift: 0.002, dynamics: 0.1 },
}

const DEFAULT: Feel = { drift: 0.015, dynamics: 0.22, swing: 0, push: 0 }

export function feelFor(styleId: string): Feel {
  return { ...DEFAULT, ...(FEELS[styleId] ?? {}) }
}

/** Drums stay tightest, chords are allowed to breathe the most. */
const ROLE_DRIFT: Record<Role, number> = { drums: 0.6, bass: 0.8, chords: 1.3, lead: 1 }

/**
 * Nudge a part off the grid the way a player would.
 *
 * Notes land slightly early or late, loudness varies, beats one and three are
 * accented, and off-beat eighths are pushed back where the genre swings. Dead
 * quantisation is the single biggest reason a generated arrangement sounds
 * generated.
 */
export function humanize(notes: Note[], styleId: string, role: Role, seed = 1): Note[] {
  const feel = feelFor(styleId)
  const random = noise(seed * 7919 + role.length * 131)
  const drift = feel.drift * ROLE_DRIFT[role]

  return notes.map((note) => {
    const offbeat = Math.abs((note.start % 1) - 0.5) < 0.02
    const swung = offbeat ? feel.swing : 0
    const start = Math.max(0, note.start + swung + feel.push + random() * drift)

    // Downbeats carry the weight; everything else sits back a little.
    const beatInBar = note.start % 4
    const accent = beatInBar < 0.02 ? 1.08 : Math.abs(beatInBar - 2) < 0.02 ? 1.03 : 0.96
    const velocity = Math.max(
      0.12,
      Math.min(1, note.velocity * accent * (1 + random() * feel.dynamics * 0.5)),
    )

    return { ...note, start, velocity }
  })
}
