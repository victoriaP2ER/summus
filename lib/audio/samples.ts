import * as Tone from 'tone'
import { SAMPLE_MAP } from './sampleMap'

type NoteBuffers = Record<string, Tone.ToneAudioBuffer>

const cache = new Map<string, NoteBuffers>()
const pending = new Map<string, Promise<NoteBuffers>>()
const listeners = new Set<() => void>()

export function onSamplesChanged(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function announce(): void {
  for (const listener of listeners) listener()
}

export function samplesReady(folder: string): boolean {
  return cache.has(folder)
}

export function samplesLoading(folder: string): boolean {
  return pending.has(folder)
}

/**
 * Fetch and decode one instrument's notes, once.
 * Buffers are cached so switching between lanes — or rendering the song
 * offline — never downloads the same note twice.
 */
export function loadInstrumentSamples(folder: string): Promise<NoteBuffers> {
  const ready = cache.get(folder)
  if (ready) return Promise.resolve(ready)
  const inFlight = pending.get(folder)
  if (inFlight) return inFlight

  const map = SAMPLE_MAP[folder]
  if (!map) return Promise.resolve({})

  const job = (async () => {
    const entries = await Promise.all(
      Object.entries(map).map(async ([note, file]) => {
        const buffer = new Tone.ToneAudioBuffer()
        await buffer.load(`/samples/${folder}/${file}`)
        return [note, buffer] as const
      }),
    )
    const buffers = Object.fromEntries(entries) as NoteBuffers
    cache.set(folder, buffers)
    pending.delete(folder)
    announce()
    return buffers
  })()

  pending.set(folder, job)
  announce()
  return job
}

export function cachedSamples(folder: string): NoteBuffers | null {
  return cache.get(folder) ?? null
}
