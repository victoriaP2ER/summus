'use client'

import { useCallback, useEffect, useState } from 'react'
import { engine } from '@/lib/audio/engine'
import { micErrorMessage } from '@/lib/audio/recorder'
import { takeToDrumNotes, takeToNotes, takeToVocalSlices } from '@/lib/audio/convert'
import { detectTempo, tidyBpm } from '@/lib/audio/tempo'
import { LOOP_COLORS } from '@/lib/music'
import { useStore } from '@/lib/store'
import type { CaptureMode, InstrumentId } from '@/lib/types'

export type CaptureState = 'idle' | 'countin' | 'running' | 'working'

export interface CaptureResult {
  loopIds: string[]
  summary: string
  detectedBpm: number
  confident: boolean
}

/**
 * One take, straight into a playable lane. Shared by the quick record button
 * and the guided flow so both behave identically.
 */
export function useCapture() {
  const [state, setState] = useState<CaptureState>('idle')
  const [counter, setCounter] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<CaptureResult | null>(null)
  const bpm = useStore((s) => s.bpm)

  useEffect(() => {
    if (state === 'idle' || state === 'working') return
    let frame = 0
    const tick = () => {
      const window = engine().recordWindow
      if (window) {
        const now = engine().now()
        const beat = 60 / bpm
        if (now < window.transportStart) {
          setCounter(String(Math.max(1, Math.ceil((window.transportStart - now) / beat))))
          setState('countin')
        } else {
          const into = (now - window.transportStart) / beat
          setCounter(`Takt ${Math.min(Math.floor(into / 4) + 1, window.bars)}/${window.bars}`)
          setState('running')
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [state, bpm])

  const applyTake = useCallback(
    (buffer: AudioBuffer, mode: CaptureMode, instrument: InstrumentId, bars: number): CaptureResult | null => {
      const store = useStore.getState()
      const tempo = detectTempo(buffer)
      const convert = {
        bpm: store.bpm,
        grid: store.grid,
        snapScale: store.snapScale,
        scaleRoot: store.scaleRoot,
        scaleId: store.scaleId,
      }
      const colour = LOOP_COLORS[store.loops.length % LOOP_COLORS.length]
      const base = { detectedBpm: tidyBpm(tempo.bpm), confident: tempo.confidence > 0.3 }

      if (mode === 'beatbox') {
        const notes = takeToDrumNotes(buffer, { ...convert, simplify: true })
        if (notes.length < 2) return null
        const loop = store.addLoop({ name: 'Beat', kind: 'drum', instrument: 'drums', bars, notes, color: colour })
        return { ...base, loopIds: [loop.id], summary: `Beat mit ${notes.length} Schlägen` }
      }

      if (mode === 'vocal') {
        const slices = takeToVocalSlices(buffer, convert)
        if (!slices.length) return null
        const bufferId = engine().storeBuffer(buffer)
        const vocal = { bufferId, slices, strength: 0.85, timeFix: 0.6, blend: 1 }
        const loop = store.addLoop({
          name: `Gesang ${store.loops.length + 1}`,
          kind: 'vocal',
          instrument: 'synthPad',
          bars,
          notes: [],
          vocal,
          color: colour,
        })
        engine().renderVocal({ ...loop, vocal }, store.bpm)
        return { ...base, loopIds: [loop.id], summary: `Gesang mit ${slices.length} Silben` }
      }

      const notes = takeToNotes(buffer, convert)
      if (!notes.length) return null
      const loop = store.addLoop({
        name: `Melodie ${store.loops.filter((l) => l.kind === 'melodic').length + 1}`,
        instrument,
        bars,
        notes,
        color: colour,
      })
      return { ...base, loopIds: [loop.id], summary: `Melodie mit ${notes.length} Noten` }
    },
    [],
  )

  const capture = useCallback(
    async (options: { mode: CaptureMode; instrument: InstrumentId; bars: number; overdub?: boolean }) => {
      const store = useStore.getState()
      setError('')
      setResult(null)
      setState('countin')
      try {
        store.patch({ isRecording: true, isPlaying: false })
        await engine().record(
          {
            countInBars: store.countInBars,
            bars: options.bars,
            overdub: options.overdub ?? store.overdub,
            metronome: store.metronome,
            micMode: store.micMode,
            latencyMs: store.latencyMs,
            onFinished: (buffer) => {
              setState('working')
              useStore.getState().patch({ isRecording: false })
              if (!buffer) {
                setError('Es ist kein Ton angekommen. Ist das richtige Mikrofon ausgewählt?')
                setState('idle')
                return
              }
              const applied = applyTake(buffer, options.mode, options.instrument, options.bars)
              if (!applied) {
                setError(
                  options.mode === 'beatbox'
                    ? 'Zu wenig Schläge erkannt — probier ein klares "Bum – Tss".'
                    : 'Da war nichts Erkennbares. Etwas lauter summen und Töne aushalten hilft.',
                )
                setState('idle')
                return
              }
              setResult(applied)
              setState('idle')
            },
          },
          store.loops,
          store.clips,
          Math.max(options.bars, store.songBars()),
        )
      } catch (e) {
        useStore.getState().patch({ isRecording: false })
        setError(micErrorMessage(e))
        setState('idle')
      }
    },
    [applyTake],
  )

  /** Same pipeline, but from a file someone already recorded elsewhere. */
  const importTake = useCallback(
    async (file: File | Blob, instrument: InstrumentId, bars: number, mode: CaptureMode = 'hum') => {
      setError('')
      setResult(null)
      setState('working')
      try {
        await engine().start()
        const buffer = await engine().decode(file)
        const applied = applyTake(buffer, mode, instrument, bars)
        if (!applied) {
          setError('In dieser Datei war nichts Erkennbares.')
        } else {
          setResult(applied)
        }
      } catch {
        setError('Diese Datei konnte nicht gelesen werden.')
      } finally {
        setState('idle')
      }
    },
    [applyTake],
  )

  const stop = useCallback(() => engine().cancelRecord(), [])

  return {
    state,
    counter,
    error,
    result,
    capture,
    importTake,
    stop,
    clear: () => {
      setResult(null)
      setError('')
    },
  }
}
