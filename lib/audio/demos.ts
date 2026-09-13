import type { DrumVoice } from '../types'

export interface DemoNote {
  /** Semitones above the demo's tonic */
  step: number
  /** Start in beats from the top of the loop */
  at: number
  /** Length in beats */
  len: number
  vel?: number
}

export interface DemoHit {
  voice: DrumVoice
  at: number
  vel?: number
}

export interface StyleDemo {
  bars: number
  lead: DemoNote[]
  chords: DemoNote[]
  bass: DemoNote[]
  drums: DemoHit[]
}

/** Beats at a fixed spacing — the backbone of most of these patterns. */
function pulse(from: number, to: number, step: number): number[] {
  const out: number[] = []
  for (let b = from; b < to; b += step) out.push(Number(b.toFixed(3)))
  return out
}

function hits(voice: DrumVoice, beats: number[], vel = 0.9): DemoHit[] {
  return beats.map((at) => ({ voice, at, vel }))
}

function chord(steps: number[], at: number, len: number, vel = 0.55): DemoNote[] {
  return steps.map((step) => ({ step, at, len, vel }))
}

function line(steps: number[], from: number, step: number, len: number, vel = 0.8): DemoNote[] {
  return steps.map((s, i) => ({ step: s, at: from + i * step, len, vel }))
}

/**
 * A two-to-four bar groove per style, so picking a direction actually tells you
 * what it sounds like — at that genre's own tempo, with its own instruments.
 */
