'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clsx } from './clsx'
import { Button } from './ui'
import { engine } from '@/lib/audio/engine'
import { quantize, uid } from '@/lib/music'
import { useStore } from '@/lib/store'
import type { DrumVoice, Loop } from '@/lib/types'

interface Pad {
  voice: DrumVoice
  label: string
  key: string
  color: string
}

/** Laid out like a pad controller: kick and snare under the strong hand. */
const PADS: Pad[] = [
  { voice: 'crash', label: 'Crash', key: 'y', color: '#fbbf24' },
  { voice: 'openhat', label: 'Open Hat', key: 'x', color: '#60a5fa' },
  { voice: 'hat', label: 'Hi-Hat', key: 'c', color: '#22d3ee' },
  { voice: 'rim', label: 'Rim', key: 'v', color: '#a78bfa' },
  { voice: 'clap', label: 'Clap', key: 'a', color: '#f472b6' },
  { voice: 'tom', label: 'Tom', key: 's', color: '#fb923c' },
  { voice: 'snare', label: 'Snare', key: 'd', color: '#f43f5e' },
  { voice: 'kick', label: 'Kick', key: 'f', color: '#34d399' },
]

export function DrumPads({ loop }: { loop: Loop }) {
  const [armed, setArmed] = useState(true)
  const [snap, setSnap] = useState(true)
  const [hit, setHit] = useState<DrumVoice | null>(null)
  const held = useRef(new Set<string>())

  const grid = useStore((s) => s.grid)
  const isPlaying = useStore((s) => s.isPlaying)
  const setNotes = useStore((s) => s.setNotes)

  const totalBeats = loop.bars * 4

  const strike = useCallback(
    (voice: DrumVoice, velocity = 0.9) => {
      void engine().start()
      engine().previewDrum(loop.id, voice, velocity)
      setHit(voice)
      window.setTimeout(() => setHit((current) => (current === voice ? null : current)), 110)

      if (!armed || !useStore.getState().isPlaying) return
      // Write the hit where the playhead is, so you can simply tap along.
      const raw = engine().position() % totalBeats
      const start = snap && grid > 0 ? quantize(raw, grid) % totalBeats : raw
      const current = useStore.getState().loops.find((l) => l.id === loop.id)
      if (!current) return
      const clash = current.notes.some(
        (n) => n.drum === voice && Math.abs(n.start - start) < 0.001,
      )
      if (clash) return
      setNotes(loop.id, [
        ...current.notes,
        { id: uid('d'), start: Math.max(0, start), duration: 0.25, pitch: 36, velocity, drum: voice },
      ])
    },
    [armed, grid, loop.id, setNotes, snap, totalBeats],
  )

  // Letter keys double as pads, so a laptop works like a controller.
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable) return
      const key = event.key.toLowerCase()
      const pad = PADS.find((p) => p.key === key)
      if (!pad || event.repeat || held.current.has(key)) return
      event.preventDefault()
      held.current.add(key)
      strike(pad.voice, 0.92)
    }
    const up = (event: KeyboardEvent) => held.current.delete(event.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [strike])

  return (
    <div className="border-t border-ink-700 bg-ink-900 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold tracking-[0.14em] text-ink-400 uppercase">
          Pads
        </span>
        <Button size="sm" active={armed} onClick={() => setArmed(!armed)}>
          {armed ? '● Schläge werden aufgenommen' : 'Nur anhören'}
        </Button>
        <Button size="sm" active={snap} onClick={() => setSnap(!snap)} title="Schläge aufs Raster ziehen">
          Aufs Raster
        </Button>
        {armed && !isPlaying && (
          <span className="text-[10px] text-amber-300">
            Starte die Wiedergabe — dann landen deine Schläge in der Spur.
          </span>
        )}
        <Button
          size="sm"
          variant="danger"
          className="ml-auto"
          onClick={() => setNotes(loop.id, [])}
          title="Alle Schläge dieser Spur löschen"
        >
          Leeren
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {PADS.map((pad) => (
          <button
            key={pad.voice}
            type="button"
            // Pointer events cover trackpad, mouse and touch in one path.
            onPointerDown={(event) => {
              event.preventDefault()
              const box = event.currentTarget.getBoundingClientRect()
              // Hitting lower on the pad plays softer, like a real one.
              const depth = (event.clientY - box.top) / box.height
              strike(pad.voice, Math.max(0.35, 1.05 - depth * 0.6))
            }}
            className={clsx(
              'touch-none rounded-xl border-2 py-4 text-center transition-all select-none active:scale-95',
              hit === pad.voice ? 'border-white' : 'border-ink-700',
            )}
            style={{
              background:
                hit === pad.voice
                  ? `${pad.color}`
                  : `linear-gradient(180deg, ${pad.color}33, ${pad.color}14)`,
            }}
          >
            <span
              className={clsx(
                'block text-[11px] font-semibold',
                hit === pad.voice ? 'text-ink-950' : 'text-ink-100',
              )}
            >
              {pad.label}
            </span>
            <span
              className={clsx(
                'mt-0.5 block font-mono text-[9px] uppercase',
                hit === pad.voice ? 'text-ink-950/70' : 'text-ink-400',
              )}
            >
              {pad.key}
            </span>
          </button>
        ))}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-ink-500">
        Tippen, klicken oder die Buchstaben drücken. Weiter unten auf dem Pad wird leiser
        angeschlagen.
      </p>
    </div>
  )
}
