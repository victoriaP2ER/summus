'use client'

import * as Tone from 'tone'
import { createInstrument, prepareInstrument } from './instruments'
import { loadDrumKit } from './samples'
import { engine } from './engine'
import { dedupeNotes } from '../music'
import type { Clip, Loop } from '../types'

export interface RenderOptions {
  bpm: number
  bars: number
  sampleRate?: number
  /** Seconds of room for reverb tails to ring out */
  tail?: number
}

/**
 * Renders the arrangement faster than real time into a single buffer.
 * Everything is scheduled at absolute times, so no transport is involved and
 * the result is deterministic.
 */
export async function renderSong(
  loops: Loop[],
  clips: Clip[],
  options: RenderOptions,
): Promise<AudioBuffer> {
  const { bpm, bars, sampleRate = 44100, tail = 2.5 } = options
  // Offline rendering cannot wait on the network, so every recording the song
  // uses has to be in memory before we start.
  await Promise.all([loadDrumKit(), ...new Set(loops.map((l) => l.instrument))].map((job) =>
    typeof job === 'string' ? prepareInstrument(job) : job,
  ))
  const beatSeconds = 60 / bpm
  const duration = Math.max(1, bars * 4 * beatSeconds + tail)
  const anySolo = loops.some((l) => l.solo)

  const rendered = await Tone.Offline(
    async () => {
      const limiter = new Tone.Limiter(-1).toDestination()
      const master = new Tone.Volume(-7).connect(limiter)

      for (const clip of clips) {
        const loop = loops.find((l) => l.id === clip.loopId)
        if (!loop) continue
        const audible = anySolo ? loop.solo : !loop.muted
        if (!audible) continue

        if (loop.kind === 'vocal') {
          const source =
            engine().rendered.get(loop.id) ??
            (loop.vocal ? engine().getBuffer(loop.vocal.bufferId) : undefined)
          if (!source) continue
          for (let r = 0; r < Math.max(1, clip.repeats); r++) {
            const at = (clip.startBar + r * loop.bars) * 4 * beatSeconds
            if (at >= duration) break
            const player = new Tone.Player(source).connect(master)
            player.volume.value = loop.volume
            player.start(at)
          }
          continue
        }

        if (!loop.notes.length) continue
        const instrument = createInstrument(loop.instrument)
        instrument.output.connect(master)
        instrument.output.volume.value = loop.volume

        const notes = dedupeNotes(loop.notes)
        for (let r = 0; r < Math.max(1, clip.repeats); r++) {
          const barOffset = (clip.startBar + r * loop.bars) * 4
          for (const note of notes) {
            const at = (barOffset + note.start) * beatSeconds
            if (at >= duration) continue
            if (loop.kind === 'drum' || instrument.isDrum) {
              instrument.triggerDrum(note.drum ?? 'kick', at, note.velocity)
            } else {
              instrument.trigger(
                note.pitch + loop.transpose,
                note.duration * beatSeconds,
                at,
                note.velocity,
              )
            }
          }
        }
      }
    },
    duration,
    2,
    sampleRate,
  )

  const buffer = rendered.get() as AudioBuffer
  normalise(buffer, 0.89)
  return buffer
}

/**
 * Bring the render to a fixed peak.
 *
 * The limiter catches sustained loudness but a dense arrangement can still push
 * a single transient past full scale, and a WAV clips there. Scaling the whole
 * render keeps the balance and guarantees clean headroom.
 */
function normalise(buffer: AudioBuffer, target: number): void {
  let peak = 0
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]))
  }
  if (peak < 1e-5 || peak <= target) return
  const gain = target / peak
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c)
    for (let i = 0; i < data.length; i++) data[i] *= gain
  }
}

/** 16-bit PCM WAV — lossless and playable everywhere. */
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const channels = Math.min(2, buffer.numberOfChannels)
  const frames = buffer.length
  const bytesPerSample = 2
  const blockAlign = channels * bytesPerSample
  const dataSize = frames * blockAlign
  const view = new DataView(new ArrayBuffer(44 + dataSize))

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, buffer.sampleRate, true)
  view.setUint32(28, buffer.sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  const data: Float32Array[] = []
  for (let c = 0; c < channels; c++) data.push(buffer.getChannelData(c))

  let offset = 44
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const sample = Math.max(-1, Math.min(1, data[c][i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }
  }

  return new Blob([view.buffer], { type: 'audio/wav' })
}

function toInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return out
}

/** MP3 via LAME — the format you can actually send someone. */
export async function audioBufferToMp3(buffer: AudioBuffer, kbps = 192): Promise<Blob> {
  const { Mp3Encoder } = await import('@breezystack/lamejs')
  const channels = Math.min(2, buffer.numberOfChannels)
  const encoder = new Mp3Encoder(channels, buffer.sampleRate, kbps)

  const left = toInt16(buffer.getChannelData(0))
  const right = channels > 1 ? toInt16(buffer.getChannelData(1)) : null

  const blocks: Uint8Array[] = []
  const CHUNK = 1152
  for (let i = 0; i < left.length; i += CHUNK) {
    const l = left.subarray(i, i + CHUNK)
    const chunk = right
      ? encoder.encodeBuffer(l, right.subarray(i, i + CHUNK))
      : encoder.encodeBuffer(l)
    if (chunk.length) blocks.push(new Uint8Array(chunk))
  }
  const flushed = encoder.flush()
  if (flushed.length) blocks.push(new Uint8Array(flushed))

  return new Blob(blocks as BlobPart[], { type: 'audio/mpeg' })
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function safeFilename(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'summus-song'
  )
}
