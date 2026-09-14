import type { DemoHit, DemoNote, StyleDemo } from '../demos'
import type { DrumVoice } from '../../types'

export interface GenreSpec {
  bpm: number
  /** 'major' | 'minor' | 'dorian' | 'mixolydian' | 'harmonicMinor' | 'pentaMinor' | 'blues' */
  scaleId: string
  /** Instrument ids; three to five line-ups, most typical first */
  sets: { lead: string; chords: string; bass: string }[]
  /** Exactly 4 bars = 16 beats, with the harmony written out across all four */
  demo: StyleDemo
  /** Which references informed this and what each instrument is doing */
  notes: string
  /** Instruments the app lacks that this genre really needs */
  missing?: string[]
}

/* ------------------------------------------------------------------ *
 * Little helpers. Everything below is written in beats from the top
 * of a four-bar loop, so `at` runs 0 .. 15.999 and the bars start at
 * 0, 4, 8 and 12.
 * ------------------------------------------------------------------ */

const BARS = [0, 4, 8, 12]

function hit(voice: DrumVoice, at: number, vel = 0.9): DemoHit {
  return { voice, at, vel }
}

/** The same voice on a list of positions inside every bar. */
function perBar(voice: DrumVoice, offsets: number[], vel = 0.9): DemoHit[] {
  return BARS.flatMap((bar) => offsets.map((o) => hit(voice, bar + o, vel)))
}

/** A hat line written as [offsetInBar, velocity] pairs, repeated every bar. */
function hatLine(voice: DrumVoice, steps: [number, number][]): DemoHit[] {
  return BARS.flatMap((bar) => steps.map(([o, v]) => hit(voice, bar + o, v)))
}

function chord(steps: number[], at: number, len: number, vel = 0.55): DemoNote[] {
  return steps.map((step) => ({ step, at, len, vel }))
}

/** One note per entry, evenly spaced — for arpeggios and pulsing basses. */
function run(steps: number[], from: number, gap: number, len: number, vel = 0.8): DemoNote[] {
  return steps.map((s, i) => ({ step: s, at: Number((from + i * gap).toFixed(3)), len, vel }))
}

/** Cycle a chord shape as fast repeated notes — the chiptune arpeggio trick. */
function arp(cycle: number[], from: number, to: number, gap: number, len: number, vel = 0.6): DemoNote[] {
  const out: DemoNote[] = []
  let i = 0
  for (let at = from; at < to - 1e-6; at += gap) {
    out.push({ step: cycle[i % cycle.length], at: Number(at.toFixed(3)), len, vel })
    i++
  }
  return out
}

/* ================================================================== *
 * 80s SYNTHWAVE
 * ================================================================== */

// i – VI – III – VII in A minor (Am – F – C – G), the progression the
// whole genre runs on. Bass roots descend A – F – C – G.
const SYNTHWAVE_ROOTS = [-12, -16, -9, -14]

