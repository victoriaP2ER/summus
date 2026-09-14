/**
 * Starting levels for the parts of a generated arrangement, in decibels.
 *
 * Measured, not guessed: with every part at the same level, the rhythm guitar
 * sat 6 dB above the bass and 9 dB above the kit. A drum hit is a transient and
 * a sustained chord is not, so equal peaks are nowhere near equal loudness.
 * The rhythm section carries a track — it should not be the quietest thing in it.
 */
export const LEVELS = {
  drums: 2,
  bass: 0,
  chords: -8,
  lead: -2,
} as const
