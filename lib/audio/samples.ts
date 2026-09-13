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

const KIT_VOICES = ['kick', 'snare', 'rim', 'tom', 'hat', 'openhat', 'clap'] as const
let kitBuffers: Partial<Record<string, Tone.ToneAudioBuffer>> | null = null
let kitJob: Promise<void> | null = null

/** One-shot recordings of a real kit, loaded once for the whole app. */
export function loadDrumKit(): Promise<void> {
  if (kitBuffers) return Promise.resolve()
  if (kitJob) return kitJob
  kitJob = (async () => {
    const entries = await Promise.all(
      KIT_VOICES.map(async (voice) => {
        const buffer = new Tone.ToneAudioBuffer()
        try {
          await buffer.load(`/samples/drums/${voice}.mp3`)
          return [voice, buffer] as const
        } catch {
          return [voice, undefined] as const
        }
      }),
    )
    kitBuffers = Object.fromEntries(entries)
    kitJob = null
    announce()
  })()
  return kitJob
}

export function drumBuffer(voice: string): AudioBuffer | null {
  return kitBuffers?.[voice]?.get() ?? null
}

export function drumKitReady(): boolean {
  return kitBuffers !== null
}

export function cachedSamples(folder: string): NoteBuffers | null {
  return cache.get(folder) ?? null
}

/**
 * Raw buffers for building a Sampler.
 * Tone disposes whatever buffers a Sampler was handed, so the cache must never
 * give out its own ToneAudioBuffer objects — the next Sampler would find them
 * dead and throw "No available buffers".
 */
export function sampleBuffers(folder: string): Record<string, AudioBuffer> | null {
  const buffers = cache.get(folder)
  if (!buffers) return null
  const out: Record<string, AudioBuffer> = {}
  for (const [note, buffer] of Object.entries(buffers)) {
    const raw = buffer.get()
    if (raw) out[note] = raw
  }
  return out
}