const synthwave: GenreSpec = {
  bpm: 112,
  scaleId: 'minor',
  sets: [
    { lead: 'supersaw', chords: 'synthPad', bass: 'synthBass' },
    { lead: 'synthLead', chords: 'dreamy', bass: 'subBass' },
    { lead: 'supersaw', chords: 'epiano', bass: 'subBass' },
    { lead: 'pluckSynth', chords: 'choirPad', bass: 'synthBass' },
  ],
  demo: {
    bars: 4,
    drums: [
      hit('crash', 0, 0.6),
      // LinnDrum feel: kick on 1 and 3 with a push into the next bar,
      // huge gated snare on 2 and 4 — never four-on-the-floor.
      ...perBar('kick', [0, 2], 1),
      ...BARS.map((bar) => hit('kick', bar + 3.5, 0.7)),
      ...perBar('snare', [1, 3], 0.95),
      // Eighth-note hats, downbeats louder than the offbeats, with the
      // offbeat before the snare opened up.
      ...hatLine('hat', [
        [0, 0.34],
        [0.5, 0.2],
        [1, 0.3],
        [1.5, 0.2],
        [2, 0.34],
        [2.5, 0.2],
        [3, 0.3],
      ]),
      ...BARS.map((bar) => hit('openhat', bar + 3.5, 0.45)),
      // Tom fill turning the phrase around.
      hit('tom', 15.25, 0.6),
      hit('tom', 15.5, 0.65),
      hit('tom', 15.75, 0.7),
    ],
    // Driving eighth-note root pulse with an octave lift at the end of
    // every bar — sidechained throb, not a sustained bass note.
    bass: BARS.flatMap((bar, i) => {
      const r = SYNTHWAVE_ROOTS[i]
      return [
        ...run([r, r, r, r, r, r, r], bar, 0.5, 0.42, 0.95),
        { step: r + 12, at: bar + 3.5, len: 0.42, vel: 0.8 },
      ]
    }),
    // Wide pad, re-struck on beat 3 so it breathes with the sidechain.
    chords: [
      ...chord([0, 3, 7, 12], 0, 2.4, 0.5),
      ...chord([0, 3, 7, 12], 2.5, 1.4, 0.4),
      ...chord([-4, 0, 3, 8], 4, 2.4, 0.5),
      ...chord([-4, 0, 3, 8], 6.5, 1.4, 0.4),
      ...chord([-5, 3, 7, 10], 8, 2.4, 0.5),
      ...chord([-5, 3, 7, 10], 10.5, 1.4, 0.4),
      ...chord([2, 5, 10], 12, 2.4, 0.5),
      ...chord([2, 5, 10], 14.5, 1.4, 0.4),
    ],
    // A long, nostalgic supersaw line: rises across the first half,
    // falls home over the VII.
    lead: [
      { step: 12, at: 0, len: 1.4, vel: 0.85 },
      { step: 19, at: 1.5, len: 0.9, vel: 0.85 },
      { step: 17, at: 2.5, len: 1.4, vel: 0.8 },
      { step: 20, at: 4, len: 1.9, vel: 0.9 },
      { step: 19, at: 6, len: 0.9, vel: 0.8 },
      { step: 15, at: 7, len: 0.9, vel: 0.75 },
      { step: 15, at: 8, len: 0.9, vel: 0.85 },
      { step: 19, at: 9, len: 0.45, vel: 0.8 },
      { step: 22, at: 9.5, len: 2.4, vel: 0.9 },
      { step: 19, at: 12, len: 0.9, vel: 0.8 },
      { step: 17, at: 13, len: 0.9, vel: 0.8 },
      { step: 14, at: 14, len: 1.9, vel: 0.75 },
    ],
  },
  notes:
    'Referenzen: Kavinsky "Nightcall", Com Truise "Brokendate", FM-84 "Running in the Night", ' +
    'The Midnight "Sunset", Carpenter Brut "Turbo Killer". 112 BPM, a-Moll, i–VI–III–VII (Am–F–C–G). ' +
    'Drums: LinnDrum/DMX-Feel — Kick auf 1 und 3 plus ein Push auf das "und" der 4, riesige Gated-Snare ' +
    'auf 2 und 4, Achtel-Hats mit betonten Zählzeiten und einer offenen Hat vor dem Taktwechsel, Tom-Fill ' +
    'am Phrasenende. Bass: Synth-Bass in durchgehenden Achteln auf dem Grundton, am Taktende ein Oktavsprung ' +
    'nach oben — der pumpende Motor des Genres. Chords: breite Pad-Fläche, pro Takt zweimal angeschlagen ' +
    '(1 und 3+), damit sie mit dem Sidechain atmet; Umkehrungen halten die Stimmführung eng. ' +
    'Lead: Supersaw mit langen Tönen, steigt über die ersten beiden Takte und fällt über dem VII nach Hause.',
  missing: [
    'gatedSnare (LinnDrum-Snare mit Gate-Reverb — der Sound, an dem man Synthwave sofort erkennt)',
    'fmBell (DX7-Glockenspiel/E-Piano für die Gegenmelodie)',
    'vocoder (Roboterstimme als drittes Lead)',
  ],
}

/* ================================================================== *
 * FRENCH HOUSE
 * ================================================================== */

// i7 – VII7 – VImaj7 – v7 in A minor (Am7 – G7 – Fmaj7 – Em7): a
// descending disco cycle, the kind that gets filtered on a loop.
const FH_ROOTS = [-12, -14, -16, -17]
const FH_VOICINGS = [
  [0, 3, 7, 10], // Am7
  [2, 5, 8, 10], // G7  (B D F G)
  [-4, 0, 3, 7], // Fmaj7
  [-2, 2, 5, 7], // Em7 (G B D E)
]

