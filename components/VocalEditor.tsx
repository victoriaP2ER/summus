'use client'

import { useEffect, useRef, useState } from 'react'
import { clsx } from './clsx'
import { Button, Field, Slider } from './ui'
import { engine } from '@/lib/audio/engine'
import { midiToName, snapToScale } from '@/lib/music'
import { useStore } from '@/lib/store'
import type { Loop, VocalSlice } from '@/lib/types'

const GUTTER = 50
const ROW = 13

interface Drag {
  sliceId: string
  startY: number
  originPitch: number
  moved: boolean
}

export function VocalEditor({ loop }: { loop: Loop }) {
  const dragRef = useRef<Drag | null>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [pxPerBeat, setPxPerBeat] = useState(70)
  const [rendering, setRendering] = useState(false)
  const [dirty, setDirty] = useState(false)

  const bpm = useStore((s) => s.bpm)
  const scaleRoot = useStore((s) => s.scaleRoot)
  const scaleId = useStore((s) => s.scaleId)
  const isPlaying = useStore((s) => s.isPlaying)
  const setVocal = useStore((s) => s.setVocal)

  const vocal = loop.vocal
  const slices = vocal?.slices ?? []

  const pitches = slices.flatMap((s) => [s.targetPitch, s.sourcePitch])
  const high = Math.ceil(Math.max(72, ...pitches)) + 2
  const low = Math.floor(Math.min(48, ...pitches)) - 2
  const rows = high - low + 1
  const totalBeats = Math.max(loop.bars * 4, ...slices.map((s) => s.start + s.duration), 4)
  const contentWidth = totalBeats * pxPerBeat
  const contentHeight = rows * ROW

  const update = (partial: Partial<NonNullable<Loop['vocal']>>) => {
    if (!vocal) return
    setVocal(loop.id, { ...vocal, ...partial })
    setDirty(true)
  }

  const updateSlices = (next: VocalSlice[]) => {
    if (!vocal) return
    setVocal(loop.id, { ...vocal, slices: next })
    setDirty(true)
  }

  useEffect(() => {
    if (!isPlaying) {
      if (playheadRef.current) playheadRef.current.style.opacity = '0'
      return
    }
    let frame = 0
    const tick = () => {
      const beats = engine().position() % totalBeats
      if (playheadRef.current) {
        playheadRef.current.style.opacity = '1'
        playheadRef.current.style.transform = `translateX(${beats * pxPerBeat}px)`
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, pxPerBeat, totalBeats])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag || !vocal) return
      const dy = event.clientY - drag.startY
      if (Math.abs(dy) > 2) drag.moved = true
      if (!drag.moved) return
      const shift = Math.round(dy / ROW)
      updateSlices(
        vocal.slices.map((s) =>
          s.id === drag.sliceId ? { ...s, targetPitch: drag.originPitch - shift } : s,
        ),
      )
    }
    const onUp = () => {
      dragRef.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocal])

  if (!vocal) return null

  const rerender = async () => {
    setRendering(true)
    await new Promise((r) => setTimeout(r, 20))
    engine().renderVocal(loop, bpm)
    setRendering(false)
    setDirty(false)
  }

  const playCorrected = () => {
    const buffer = engine().renderVocal(loop, bpm)
    if (buffer) engine().playBuffer(buffer)
    setDirty(false)
  }

  const playOriginal = () => {
    const raw = engine().getBuffer(vocal.bufferId)
    if (raw) engine().playBuffer(raw)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-ink-700 bg-ink-900 px-3 py-2">
        <div className="min-w-[9rem] flex-1">
          <Field label="Autotune" hint={`${Math.round(vocal.strength * 100)}%`}>
            <Slider
              value={vocal.strength}
              min={0}
              max={1}
              step={0.01}
              onChange={(strength) => update({ strength })}
            />
          </Field>
        </div>
        <div className="min-w-[9rem] flex-1">
          <Field label="Auf den Takt ziehen" hint={`${Math.round(vocal.timeFix * 100)}%`}>
            <Slider
              value={vocal.timeFix}
              min={0}
              max={1}
              step={0.01}
              onChange={(timeFix) => update({ timeFix })}
            />
          </Field>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={() =>
              updateSlices(
                vocal.slices.map((s) => ({
                  ...s,
                  targetPitch: Math.round(snapToScale(s.sourcePitch, scaleRoot, scaleId, 1)),
                })),
              )
            }
            title="Alle Silben in die Tonart ziehen"
          >
            In Tonart
          </Button>
          <Button
            size="sm"
            onClick={() =>
              updateSlices(vocal.slices.map((s) => ({ ...s, targetPitch: Math.round(s.sourcePitch) })))
            }
          >
            Original
          </Button>
          <Button size="sm" onClick={playOriginal}>
            ▶ Roh
          </Button>
          <Button size="sm" variant={dirty ? 'accent' : 'ghost'} onClick={playCorrected} disabled={rendering}>
            {rendering ? 'Rechne …' : '▶ Korrigiert'}
          </Button>
          {dirty && (
            <Button size="sm" onClick={rerender} title="Korrigierte Spur neu berechnen">
              Aktualisieren
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-ink-400">Zoom</span>
          <input
            type="range"
            min={26}
            max={180}
            value={pxPerBeat}
            onChange={(e) => setPxPerBeat(Number(e.target.value))}
            className="w-20 cursor-pointer"
          />
        </div>
      </div>

      <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-auto bg-ink-950">
        <div className="relative flex" style={{ width: GUTTER + contentWidth, height: contentHeight }}>
          <div
            className="sticky left-0 z-20 shrink-0 border-r border-ink-700 bg-ink-900"
            style={{ width: GUTTER }}
          >
            {Array.from({ length: rows }, (_, i) => {
              const midi = high - i
              return (
                <div
                  key={midi}
                  className={clsx(
                    'flex items-center justify-end border-b border-ink-800 pr-1.5 text-[9px]',
                    midi % 12 === 0 ? 'text-ink-200' : 'text-ink-500',
                  )}
                  style={{ height: ROW }}
                >
                  {midi % 12 === 0 && midiToName(midi)}
                </div>
              )
            })}
          </div>

          <div className="relative" style={{ width: contentWidth, height: contentHeight }}>
            {Array.from({ length: rows }, (_, i) => (
              <div
                key={i}
                className={clsx(
                  'absolute left-0 w-full border-b border-ink-900',
                  (high - i) % 12 === 0 ? 'bg-ink-800/50' : 'bg-ink-900/40',
                )}
                style={{ top: i * ROW, height: ROW }}
              />
            ))}
            {Array.from({ length: Math.ceil(totalBeats) + 1 }, (_, beat) => (
              <div
                key={beat}
                className={clsx('absolute top-0 h-full w-px', beat % 4 === 0 ? 'bg-ink-600' : 'bg-ink-800')}
                style={{ left: beat * pxPerBeat }}
              />
            ))}

            {slices.map((slice) => {
              const top = (high - slice.targetPitch) * ROW
              const sourceTop = (high - slice.sourcePitch) * ROW
              const width = Math.max(5, slice.duration * pxPerBeat)
              const cents = Math.round((slice.targetPitch - slice.sourcePitch) * 100)
              return (
                <div key={slice.id}>
                  {/* where you actually sang it */}
                  <div
                    className="pointer-events-none absolute rounded-full bg-white/25"
                    style={{
                      left: slice.start * pxPerBeat,
                      top: sourceTop + ROW / 2 - 1,
                      width,
                      height: 2,
                    }}
                  />
                  <div
                    onPointerDown={(event) => {
                      event.preventDefault()
                      dragRef.current = {
                        sliceId: slice.id,
                        startY: event.clientY,
                        originPitch: slice.targetPitch,
                        moved: false,
                      }
                    }}
                    onDoubleClick={() =>
                      updateSlices(
                        slices.map((s) => (s.id === slice.id ? { ...s, enabled: !s.enabled } : s)),
                      )
                    }
                    title={`gesungen ${midiToName(slice.sourcePitch)} → ${midiToName(slice.targetPitch)} (${cents > 0 ? '+' : ''}${cents} Cent)`}
                    className={clsx(
                      'absolute cursor-ns-resize rounded-[3px] border border-black/40',
                      !slice.enabled && 'opacity-25',
                    )}
                    style={{
                      left: slice.start * pxPerBeat,
                      top: top + 1,
                      width,
                      height: ROW - 2,
                      background: loop.color,
                    }}
                  />
                </div>
              )
            })}

            <div
              ref={playheadRef}
              className="pointer-events-none absolute top-0 z-20 h-full w-px bg-white opacity-0"
              style={{ boxShadow: '0 0 10px 1px rgba(255,255,255,0.7)' }}
            />
          </div>
        </div>
      </div>

      <p className="border-t border-ink-700 bg-ink-900 px-3 py-1.5 text-[10px] text-ink-400">
        Balken hoch/runter ziehen ändert die Zielnote · Doppelklick schaltet eine Silbe stumm · die
        helle Linie zeigt, wo du wirklich gesungen hast
      </p>
    </div>
  )
}
