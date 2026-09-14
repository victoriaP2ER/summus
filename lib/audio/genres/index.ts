import type { StyleDemo } from '../demos'
import { GENRES as ELECTRONIC } from './electronic'

export interface GenreSpec {
  bpm: number
  scaleId: string
  sets: { lead: string; chords: string; bass: string }[]
  demo: StyleDemo
  notes: string
  missing?: string[]
}

/**
 * Genres whose groove, tempo and line-ups were written against real reference
 * recordings. These take precedence over the older patterns in `demos.ts`.
 */
export const GENRE_SPECS: Record<string, GenreSpec> = {
  ...ELECTRONIC,
}

export function genreSpec(styleId: string): GenreSpec | undefined {
  return GENRE_SPECS[styleId]
}