const frenchHouse: GenreSpec = {
  bpm: 124,
  scaleId: 'minor',
  sets: [
    { lead: 'strings', chords: 'wurlitzer', bass: 'bassGuitar' },
    { lead: 'guitarClean', chords: 'piano', bass: 'bass' },
    { lead: 'supersaw', chords: 'epiano', bass: 'synthBass' },
    { lead: 'pluckSynth', chords: 'strings', bass: 'bassGuitar' },
  ],
  demo: {
    bars: 4,
    drums: [
      hit('crash', 0, 0.55),
      // Four to the floor, plus one offbeat kick as a turnaround at the
      // very end of the loop.
      ...perBar('kick', [0, 1, 2, 3], 1),
      hit('kick', 15.5, 0.8),
      // 909 clap on 2 and 4, dragged a hair ahead of the grid.
      ...BARS.flatMap((bar) => [hit('clap', bar + 0.97, 0.85), hit('clap', bar + 2.97, 0.85)]),
      // Sixteenth hats with the offbeat eighths opened — the offbeat
      // open hat is the single loudest thing in the hat line.
      ...hatLine('hat', [
        [0, 0.26],
        [0.25, 0.16],
        [0.75, 0.22],
        [1, 0.26],
        [1.25, 0.16],
        [1.75, 0.22],
        [2, 0.26],
        [2.25, 0.16],
        [2.75, 0.22],
        [3, 0.26],
        [3.25, 0.16],
        [3.75, 0.24],
      ]),
      ...perBar('openhat', [0.5, 1.5, 2.5, 3.5], 0.5),
    ],
    // A sampled-disco bass figure: root on the downbeat, a sixteenth
    // push, then the octave. Syncopated, never straight eighths.
    bass: BARS.flatMap((bar, i) => {
      const r = FH_ROOTS[i]
      return [
        { step: r, at: bar, len: 0.45, vel: 1 },
        { step: r, at: bar + 0.75, len: 0.2, vel: 0.7 },
        { step: r, at: bar + 1.5, len: 0.4, vel: 0.85 },
        { step: r + 12, at: bar + 2.25, len: 0.2, vel: 0.7 },
        { step: r + 7, at: bar + 2.5, len: 0.4, vel: 0.85 },
        { step: r + 12, at: bar + 3.5, len: 0.4, vel: 0.9 },
      ]
    }).concat([{ step: FH_ROOTS[3] + 10, at: 15.75, len: 0.2, vel: 0.75 }]),
    // Rhodes/strings stabs, only ever on the offbeat and the "a" —
    // short, filtered, seventh voicings.
    chords: BARS.flatMap((bar, i) => {
      const v = FH_VOICINGS[i]
      return [
        ...chord(v, bar + 0.5, 0.4, 0.7),
        ...chord(v, bar + 1.5, 0.3, 0.55),
        ...chord(v, bar + 2.25, 0.3, 0.5),
        ...chord(v, bar + 3.5, 0.4, 0.65),
      ]
    }),
    // A short filtered hook that enters on the offbeat, four bars long
    // so the loop actually goes somewhere.
    lead: [
      { step: 12, at: 0.5, len: 0.4, vel: 0.8 },
      { step: 15, at: 1, len: 0.4, vel: 0.75 },
      { step: 19, at: 1.5, len: 1.4, vel: 0.85 },
      { step: 17, at: 4.5, len: 0.4, vel: 0.8 },
      { step: 14, at: 5, len: 0.4, vel: 0.75 },
      { step: 17, at: 5.5, len: 1.4, vel: 0.85 },
      { step: 15, at: 8.5, len: 0.4, vel: 0.8 },
      { step: 19, at: 9, len: 0.4, vel: 0.8 },
      { step: 20, at: 9.5, len: 1.9, vel: 0.85 },
      { step: 19, at: 12.5, len: 0.4, vel: 0.8 },
      { step: 17, at: 13, len: 0.4, vel: 0.75 },
      { step: 14, at: 13.5, len: 0.9, vel: 0.8 },
      { step: 12, at: 14.5, len: 1.4, vel: 0.85 },
    ],
  },
  notes:
    'Referenzen: Stardust "Music Sounds Better with You", Modjo "Lady (Hear Me Tonight)", ' +
    'Daft Punk "One More Time"/"Digital Love", Alan Braxe & Fred Falke "Intro", Cassius "Cassius 1999". ' +
    '124 BPM, a-Moll, Am7–G7–Fmaj7–Em7 — ein absteigender Disco-Zyklus, wie ihn ein gefilterter Loop hergibt. ' +
    'Drums: Four-to-the-floor auf jeder Zählzeit, 909-Clap minimal vor 2 und 4, Sechzehntel-Closed-Hats mit ' +
    'Velocity-Gefälle und offene Hats auf allen Achtel-Offbeats (das lauteste Element der Hat-Linie); ' +
    'ein Offbeat-Kick am Loopende als Turnaround. Bass: echter E-Bass/Bassgitarre im Disco-Sinne — Grundton, ' +
    'Sechzehntel-Push, Quinte, Oktave; synkopiert statt durchlaufend, weil das Genre reale Platten sampelt. ' +
    'Chords: kurze Septakkord-Stabs auf 1+, 2+, dem "a" der 3 und 4+ — nie gehalten, immer gefiltert. ' +
    'Lead: gefilterte Streicher-/Gitarrenphrase, die auf dem Offbeat einsetzt und über vier Takte einen Bogen baut.',
  missing: [
    'brass (Disco-Bläsersatz für die Stabs)',
    'clavinet (funky Sechzehntel-Begleitung)',
    'vocoder / talkbox (die Roboterstimme von Daft Punk und Stardust)',
  ],
}

