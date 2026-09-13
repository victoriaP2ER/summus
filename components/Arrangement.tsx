'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from './clsx'
import { Button } from './ui'
import { engine } from '@/lib/audio/engine'
import { instrumentMeta } from '@/lib/audio/instruments'
import { useStore } from '@/lib/store'
import type { Clip, Loop } from '@/lib/types'

const GUTTER = 132
const ROW = 46
const RULER = 26

interface ClipDrag {
  clipId: string
  kind: 'move' | 'repeat'
  startX: number
  originBar: number
  originRepeats: number
  loopBars: number
  moved: boolean
}

export function Arrangement() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const laneRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<ClipDrag | null>(null)

  const [pxPerBar, setPxPerBar] = useState(64)
  const [follow, setFollow] = useState(true)

  const loops = useStore((s) => s.loops)
  const clips = useStore((s) => s.clips)
  const isPlaying = useStore((s) => s.isPlaying)
  const playMode = useStore((s) => s.playMode)
  const selectedLoopId = useStore((s) => s.selectedLoopId)
  const selectLoop = useStore((s) => s.selectLoop)
  const updateClip = useStore((s) => s.updateClip)
  const removeClip = useStore((s) => s.removeClip)
  const addClip = useStore((s) => s.addClip)
  const songBars = useStore((s) => s.songBars)

  const totalBars = Math.max(songBars() + 4, 16)
  const contentWidth = totalBars * pxPerBar
  const contentHeight = Math.max(loops.length, 1) * ROW

  useEffect(() => {
    if (!isPlaying || playMode !== 'song') {
      if (playheadRef.current) playheadRef.current.style.opacity = '0'
      return
    }
    let frame = 0
    const tick = () => {
      const bars = engine().position() / 4
      const x = bars * pxPerBar
      if (playheadRef.current) {
        playheadRef.current.style.opacity = '1'
        playheadRef.current.style.transform = `translateX(${x}px)`
      }
      const el = scrollRef.current
      if (el && follow) {
        const view = el.clientWidth - GUTTER
        if (x < el.scrollLeft - 20 || x > el.scrollLeft + view - 120) {
          el.scrollLeft = Math.max(0, x - view * 0.3)
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, playMode, pxPerBar, follow])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current
      if (!drag) return
      const dx = event.clientX - drag.startX
      if (Math.abs(dx) > 2) drag.moved = true
      if (!drag.moved) return
      if (drag.kind === 'move') {
        const bars = Math.round(dx / pxPerBar)
        updateClip(drag.clipId, { startBar: Math.max(0, drag.originBar + bars) })
      } else {
        // Dragging the right edge sets the *length* you want; the loop fills it
        // with as many repeats as fit.
        const lane = laneRef.current?.getBoundingClientRect()
        if (!lane) return
        const endBar = (event.clientX - lane.left) / pxPerBar
        const lengthBars = Math.max(drag.loopBars, endBar - drag.originBar)
        updateClip(drag.clipId, { repeats: Math.max(1, Math.round(lengthBars / drag.loopBars)) })
      }
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
  }, [pxPerBar, updateClip])

  const rows = useMemo(
    () =>
      loops.map((loop) => ({
        loop,
        clips: clips.filter((c) => c.loopId === loop.id),
      })),
    [loops, clips],
  )

  const beginDrag = (event: React.PointerEvent, clip: Clip, kind: ClipDrag['kind'], loopBars: number) => {
    event.stopPropagation()
    event.preventDefault()
    dragRef.current = {
      clipId: clip.id,
      kind,
      startX: event.clientX,
      originBar: clip.startBar,
      originRepeats: clip.repeats,
      loopBars: Math.max(1, loopBars),
      moved: false,
    }
  }

  /** How far the longest lane reaches — the natural target when filling up. */
  const songEndBar = clips.reduce((end, clip) => {
    const source = loops.find((l) => l.id === clip.loopId)
    if (!source) return end
    return Math.max(end, clip.startBar + source.bars * clip.repeats)
  }, 0)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-ink-700 bg-ink-900 px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">
          Arrangement
        </h2>
        <span className="font-mono text-[10px] text-ink-400">{songBars()} Takte</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[10px] text-ink-400">Zoom</span>
          <input
            type="range"
            min={24}
            max={180}
            value={pxPerBar}
            onChange={(e) => setPxPerBar(Number(e.target.value))}
            className="w-24 cursor-pointer"
          />
          <Button size="sm" active={follow} onClick={() => setFollow(!follow)}>
            Mitlaufen
          </Button>
        </div>
      </div>

      {loops.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[11px] leading-relaxed text-ink-400">
          Sobald du etwas eingesummt hast, erscheinen hier die Lanes.
          <br />
          Blöcke lassen sich verschieben und am rechten Rand verlängern.
        </div>
      ) : (
        <div ref={scrollRef} className="scroll-thin min-h-0 flex-1 overflow-auto bg-ink-950">
          <div className="relative" style={{ width: GUTTER + contentWidth, height: RULER + contentHeight }}>
            <div className="sticky top-0 z-30 flex" style={{ height: RULER }}>
              <div
                className="sticky left-0 z-40 border-r border-b border-ink-700 bg-ink-900"
                style={{ width: GUTTER }}
              />
              <div className="relative border-b border-ink-700 bg-ink-900" style={{ width: contentWidth }}>
                {Array.from({ length: totalBars }, (_, bar) => (
                  <div
                    key={bar}
                    className={clsx(
                      'absolute top-0 flex h-full items-center pl-1 font-mono text-[10px]',
                      bar % 4 === 0 ? 'border-l border-ink-500 text-ink-300' : 'border-l border-ink-700 text-ink-500',
                    )}
                    style={{ left: bar * pxPerBar, width: pxPerBar }}
                  >
                    {bar % 4 === 0 || pxPerBar > 52 ? bar + 1 : ''}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex" style={{ height: contentHeight }}>
              <div
                className="sticky left-0 z-20 shrink-0 border-r border-ink-700 bg-ink-900"
                style={{ width: GUTTER }}
              >
                {rows.map(({ loop }) => (
                  <button
                    key={loop.id}
                    type="button"
                    onClick={() => selectLoop(loop.id)}
                    className={clsx(
                      'flex w-full items-center gap-2 border-b border-ink-800 px-2 text-left transition-colors',
                      loop.id === selectedLoopId ? 'bg-ink-800' : 'hover:bg-ink-850',
                    )}
                    style={{ height: ROW }}
                  >
                    <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: loop.color }} />
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-medium text-ink-100">
                        {loop.name}
                      </span>
                      <span className="block truncate font-mono text-[9px] text-ink-400">
                        {instrumentMeta(loop.instrument).label}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              <div ref={laneRef} className="relative" style={{ width: contentWidth, height: contentHeight }}>
                {rows.map(({ loop, clips: laneClips }, index) => (
                  <LaneTrack
                    key={loop.id}
                    loop={loop}
                    clips={laneClips}
                    index={index}
                    pxPerBar={pxPerBar}
                    totalBars={totalBars}
                    onBeginDrag={beginDrag}
                    onRemove={removeClip}
                    onAdd={(bar) => addClip(loop.id, bar, index)}
                    songEndBar={songEndBar}
                    onFill={(clip) =>
                      updateClip(clip.id, {
                        repeats: Math.max(1, Math.ceil((songEndBar - clip.startBar) / loop.bars)),
                      })
                    }
                  />
                ))}

                {Array.from({ length: totalBars + 1 }, (_, bar) => (
                  <div
                    key={bar}
                    className={clsx(
                      'pointer-events-none absolute top-0 h-full w-px',
                      bar % 4 === 0 ? 'bg-ink-700' : 'bg-ink-800/70',
                    )}
                    style={{ left: bar * pxPerBar }}
                  />
                ))}

                <div
                  ref={playheadRef}
                  className="pointer-events-none absolute top-0 z-20 h-full w-px bg-white opacity-0"
                  style={{ boxShadow: '0 0 10px 1px rgba(255,255,255,0.7)' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function LaneTrack({
  loop,
  clips,
  index,
  pxPerBar,
  totalBars,
  onBeginDrag,
  onRemove,
  onAdd,
  songEndBar,
  onFill,
}: {
  loop: Loop
  clips: Clip[]
  index: number
  pxPerBar: number
  totalBars: number
  onBeginDrag: (event: React.PointerEvent, clip: Clip, kind: ClipDrag['kind'], loopBars: number) => void
  onRemove: (id: string) => void
  onAdd: (bar: number) => void
  songEndBar: number
  onFill: (clip: Clip) => void
}) {
  return (
    <div
      className="absolute left-0 w-full border-b border-ink-800"
      style={{ top: index * ROW, height: ROW }}
      onDoubleClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        onAdd(Math.max(0, Math.floor((e.clientX - rect.left) / pxPerBar)))
      }}
    >
      {clips.map((clip) => {
        const width = loop.bars * clip.repeats * pxPerBar
        return (
          <div
            key={clip.id}
            onPointerDown={(e) => onBeginDrag(e, clip, 'move', loop.bars)}
            onContextMenu={(e) => {
              e.preventDefault()
              onRemove(clip.id)
            }}
            title={`${loop.name} · Takt ${clip.startBar + 1} · ${clip.repeats}×${loop.bars} Takte`}
            className="group absolute top-1.5 cursor-grab overflow-hidden rounded-md border border-black/40 active:cursor-grabbing"
            style={{
              left: clip.startBar * pxPerBar,
              width: Math.max(20, width),
              height: ROW - 12,
              background: `linear-gradient(180deg, ${loop.color}dd, ${loop.color}88)`,
            }}
          >
            <span className="pointer-events-none absolute inset-0 flex items-center truncate px-1.5 text-[10px] font-semibold text-black/75">
              {loop.name}
              {clip.repeats > 1 && ` ×${clip.repeats}`}
            </span>
            {/* repeat boundaries so you can see the loop restart */}
            {Array.from({ length: Math.max(0, clip.repeats - 1) }, (_, i) => (
              <span
                key={i}
                className="pointer-events-none absolute top-0 h-full w-px bg-black/30"
                style={{ left: (i + 1) * loop.bars * pxPerBar }}
              />
            ))}
            {/* fill the clip up to wherever the longest lane ends */}
            {clip.startBar + loop.bars * clip.repeats < songEndBar && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onFill(clip)
                }}
                title={`Bis Takt ${songEndBar} wiederholen`}
                className="absolute top-1/2 right-3.5 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded border border-black/40 bg-black/35 text-[9px] font-bold text-white/90 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/60"
              >
                ⟳
              </button>
            )}
            <span
              onPointerDown={(e) => onBeginDrag(e, clip, 'repeat', loop.bars)}
              className="absolute top-0 right-0 h-full w-2.5 cursor-ew-resize bg-black/0 group-hover:bg-black/25"
            />
          </div>
        )
      })}
      {!clips.length && (
        <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-[10px] text-ink-500">
          Doppelklick legt einen Block an
        </span>
      )}
      <span className="sr-only">{totalBars}</span>
    </div>
  )
}
