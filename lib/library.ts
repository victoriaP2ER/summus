'use client'

import { audioBufferToWav } from './audio/export'
import type { Clip, Loop } from './types'

const DB_NAME = 'summus'
const DB_VERSION = 1
const STORE = 'songs'

export interface SongRecord {
  id: string
  name: string
  bpm: number
  scaleRoot: number
  scaleId: string
  grid: number
  snapScale: boolean
  loops: Loop[]
  clips: Clip[]
  createdAt: number
  updatedAt: number
  /** Raw vocal takes, keyed by buffer id, stored as WAV */
  audio: Record<string, ArrayBuffer>
}

export interface SongSummary {
  id: string
  name: string
  bpm: number
  updatedAt: number
  createdAt: number
  laneCount: number
  bars: number
  instruments: string[]
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB nicht verfügbar'))
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode)
        const request = run(transaction.objectStore(STORE))
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error ?? new Error('Speichern fehlgeschlagen'))
        transaction.oncomplete = () => db.close()
      }),
  )
}

function songBars(loops: Loop[], clips: Clip[]): number {
  let end = 0
  for (const clip of clips) {
    const loop = loops.find((l) => l.id === clip.loopId)
    if (!loop) continue
    end = Math.max(end, clip.startBar + loop.bars * clip.repeats)
  }
  return end
}

export function summarise(song: SongRecord): SongSummary {
  return {
    id: song.id,
    name: song.name,
    bpm: song.bpm,
    updatedAt: song.updatedAt,
    createdAt: song.createdAt,
    laneCount: song.loops.length,
    bars: songBars(song.loops, song.clips),
    instruments: [...new Set(song.loops.map((l) => l.instrument))],
  }
}

export async function listSongs(): Promise<SongSummary[]> {
  try {
    const all = await tx<SongRecord[]>('readonly', (store) => store.getAll() as IDBRequest<SongRecord[]>)
    return all.map(summarise).sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

export async function loadSong(id: string): Promise<SongRecord | null> {
  try {
    const song = await tx<SongRecord | undefined>('readonly', (store) => store.get(id))
    return song ?? null
  } catch {
    return null
  }
}

export async function saveSong(song: SongRecord): Promise<void> {
  await tx('readwrite', (store) => store.put(song))
}

export async function deleteSong(id: string): Promise<void> {
  await tx('readwrite', (store) => store.delete(id))
}

/** Bundle the vocal takes as WAV so a saved song still sings after a reload. */
export async function collectAudioAsync(
  loops: Loop[],
  getBuffer: (id: string) => AudioBuffer | undefined,
): Promise<Record<string, ArrayBuffer>> {
  const audio: Record<string, ArrayBuffer> = {}
  for (const loop of loops) {
    const bufferId = loop.vocal?.bufferId
    if (!bufferId || audio[bufferId]) continue
    const buffer = getBuffer(bufferId)
    if (!buffer) continue
    audio[bufferId] = await audioBufferToWav(buffer).arrayBuffer()
  }
  return audio
}

// ---------------------------------------------------------------- share links

export interface SharePayload {
  v: 1
  name: string
  bpm: number
  scaleRoot: number
  scaleId: string
  grid: number
  loops: Loop[]
  clips: Clip[]
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function gzip(text: string): Promise<Uint8Array> {
  const input = new TextEncoder().encode(text)
  if (typeof CompressionStream === 'undefined') return input
  const stream = new Blob([input as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  if (typeof DecompressionStream === 'undefined') return new TextDecoder().decode(bytes)
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream('gzip'))
  return new TextDecoder().decode(await new Response(stream).arrayBuffer())
}

/**
 * Packs a song into the URL itself. Note-based lanes travel fine; raw vocal
 * audio is far too large for a link, so those lanes are left behind.
 */
export async function encodeShare(payload: SharePayload): Promise<string> {
  const slim: SharePayload = {
    ...payload,
    loops: payload.loops
      .filter((l) => l.kind !== 'vocal')
      .map((l) => ({ ...l, vocal: undefined })),
  }
  slim.clips = payload.clips.filter((c) => slim.loops.some((l) => l.id === c.loopId))
  return toBase64Url(await gzip(JSON.stringify(slim)))
}

export async function decodeShare(token: string): Promise<SharePayload | null> {
  try {
    const json = await gunzip(fromBase64Url(token))
    const parsed = JSON.parse(json) as SharePayload
    if (parsed.v !== 1 || !Array.isArray(parsed.loops)) return null
    return parsed
  } catch {
    return null
  }
}

/** How many vocal lanes a share link has to drop. */
export function vocalLaneCount(loops: Loop[]): number {
  return loops.filter((l) => l.kind === 'vocal').length
}