/* ================================================================== *
 * DRUM & BASS (liquid)
 * ================================================================== */

// i – ii – III – IV7 in A dorian (Am7 – Bm7 – Cmaj9 – D7). The major
// IV over a minor root is the dorian lift liquid lives on.
const DNB_ROOTS = [-12, -10, -9, -7]
const DNB_VOICINGS = [
  [0, 3, 7, 10], // Am7
  [2, 5, 9, 12], // Bm7
  [3, 7, 10, 14], // Cmaj9
  [0, 3, 5, 9], // D7  (A C D F#)
]

// Sixteenth hats, recessed, with the offbeats a touch louder.
const DNB_HATS: [number, number][] = [
  [0, 0.22],
  [0.25, 0.13],
  [0.5, 0.2],
  [0.75, 0.13],
  [1.25, 0.13],
  [1.5, 0.2],
  [1.75, 0.15],
  [2, 0.22],
  [2.25, 0.13],
  [2.75, 0.15],
  [3.25, 0.13],
  [3.5, 0.2],
  [3.75, 0.15],
]

const dnb: GenreSpec = {
  bpm: 174,
  scaleId: 'dorian',
  sets: [
    { lead: 'pluckSynth', chords: 'epiano', bass: 'subBass' },
    { lead: 'vibraphone', chords: 'wurlitzer', bass: 'subBass' },
    { lead: 'synthLead', chords: 'synthPad', bass: 'synthBass' },
    { lead: 'supersaw', chords: 'choirPad', bass: 'synthBass' },
  ],
  demo: {
    bars: 4,
    drums: [
      hit('crash', 0, 0.55),
      // Two-step: kick on 1 and on the "and" of 3, snare on 2 and 4.
      // That is the whole genre in four hits.
      ...perBar('kick', [0], 1),
      ...perBar('kick', [2.5], 0.92),
      ...perBar('snare', [1, 3], 1),
      ...hatLine('hat', DNB_HATS),
      ...perBar('openhat', [1.5], 0.28),
      // Ghost snares off the break — they land late and quiet, and they
      // are what stops the loop sounding like a drum machine.
      hit('snare', 3.75, 0.3),
      hit('snare', 7.75, 0.34),
      hit('rim', 9.75, 0.28),
      hit('snare', 13.75, 0.3),
      hit('snare', 15.25, 0.36),
      hit('snare', 15.5, 0.45),
      hit('kick', 11.75, 0.6),
    ],
    // Sub bass: a long root under the first kick, re-triggered on the
    // second kick, so the low end locks to the two-step.
    bass: BARS.flatMap((bar, i) => {
      const r = DNB_ROOTS[i]
      return [
        { step: r, at: bar, len: 2.2, vel: 1 },
        { step: r, at: bar + 2.5, len: 1.3, vel: 0.9 },
      ]
    }).concat([{ step: DNB_ROOTS[0], at: 15.5, len: 0.4, vel: 0.75 }]),
    // Rhodes chords: held over the bar, then stabbed again on the
    // second kick. Sevenths and ninths, never plain triads.
    chords: BARS.flatMap((bar, i) => {
      const v = DNB_VOICINGS[i]
      return [...chord(v, bar, 2.3, 0.42), ...chord(v, bar + 2.5, 1.3, 0.33)]
    }),
    // A soulful line with more rest than note — it enters after the
    // downbeat every time.
    lead: [
      { step: 19, at: 1.5, len: 0.45, vel: 0.65 },
      { step: 22, at: 2, len: 0.45, vel: 0.68 },
      { step: 24, at: 2.5, len: 1.4, vel: 0.72 },
      { step: 21, at: 5, len: 0.45, vel: 0.65 },
      { step: 19, at: 5.5, len: 0.45, vel: 0.65 },
      { step: 17, at: 6, len: 1.9, vel: 0.7 },
      { step: 15, at: 8.5, len: 0.45, vel: 0.65 },
      { step: 19, at: 9, len: 0.45, vel: 0.68 },
      { step: 22, at: 9.5, len: 2.4, vel: 0.72 },
      { step: 21, at: 12.5, len: 0.45, vel: 0.68 },
      { step: 19, at: 13, len: 0.45, vel: 0.65 },
      { step: 17, at: 13.5, len: 1.4, vel: 0.7 },
      { step: 14, at: 15, len: 0.9, vel: 0.6 },
    ],
  },
  notes:
    'Referenzen: LTJ Bukem "Horizons", Goldie "Inner City Life", Calibre "Mr. Right On", ' +
    'High Contrast "Return of Forever", Netsky "Iron Heart". 174 BPM, a-dorisch, Am7–Bm7–Cmaj9–D7 — ' +
    'das Dur-IV über dem Moll-Grundton ist der dorische Lift, von dem Liquid lebt. ' +
    'Drums: Two-Step — Kick auf 1 und auf dem "und" der 3, Snare auf 2 und 4, Sechzehntel-Hats weit hinten ' +
    'im Bild mit lauteren Offbeats; dazu leise, leicht verschleppte Ghost-Snares am Taktende und ein ' +
    'Snare-Roll als Turnaround im letzten Takt. Bass: Sub-Bass, ein langer Grundton unter dem ersten Kick, ' +
    'auf dem zweiten Kick nachgetriggert — tief, glatt, ohne Melodie. Chords: Rhodes, über den Takt gehalten ' +
    'und auf dem zweiten Kick erneut angeschlagen; Septimen und None statt Dreiklängen. ' +
    'Lead: sparsame Soul-Linie, die jedes Mal nach der Eins einsetzt und mehr Pause als Ton hat.',
  missing: [
    'reeseBass (verstimmter Saw-Bass mit Filterbewegung — der zweite Bass-Sound des Genres)',
    'amenBreak (gesampelter, zerhackter Breakbeat mit Ride und Shaker)',
    'ride (Ridebecken für die durchlaufenden Achtel über dem Break)',
  ],
}

