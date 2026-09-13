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
      ...hits('crash', [0], 0.7),
      ...hits('kick', [0, 0.5, 2, 4, 4.5, 6]),
      ...hits('snare', [1, 3, 5, 7]),
      ...hits('hat', pulse(0, 8, 0.5), 0.5),
      ...hits('openhat', [7.5], 0.7),
    ],
    // Straight eighths on the root — the engine room of every punk song.
    bass: line(Array(16).fill(-12), 0, 0.5, 0.44, 1),
    // Power chords: root and fifth only, hammered in eighths.
    chords: [
      ...pulse(0, 2, 0.5).flatMap((at) => chord([0, 7], at, 0.42, 0.85)),
      ...pulse(2, 4, 0.5).flatMap((at) => chord([5, 12], at, 0.42, 0.85)),
      ...pulse(4, 6, 0.5).flatMap((at) => chord([7, 14], at, 0.42, 0.85)),
      ...pulse(6, 8, 0.5).flatMap((at) => chord([5, 12], at, 0.42, 0.85)),
    ],
    lead: [
      { step: 12, at: 0, len: 0.45 },
      { step: 12, at: 0.5, len: 0.45 },
      { step: 19, at: 1, len: 0.9 },
      { step: 17, at: 2, len: 1.9 },
      { step: 19, at: 4, len: 0.45 },
      { step: 17, at: 4.5, len: 0.45 },
      { step: 12, at: 5, len: 2.9 },
    ],
  },

  classicRock: {
    bars: 2,
    drums: [
      ...hits('crash', [0], 0.7),
      ...hits('kick', [0, 2.5, 3, 4, 6.5]),
      ...hits('snare', [1, 3, 5, 7]),
      ...hits('hat', pulse(0, 8, 0.5), 0.45),
      ...hits('openhat', [3.5], 0.6),
    ],
    bass: line([-12, -12, -5, -12, -12, -12, -3, -5, -10, -10, -3, -10, -12, -12, -5, -7], 0, 0.5, 0.44, 0.95),
    // Held power chords, the way a rock riff sits under a vocal.
    chords: [
      ...chord([0, 7, 12], 0, 1.8, 0.7),
      ...chord([0, 7, 12], 2, 1.8, 0.6),
      ...chord([-2, 5, 10], 4, 1.8, 0.7),
      ...chord([3, 10, 15], 6, 1.8, 0.6),
    ],
    lead: [
      { step: 12, at: 0.5, len: 0.45 },
      { step: 15, at: 1, len: 0.45 },
      { step: 17, at: 1.5, len: 0.9 },
      { step: 15, at: 2.5, len: 1.4 },
      { step: 10, at: 4.5, len: 0.45 },
      { step: 12, at: 5, len: 0.45 },
      { step: 15, at: 5.5, len: 1.9 },
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
    drums: [
      ...hits('crash', [0, 8], 0.7),
...hits('kick', [0, 3, 4, 7, 8, 11, 12, 15], 0.8), ...hits('tom', [2, 6, 10, 14], 0.5)],
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
    bars: 4,
    drums: [
      // The ride pattern is the heartbeat of a jazz kit: ding — ding-a-ding.
      ...hits('hat', [0, 1, 1.66, 2, 3, 3.66, 4, 5, 5.66, 6, 7, 7.66, 8, 9, 9.66, 10, 11, 11.66, 12, 13, 13.66, 14, 15, 15.66], 0.4),
      // Cross-stick on two and four, and a kick so soft it is felt, not heard.
      ...hits('rim', [1, 3, 5, 7, 9, 11, 13, 15], 0.3),
      ...hits('kick', [0, 4, 8, 12], 0.25),
      ...hits('clap', [7.66, 15.66], 0.35),
    ],
    // Walking bass: root, a chord tone, the fifth, then a step into the next
    // chord — quarter notes, never resting. ii - V - I - I in C.
    bass: [
      ...line([2, 5, 9, 11], 0, 1, 0.9, 0.9),
      ...line([7, 11, 14, 13], 4, 1, 0.9, 0.9),
      ...line([12, 16, 19, 16], 8, 1, 0.9, 0.9),
      ...line([12, 9, 5, 11], 12, 1, 0.9, 0.9),
    ].map((n) => ({ ...n, step: n.step - 24 })),
    // Rootless voicings — the bass has the root, so the piano plays the
    // colour: third, seventh and the extensions above them.
    chords: [
      ...chord([5, 9, 12, 16], 0.66, 1.2, 0.5),
      ...chord([5, 9, 12, 16], 2.5, 0.8, 0.42),
      ...chord([5, 11, 14, 17], 4.66, 1.2, 0.5),
      ...chord([5, 11, 14, 17], 6.5, 0.8, 0.42),
      ...chord([4, 7, 11, 14], 8.66, 1.2, 0.5),
      ...chord([4, 7, 11, 14], 10.5, 0.8, 0.42),
      ...chord([4, 7, 11, 16], 12.66, 2.4, 0.5),
    ],
    // A bebop-flavoured line over the changes rather than a folk tune.
    lead: [
      { step: 14, at: 0.66, len: 0.4 },
      { step: 17, at: 1, len: 0.4 },
      { step: 21, at: 1.66, len: 0.4 },
      { step: 20, at: 2, len: 0.8 },
      { step: 17, at: 3, len: 0.8 },
      { step: 19, at: 4.66, len: 0.4 },
      { step: 17, at: 5, len: 0.4 },
      { step: 14, at: 5.66, len: 0.4 },
      { step: 11, at: 6, len: 1.4 },
      { step: 12, at: 8.66, len: 0.8 },
      { step: 16, at: 9.66, len: 0.4 },
      { step: 19, at: 10, len: 0.4 },
      { step: 23, at: 10.66, len: 2.4 },
      { step: 19, at: 13, len: 0.8 },
      { step: 16, at: 14, len: 1.9 },
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

  jrpg: {
    bars: 4,
    drums: [
      ...hits('crash', [0], 0.7),
      ...hits('kick', [0, 4, 8, 12], 0.6),
      ...hits('rim', [2, 6, 10, 14], 0.4),
      ...hits('hat', pulse(0, 16, 1), 0.25),
    ],
    // i – VI – III – VII: the progression half of adventure music runs on.
    bass: [
      ...line([-12, -5], 0, 2, 1.8, 0.8),
      ...line([-4, 3], 4, 2, 1.8, 0.8),
      ...line([-9, -2], 8, 2, 1.8, 0.8),
      ...line([-2, 5], 12, 2, 1.8, 0.8),
    ],
    chords: [
      ...chord([0, 3, 7], 0, 3.8, 0.45),
      ...chord([8, 12, 15], 4, 3.8, 0.45),
      ...chord([3, 7, 10], 8, 3.8, 0.45),
      ...chord([10, 14, 17], 12, 3.8, 0.45),
    ],
    lead: [
      { step: 12, at: 0, len: 1.4 },
      { step: 15, at: 1.5, len: 0.45 },
      { step: 14, at: 2, len: 1.9 },
      { step: 15, at: 4, len: 0.9 },
      { step: 17, at: 5, len: 0.9 },
      { step: 15, at: 6, len: 1.9 },
      { step: 10, at: 8, len: 1.4 },
      { step: 12, at: 9.5, len: 0.45 },
      { step: 15, at: 10, len: 1.9 },
      { step: 14, at: 12, len: 1.9 },
      { step: 12, at: 14, len: 1.9 },
    ],
  },

  trap: {
    bars: 2,
    drums: [
      ...hits('kick', [0, 3, 4, 6.5], 0.95),
      ...hits('clap', [2, 6], 0.85),
      ...hits('hat', pulse(0, 8, 0.5), 0.4),
      // The rolls that make trap sound like trap.
      ...hits('hat', [1.75, 1.875, 3.25, 3.375, 3.5, 7.25, 7.375, 7.5, 7.625], 0.3),
    ],
    bass: [
      { step: -24, at: 0, len: 2.8, vel: 1 },
      { step: -24, at: 3, len: 0.9, vel: 0.9 },
      { step: -19, at: 4, len: 2.8, vel: 1 },
      { step: -22, at: 7, len: 0.9, vel: 0.9 },
    ],
    chords: [...chord([0, 3, 7, 10], 0, 3.8, 0.35), ...chord([-2, 2, 5, 9], 4, 3.8, 0.35)],
    lead: [
      { step: 15, at: 0.5, len: 0.45, vel: 0.6 },
      { step: 19, at: 1, len: 0.9, vel: 0.6 },
      { step: 15, at: 2.5, len: 1.4, vel: 0.55 },
      { step: 14, at: 4.5, len: 0.45, vel: 0.6 },
      { step: 17, at: 5, len: 1.9, vel: 0.6 },
    ],
  },

  reggae: {
    bars: 2,
    drums: [
      // One drop: nothing on beat one, the kick lands on three.
      ...hits('kick', [2, 6], 0.95),
      ...hits('snare', [2, 6], 0.7),
      ...hits('rim', [1, 3, 5, 7], 0.4),
      ...hits('hat', pulse(0.5, 8, 1), 0.45),
    ],
    bass: [
      { step: -12, at: 0, len: 0.9, vel: 1 },
      { step: -12, at: 1.5, len: 0.45, vel: 0.85 },
      { step: -5, at: 2, len: 1.4, vel: 0.95 },
      { step: -10, at: 4, len: 0.9, vel: 1 },
      { step: -10, at: 5.5, len: 0.45, vel: 0.85 },
      { step: -3, at: 6, len: 1.4, vel: 0.95 },
    ],
    // The skank: chords only ever on the offbeat.
    chords: pulse(0.5, 8, 1).flatMap((at, i) =>
      chord(i < 4 ? [0, 3, 7] : [-2, 2, 5], at, 0.32, 0.6),
    ),
    lead: [
      { step: 12, at: 1.5, len: 0.45 },
      { step: 15, at: 2, len: 1.4 },
      { step: 10, at: 5.5, len: 0.45 },
      { step: 12, at: 6, len: 1.4 },
    ],
  },

  disco: {
    bars: 2,
    drums: [
      ...hits('crash', [0], 0.7),
      ...hits('kick', pulse(0, 8, 1)),
      ...hits('clap', [1, 3, 5, 7], 0.8),
      ...hits('openhat', pulse(0.5, 8, 1), 0.55),
      ...hits('hat', pulse(0, 8, 1), 0.3),
    ],
    // The octave-jumping bass every disco record is built on.
    bass: line([-12, 0, -12, 0, -12, 0, -12, 0, -10, 2, -10, 2, -10, 2, -10, 2], 0, 0.5, 0.42, 0.95),
    chords: [
      ...chord([0, 3, 7, 10], 0.5, 0.3, 0.7),
      ...chord([0, 3, 7, 10], 1.5, 0.3, 0.6),
      ...chord([0, 3, 7, 10], 2.25, 0.3, 0.65),
      ...chord([-2, 2, 5, 9], 4.5, 0.3, 0.7),
      ...chord([-2, 2, 5, 9], 5.5, 0.3, 0.6),
      ...chord([-2, 2, 5, 9], 6.25, 0.3, 0.65),
    ],
    lead: [
      { step: 19, at: 0, len: 0.45 },
      { step: 17, at: 0.5, len: 0.45 },
      { step: 15, at: 1, len: 0.9 },
      { step: 12, at: 2, len: 1.9 },
      { step: 17, at: 4, len: 0.45 },
      { step: 15, at: 4.5, len: 0.45 },
      { step: 14, at: 5, len: 2.9 },
    ],
  },

  bossa: {
    bars: 2,
    drums: [
      ...hits('kick', [0, 1.5, 4, 5.5], 0.6),
      // The clave that carries the whole feel.
      ...hits('rim', [0, 1.5, 3, 4.5, 6], 0.5),
      ...hits('hat', pulse(0, 8, 0.5), 0.25),
    ],
    bass: line([-12, -5, -12, -5, -10, -3, -10, -3], 0, 1, 0.85, 0.85),
    chords: [
      ...chord([0, 3, 7, 10], 0, 0.9, 0.5),
      ...chord([0, 3, 7, 10], 1.5, 0.9, 0.45),
      ...chord([0, 3, 7, 10], 3, 0.9, 0.45),
      ...chord([-2, 2, 5, 9], 4, 0.9, 0.5),
      ...chord([-2, 2, 5, 9], 5.5, 0.9, 0.45),
      ...chord([-2, 2, 5, 9], 7, 0.9, 0.45),
    ],
    lead: [
      { step: 14, at: 0.5, len: 0.9 },
      { step: 12, at: 1.5, len: 1.4 },
      { step: 10, at: 3, len: 0.9 },
      { step: 12, at: 4.5, len: 0.9 },
      { step: 14, at: 5.5, len: 2.4 },
    ],
  },

  ambient: {
    bars: 4,
    drums: [],
    bass: [
      { step: -24, at: 0, len: 7.8, vel: 0.6 },
      { step: -19, at: 8, len: 7.8, vel: 0.6 },
    ],
    chords: [
      ...chord([0, 4, 7, 11], 0, 7.8, 0.4),
      ...chord([-3, 2, 5, 9], 8, 7.8, 0.4),
    ],
    lead: [
      { step: 12, at: 1, len: 2.9, vel: 0.5 },
      { step: 16, at: 4, len: 3.9, vel: 0.45 },
      { step: 14, at: 9, len: 2.9, vel: 0.5 },
      { step: 11, at: 12, len: 3.9, vel: 0.45 },
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

export type { StyleDemo as Demo }