export const DEMOS: Record<string, StyleDemo> = {
  synthwave: {
    bars: 2,
    drums: [
      ...hits('kick', pulse(0, 8, 1)),
      ...hits('snare', [1, 3, 5, 7], 0.85),
      ...hits('openhat', pulse(0.5, 8, 1), 0.45),
    ],
    bass: line(
      [-12, -12, -12, -12, -12, -12, -12, -12, -4, -4, -4, -4, -4, -4, -4, -4],
      0,
      0.5,
      0.42,
      0.95,
    ),
    chords: [...chord([0, 3, 7], 0, 3.8), ...chord([8, 12, 15], 4, 3.8)],
    lead: [
      { step: 12, at: 0, len: 0.9 },
      { step: 15, at: 1, len: 0.45 },
      { step: 14, at: 1.5, len: 0.45 },
      { step: 12, at: 2, len: 1.8 },
      { step: 10, at: 4, len: 0.9 },
      { step: 12, at: 5, len: 0.9 },
      { step: 15, at: 6, len: 1.8 },
    ],
  },

  frenchHouse: {
    bars: 2,
    drums: [
      ...hits('kick', pulse(0, 8, 1)),
      ...hits('clap', [1, 3, 5, 7], 0.8),
      ...hits('openhat', pulse(0.5, 8, 1), 0.5),
    ],
    bass: line([-12, -5, -12, -12, -5, -12, -12, -5], 0, 1, 0.45, 0.95),
    chords: [
      ...chord([0, 3, 7, 10], 0.5, 0.4, 0.7),
      ...chord([0, 3, 7, 10], 1.5, 0.4, 0.55),
      ...chord([-2, 2, 5, 9], 2.5, 0.4, 0.7),
      ...chord([-2, 2, 5, 9], 3.5, 0.4, 0.55),
      ...chord([0, 3, 7, 10], 4.5, 0.4, 0.7),
      ...chord([0, 3, 7, 10], 5.5, 0.4, 0.55),
      ...chord([-4, 0, 3, 7], 6.5, 0.4, 0.7),
      ...chord([-4, 0, 3, 7], 7.5, 0.4, 0.55),
    ],
    lead: [
      { step: 12, at: 0, len: 0.4 },
      { step: 15, at: 0.75, len: 0.4 },
      { step: 19, at: 1.5, len: 0.9 },
      { step: 17, at: 4, len: 0.4 },
      { step: 14, at: 4.75, len: 0.4 },
      { step: 12, at: 5.5, len: 1.4 },
    ],
  },

  punk: {
    bars: 2,
    drums: [
      ...hits('kick', [0, 2, 4, 6]),
      ...hits('snare', [1, 3, 5, 7]),
      ...hits('hat', pulse(0, 8, 0.5), 0.55),
    ],
    bass: line(Array(16).fill(-12), 0, 0.5, 0.44, 1),
    chords: [
      ...chord([0, 7], 0, 1.9, 0.9),
      ...chord([5, 12], 2, 1.9, 0.9),
      ...chord([-2, 5], 4, 1.9, 0.9),
      ...chord([0, 7], 6, 1.9, 0.9),
    ],
    lead: [
      { step: 12, at: 0, len: 0.45 },
      { step: 12, at: 0.5, len: 0.45 },
      { step: 19, at: 1, len: 0.9 },
      { step: 17, at: 2, len: 0.9 },
      { step: 12, at: 4, len: 0.45 },
      { step: 15, at: 4.5, len: 0.45 },
      { step: 19, at: 5, len: 1.9 },
    ],
  },

  orchestra: {
    bars: 4,
    drums: [],
    bass: [
      { step: -12, at: 0, len: 3.8, vel: 0.7 },
      { step: -5, at: 4, len: 3.8, vel: 0.7 },
      { step: -8, at: 8, len: 3.8, vel: 0.7 },
      { step: -12, at: 12, len: 3.8, vel: 0.7 },
    ],
    chords: [
      ...chord([0, 3, 7], 0, 3.8, 0.45),
      ...chord([2, 7, 10], 4, 3.8, 0.45),
      ...chord([-1, 4, 7], 8, 3.8, 0.45),
      ...chord([0, 3, 7], 12, 3.8, 0.45),
    ],
    // Beethoven's Ode an die Freude — public domain.
    lead: line([7, 7, 8, 10, 10, 8, 7, 5, 3, 3, 5, 7], 0, 1, 0.9).concat([
      { step: 7, at: 12, len: 1.4 },
      { step: 5, at: 13.5, len: 0.45 },
      { step: 5, at: 14, len: 1.9 },
    ]),
  },

  cinematic: {
    bars: 4,
    drums: [...hits('kick', [0, 3, 4, 7, 8, 11, 12, 15], 0.8), ...hits('tom', [2, 6, 10, 14], 0.5)],
    bass: [
      { step: -12, at: 0, len: 3.9, vel: 0.85 },
      { step: -12, at: 4, len: 3.9, vel: 0.85 },
      { step: -10, at: 8, len: 3.9, vel: 0.85 },
      { step: -7, at: 12, len: 3.9, vel: 0.85 },
    ],
    chords: [
      ...chord([0, 3, 7, 12], 0, 7.8, 0.5),
      ...chord([2, 5, 10, 14], 8, 7.8, 0.5),
    ],
    lead: [
      { step: 12, at: 2, len: 1.9 },
      { step: 15, at: 4, len: 3.9 },
      { step: 14, at: 10, len: 1.9 },
      { step: 12, at: 12, len: 3.9 },
    ],
  },

  lofi: {
    bars: 2,
    drums: [
      ...hits('kick', [0, 2.5, 4, 6.5], 0.85),
      ...hits('snare', [1, 3, 5, 7], 0.6),
      ...hits('hat', pulse(0, 8, 0.5), 0.35),
    ],
    bass: line([-12, -12, -5, -12, -10, -10, -3, -10], 0, 1, 0.8, 0.8),
    chords: [
      ...chord([0, 3, 7, 10], 0, 3.6, 0.5),
      ...chord([-2, 2, 5, 9], 4, 3.6, 0.5),
    ],
    lead: [
      { step: 15, at: 0.5, len: 0.9, vel: 0.6 },
      { step: 14, at: 1.5, len: 0.45, vel: 0.5 },
      { step: 12, at: 2, len: 1.4, vel: 0.6 },
      { step: 10, at: 4.5, len: 0.9, vel: 0.55 },
      { step: 12, at: 5.5, len: 2.4, vel: 0.6 },
    ],
  },

  folk: {
    bars: 2,
    drums: [...hits('rim', [1, 3, 5, 7], 0.4)],
    bass: line([-12, -5, -12, -5, -10, -3, -10, -3], 0, 1, 0.8, 0.8),
    chords: line([0, 7, 12, 7, 3, 10, 15, 10, -2, 5, 9, 5, 0, 7, 12, 7], 0, 0.5, 0.45, 0.55),
    lead: [
      { step: 12, at: 0, len: 0.9 },
      { step: 15, at: 1, len: 0.45 },
      { step: 17, at: 1.5, len: 1.4 },
      { step: 15, at: 4, len: 0.9 },
      { step: 12, at: 5, len: 0.9 },
      { step: 10, at: 6, len: 1.9 },
    ],
  },

  musicbox: {
    bars: 2,
    drums: [],
    bass: [
      { step: -12, at: 0, len: 3.8, vel: 0.5 },
      { step: -7, at: 4, len: 3.8, vel: 0.5 },
    ],
    chords: line([0, 4, 7, 12, 7, 4, 0, 4, 2, 5, 9, 14, 9, 5, 2, 5], 0, 0.5, 0.45, 0.5),
    // Beethoven's Für Elise — public domain.
    lead: [
      { step: 16, at: 0, len: 0.45 },
      { step: 15, at: 0.5, len: 0.45 },
      { step: 16, at: 1, len: 0.45 },
      { step: 15, at: 1.5, len: 0.45 },
      { step: 16, at: 2, len: 0.45 },
      { step: 11, at: 2.5, len: 0.45 },
      { step: 14, at: 3, len: 0.45 },
      { step: 12, at: 3.5, len: 0.45 },
      { step: 9, at: 4, len: 1.9 },
    ],
  },

  jazz: {
    bars: 2,
    drums: [
      ...hits('kick', [0, 4], 0.6),
      ...hits('hat', [0, 0.66, 1, 2, 2.66, 3, 4, 4.66, 5, 6, 6.66, 7], 0.45),
      ...hits('rim', [1, 3, 5, 7], 0.35),
    ],
    bass: line([0, 3, 5, 7, 8, 7, 5, 3], 0, 1, 0.85, 0.85).map((n) => ({ ...n, step: n.step - 12 })),
    chords: [
      ...chord([3, 7, 10, 14], 0.66, 0.5, 0.5),
      ...chord([3, 7, 10, 14], 2, 0.5, 0.45),
      ...chord([2, 5, 9, 12], 4.66, 0.5, 0.5),
      ...chord([2, 5, 9, 12], 6, 0.5, 0.45),
    ],
    // When the Saints Go Marching In — traditional, public domain.
    lead: [
      { step: 12, at: 0.66, len: 0.5 },
      { step: 16, at: 1.33, len: 0.5 },
      { step: 17, at: 2, len: 0.5 },
      { step: 19, at: 2.66, len: 1.9 },
      { step: 12, at: 5, len: 0.5 },
      { step: 16, at: 5.66, len: 0.5 },
      { step: 17, at: 6.33, len: 0.5 },
      { step: 19, at: 7, len: 1 },
    ],
  },

  gridrunner: {
    bars: 2,
    drums: [
      ...hits('kick', pulse(0, 8, 1)),
      ...hits('hat', pulse(0.5, 8, 1), 0.5),
      ...hits('snare', [3, 7], 0.7),
    ],
    bass: line(Array(16).fill(-12), 0, 0.5, 0.4, 0.95),
    chords: [...chord([0, 3, 7], 0, 3.8, 0.4), ...chord([-2, 3, 7], 4, 3.8, 0.4)],
    lead: line(
      [0, 3, 7, 12, 7, 3, 0, 3, 0, 3, 7, 12, 15, 12, 7, 3],
      0,
      0.5,
      0.42,
      0.75,
    ),
  },

  dnb: {
    bars: 2,
    drums: [
      ...hits('kick', [0, 2.5, 4, 6.5]),
      ...hits('snare', [1, 3, 5, 7]),
      ...hits('hat', pulse(0, 8, 0.25), 0.3),
    ],
    bass: [
      { step: -12, at: 0, len: 1.9, vel: 1 },
      { step: -12, at: 2, len: 1.9, vel: 0.9 },
      { step: -5, at: 4, len: 1.9, vel: 1 },
      { step: -7, at: 6, len: 1.9, vel: 0.9 },
    ],
    chords: [...chord([0, 3, 7, 10], 0, 3.8, 0.35), ...chord([-5, 0, 3, 7], 4, 3.8, 0.35)],
    lead: [
      { step: 12, at: 1.5, len: 0.45, vel: 0.7 },
      { step: 15, at: 2, len: 0.45, vel: 0.7 },
      { step: 19, at: 2.5, len: 0.9, vel: 0.7 },
      { step: 17, at: 5.5, len: 0.45, vel: 0.7 },
      { step: 15, at: 6, len: 1.4, vel: 0.7 },
    ],
  },

  chiptune: {
    bars: 2,
    drums: [
      ...hits('kick', [0, 2, 4, 6]),
      ...hits('snare', [1, 3, 5, 7], 0.8),
      ...hits('hat', pulse(0, 8, 0.5), 0.4),
    ],
    bass: line(Array(16).fill(-12), 0, 0.5, 0.42, 0.9),
    chords: [...chord([0, 4, 7], 0, 1.9, 0.4), ...chord([5, 9, 12], 2, 1.9, 0.4), ...chord([-3, 2, 5], 4, 1.9, 0.4), ...chord([0, 4, 7], 6, 1.9, 0.4)],
    lead: line([12, 16, 19, 24, 19, 16, 12, 16, 17, 21, 24, 21, 19, 16, 12, 7], 0, 0.5, 0.42, 0.8),
  },
}

export function demoFor(styleId: string): StyleDemo {
  return DEMOS[styleId] ?? DEMOS.synthwave
}