/* ================================================================== *
 * GRIDRUNNER — cold neon electro
 * ================================================================== */

// i – VI – iv – V in A harmonic minor (Am – F – Dm – E). The E major
// with its G# is what makes it sound like a machine, not a ballad.
const GRID_ROOTS = [-12, -16, -19, -17]
const GRID_VOICINGS = [
  [0, 3, 7, 12], // Am
  [-4, 0, 3, 8], // F
  [-7, -4, 0, 5], // Dm
  [-5, -1, 2, 7], // E
]

const gridrunner: GenreSpec = {
  bpm: 130,
  scaleId: 'harmonicMinor',
  sets: [
    { lead: 'pluckSynth', chords: 'supersaw', bass: 'synthBass' },
    { lead: 'synthLead', chords: 'synthPad', bass: 'subBass' },
    { lead: 'squareLead', chords: 'choirPad', bass: 'synthBass' },
    { lead: 'supersaw', chords: 'dreamy', bass: 'subBass' },
  ],
  demo: {
    bars: 4,
    drums: [
      hit('crash', 0, 0.5),
      // 808 electro: the kick is syncopated, not four-to-the-floor.
      ...perBar('kick', [0], 1),
      ...perBar('kick', [0.75], 0.75),
      ...perBar('kick', [2.5], 0.9),
      ...perBar('snare', [1, 3], 0.9),
      // Sixteenth hats with holes punched in them — the gaps are the
      // groove. Accents on the eighths.
      ...hatLine('hat', [
        [0, 0.32],
        [0.25, 0.18],
        [0.5, 0.26],
        [0.75, 0.18],
        [1, 0.32],
        [1.5, 0.26],
        [1.75, 0.18],
        [2, 0.32],
        [2.25, 0.18],
        [2.5, 0.26],
        [3, 0.32],
        [3.25, 0.18],
        [3.5, 0.26],
        [3.75, 0.2],
      ]),
      ...perBar('openhat', [1.5], 0.42),
      // Rimshot standing in for the 808 cowbell.
      ...perBar('rim', [2.25], 0.4),
      hit('rim', 15.25, 0.45),
      hit('rim', 15.5, 0.5),
    ],
    // Eighth-note machine bass: root, root, fifth, root, octave, root,
    // fifth, and a chromatic step into the next chord.
    bass: BARS.flatMap((bar, i) => {
      const r = GRID_ROOTS[i]
      const next = GRID_ROOTS[(i + 1) % 4]
      return [
        ...run([r, r, r + 7, r, r + 12, r, r + 7], bar, 0.5, 0.44, 0.95),
        { step: next - 1, at: bar + 3.5, len: 0.44, vel: 0.8 },
      ]
    }),
    // Icy stabs: one on the downbeat, then only off the beat. Short
    // enough that you hear the silence between them.
    chords: BARS.flatMap((bar, i) => {
      const v = GRID_VOICINGS[i]
      return [
        ...chord(v, bar, 0.45, 0.5),
        ...chord(v, bar + 1.5, 0.3, 0.42),
        ...chord(v, bar + 2.5, 0.3, 0.46),
        ...chord(v, bar + 3.5, 0.3, 0.38),
      ]
    }),
    // A mechanical eighth-note arpeggio over the chord tones, the same
    // shape transposed each bar, ending on a G# that climbs back to A.
    lead: [
      ...run([12, 19, 24, 19, 15, 12, 19, 15], 0, 0.5, 0.4, 0.75),
      ...run([12, 20, 24, 20, 15, 12, 20, 15], 4, 0.5, 0.4, 0.75),
      ...run([17, 24, 20, 17, 12, 17, 20, 24], 8, 0.5, 0.4, 0.75),
      ...run([19, 23, 19, 14, 23, 19, 14, 11], 12, 0.5, 0.4, 0.75),
    ],
  },
  notes:
    'Referenzen: Wendy Carlos "Tron" (1982), Daft Punk "Derezzed"/"The Grid" (Tron: Legacy), ' +
    'Cybotron "Clear", Kraftwerk "Computer World"/"Home Computer", Perturbator "Sentient". ' +
    '130 BPM, a-harmonisch-Moll, Am–F–Dm–E — die Dur-Dominante mit ihrem gis macht den kalten, ' +
    'chromatischen Zug. Drums: TR-808-Electro — synkopierter Kick (1, das "a" der 1, das "und" der 3), ' +
    'Snare auf 2 und 4, Sechzehntel-Hats mit bewusst herausgeschnittenen Schlägen (die Lücken sind der Groove), ' +
    'offene Hat auf 2+, Rimshot als Cowbell-Ersatz auf dem "a" der 3. Bass: Synth-Bass in Achteln — ' +
    'Grundton, Quinte, Oktave, und am Taktende ein chromatischer Halbton von unten in den nächsten Grundton. ' +
    'Chords: eisige Kurz-Stabs auf 1, 2+, 3+ und 4+, nie gehalten. ' +
    'Lead: mechanisches Achtel-Arpeggio über die Akkordtöne, dieselbe Figur pro Takt transponiert, ' +
    'am Schluss ein gis, das chromatisch zurück zum a steigt.',
  missing: [
    'cowbell (die 808-Cowbell — hier durch Rimshot ersetzt)',
    'vocoder (die kalte Robotervocal-Linie von Kraftwerk bis Tron: Legacy)',
    'stringMachine (Solina/Polymoog-Streicher — die "icy synth strings" des klassischen Electro)',
  ],
}

/* ================================================================== *
 * CHIPTUNE — NES, 2 pulse + triangle + noise
 * ================================================================== */

// I – V/B – vi – IV in C major (C – G/B – Am – F): a descending bass
// line C – B – A – F under four distinct chords.
const CHIP_ROOTS = [-12, -13, -15, -19]
const CHIP_ARPS = [
  [0, 4, 7, 12], // C
  [-1, 2, 7, 11], // G/B
  [-3, 0, 4, 9], // Am
  [0, 5, 9, 12], // F
]

const chiptune: GenreSpec = {
  bpm: 150,
  scaleId: 'major',
  sets: [
    { lead: 'squareLead', chords: 'squareLead', bass: 'subBass' },
    { lead: 'squareLead', chords: 'pluckSynth', bass: 'synthBass' },
    { lead: 'synthLead', chords: 'squareLead', bass: 'subBass' },
    { lead: 'glockenspiel', chords: 'squareLead', bass: 'synthBass' },
  ],
  demo: {
    bars: 4,
    drums: [
      hit('crash', 0, 0.45),
      // Noise channel: kick on 1 and 3 with a syncopated push, snare on
      // 2 and 4, and very short noise ticks as hats.
      ...perBar('kick', [0, 2], 0.95),
      hit('kick', 6.5, 0.7),
      hit('kick', 14.5, 0.7),
      ...perBar('snare', [1, 3], 0.85),
      ...hatLine('hat', [
        [0, 0.34],
        [0.5, 0.22],
        [1, 0.3],
        [1.5, 0.22],
        [2, 0.34],
        [2.5, 0.22],
        [3, 0.3],
        [3.5, 0.22],
      ]),
      // Sixteenth roll into the loop point.
      hit('snare', 15.25, 0.5),
      hit('snare', 15.5, 0.6),
      hit('snare', 15.75, 0.7),
    ],
    // Triangle bass: bouncing eighths between root and octave, with the
    // fifth on beat 4 and a scale step into the next bar.
    bass: BARS.flatMap((bar, i) => {
      const r = CHIP_ROOTS[i]
      const tail = i === 3 ? -13 : r + 12 // leading tone B back into C
      return [
        ...run([r, r + 12, r, r + 12, r, r + 12, r + 7], bar, 0.5, 0.42, 0.9),
        { step: tail, at: bar + 3.5, len: 0.42, vel: 0.85 },
      ]
    }),
    // The chiptune trick: no held chords — a single channel cycling the
    // chord tones in sixteenths so it sounds polyphonic.
    chords: [
      ...arp(CHIP_ARPS[0], 0, 4, 0.25, 0.22, 0.45),
      ...arp(CHIP_ARPS[1], 4, 8, 0.25, 0.22, 0.45),
      ...arp(CHIP_ARPS[2], 8, 12, 0.25, 0.22, 0.45),
      ...arp(CHIP_ARPS[3], 12, 16, 0.25, 0.22, 0.45),
    ],
    // Pulse-channel melody: wide leaps, sixteenth flourishes, and a run
    // back down to the top of the loop.
    lead: [
      { step: 12, at: 0, len: 0.42, vel: 0.85 },
      { step: 16, at: 0.5, len: 0.42, vel: 0.8 },
      { step: 19, at: 1, len: 0.42, vel: 0.85 },
      { step: 24, at: 1.5, len: 0.9, vel: 0.9 },
      { step: 23, at: 2.5, len: 0.22, vel: 0.75 },
      { step: 24, at: 2.75, len: 0.22, vel: 0.8 },
      { step: 19, at: 3, len: 0.9, vel: 0.8 },
      { step: 14, at: 4, len: 0.42, vel: 0.8 },
      { step: 19, at: 4.5, len: 0.42, vel: 0.8 },
      { step: 23, at: 5, len: 0.9, vel: 0.9 },
      { step: 23, at: 6, len: 0.42, vel: 0.8 },
      { step: 21, at: 6.5, len: 0.42, vel: 0.78 },
      { step: 19, at: 7, len: 0.9, vel: 0.8 },
      { step: 16, at: 8, len: 0.42, vel: 0.85 },
      { step: 21, at: 8.5, len: 0.42, vel: 0.8 },
      { step: 24, at: 9, len: 0.9, vel: 0.9 },
      { step: 21, at: 10, len: 0.42, vel: 0.8 },
      { step: 19, at: 10.5, len: 0.42, vel: 0.78 },
      { step: 16, at: 11, len: 0.9, vel: 0.8 },
      { step: 17, at: 12, len: 0.42, vel: 0.85 },
      { step: 21, at: 12.5, len: 0.42, vel: 0.8 },
      { step: 24, at: 13, len: 0.9, vel: 0.9 },
      { step: 23, at: 14, len: 0.22, vel: 0.78 },
      { step: 21, at: 14.25, len: 0.22, vel: 0.78 },
      { step: 19, at: 14.5, len: 0.42, vel: 0.8 },
      { step: 16, at: 15, len: 0.42, vel: 0.78 },
      { step: 14, at: 15.5, len: 0.42, vel: 0.75 },
    ],
  },
  notes:
    'Referenzen: Koji Kondo (Super Mario Bros.), Hirokazu Tanaka (Metroid, Kid Icarus), ' +
    'Manami Matsumae (Mega Man), Rob Hubbard (C64), Tim Follin (Solstice). 150 BPM, C-Dur, ' +
    'C–G/B–Am–F mit absteigendem Basslauf c–h–a–f. Der NES hat zwei Pulse-, einen Dreieck- und einen ' +
    'Noise-Kanal, und genau so ist das Pattern aufgeteilt. Drums (Noise): Kick auf 1 und 3 plus ein ' +
    'synkopierter Schlag auf dem "und" der 3 in den Takten 2 und 4, Snare auf 2 und 4, Achtel-Ticks als Hats, ' +
    'Sechzehntel-Roll in den Loop-Punkt. Bass (Dreieck): federnde Achtel zwischen Grundton und Oktave, ' +
    'Quinte auf der 4 und ein Leitton zurück nach C. Chords: KEINE gehaltenen Dreiklänge — ein Kanal, ' +
    'der die Akkordtöne in Sechzehnteln durchjagt und so Polyphonie vortäuscht; das ist der eigentliche ' +
    'Chiptune-Sound. Lead (Pulse): Melodie mit weiten Sprüngen, Sechzehntel-Verzierungen und einem Lauf ' +
    'zurück an den Anfang.',
  missing: [
    'triangleBass (echter Dreieckskanal statt Synth-Bass)',
    'noisePerc (Noise-Kanal mit Tonhöhe/Envelope für Kick, Snare und Hats aus einer Quelle)',
    'pwmLead (Pulse mit umschaltbarer Duty-Cycle und Vibrato/Pitch-Slide)',
  ],
}

/* ================================================================== *
 * AMBIENT
 * ================================================================== */

// Cmaj9 – Am9 – Fmaj9 – Em7: diatonic, extended, and deliberately
// without a cadence — it drifts back to the start rather than resolving.
const ambient: GenreSpec = {
  bpm: 62,
  scaleId: 'major',
  sets: [
    { lead: 'piano', chords: 'synthPad', bass: 'subBass' },
    { lead: 'glockenspiel', chords: 'choirPad', bass: 'subBass' },
    { lead: 'dreamy', chords: 'strings', bass: 'subBass' },
    { lead: 'concertharp', chords: 'choirPad', bass: 'synthBass' },
    { lead: 'vibraphone', chords: 'dreamy', bass: 'synthBass' },
  ],
  demo: {
    bars: 4,
    // No kit at all. Ambient has no beat to keep.
    drums: [],
    // The bass enters a beat after each chord and holds past the bar
    // line, so the two never change at the same moment.
    bass: [
      { step: -12, at: 0.5, len: 4.2, vel: 0.5 },
      { step: -15, at: 4.5, len: 4.2, vel: 0.48 },
      { step: -19, at: 8.25, len: 4.2, vel: 0.5 },
      { step: -17, at: 12.5, len: 3.3, vel: 0.45 },
    ],
    // Long overlapping pad chords — each one still sounding when the
    // next arrives, the way Eno's tape loops never quite line up.
    chords: [
      ...chord([0, 4, 7, 11], 0, 4.6, 0.4),
      ...chord([-3, 4, 7, 11], 4, 4.6, 0.38),
      ...chord([-7, -3, 0, 4, 7], 8, 4.6, 0.4),
      ...chord([-5, -1, 2, 4], 12, 3.9, 0.36),
    ],
    // A handful of notes in sixteen beats, each entering off the bar
    // line and left to ring. The b over the Fmaj9 is a lydian colour,
    // not a mistake.
    lead: [
      { step: 19, at: 1.5, len: 3.4, vel: 0.4 },
      { step: 24, at: 4.5, len: 1.9, vel: 0.26 },
      { step: 16, at: 6, len: 2.9, vel: 0.36 },
      { step: 21, at: 9.5, len: 3.4, vel: 0.4 },
      { step: 23, at: 11, len: 1.4, vel: 0.24 },
      { step: 14, at: 13, len: 2.9, vel: 0.32 },
    ],
  },
  notes:
    'Referenzen: Brian Eno "Ambient 1: Music for Airports" (1/1 und 2/1), Harold Budd & Brian Eno "The Pearl", ' +
    'Stars of the Lid "Requiem for Dying Mothers", Aphex Twin "Selected Ambient Works Vol. II", ' +
    'Hiroshi Yoshimura "Music for Nine Post Cards". 62 BPM, C-Dur, Cmaj9–Am9–Fmaj9–Em7 — diatonisch, ' +
    'mit Septimen und Nonen, und bewusst ohne Kadenz: es driftet zum Anfang zurück, statt aufzulösen. ' +
    'Drums: keine. Ambient hat keinen Beat zu halten. Bass: Sub-Bass, setzt jeweils eine halbe Zählzeit ' +
    'nach dem Akkord ein und klingt über den Taktstrich hinaus, damit Bass und Fläche nie gleichzeitig ' +
    'wechseln. Chords: lange Pad-Akkorde, die einander überlappen — Enos Tonbandschleifen unterschiedlicher ' +
    'Länge, die nie ganz zusammenfallen. Lead: sechs Töne auf sechzehn Zählzeiten, jeder abseits der Eins, ' +
    'jeder ausklingen gelassen; das h über dem Fmaj9 ist eine lydische Farbe, kein Fehler.',
  missing: [
    'ebowGuitar (gestrichene, endlos gehaltene Gitarre — der Kern von Stars of the Lid)',
    'feltPiano (gedämpftes Klavier mit Mechanikgeräusch für die Budd/Eno-Klavierstücke)',
    'granularPad (eingefrorene, rückwärts laufende Textur als dritte Ebene)',
  ],
}

export const GENRES: Record<string, GenreSpec> = {
  synthwave,
  frenchHouse,
  dnb,
  gridrunner,
  chiptune,
  ambient,
}
