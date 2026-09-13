'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from './clsx'
import { Button } from './ui'
import { InstrumentPicker } from './InstrumentPicker'
import { DRUM_VOICES, instrumentMeta } from '@/lib/audio/instruments'
import { engine } from '@/lib/audio/engine'
import { isInScale, midiToName, quantize, uid } from '@/lib/music'
import { useStore } from '@/lib/store'
import type { DrumVoice, Loop, Note } from '@/lib/types'

const ABS_LOW = 21
const ABS_HIGH = 108
const GUTTER = 58
const RULER = 26
/** Semitones of empty space kept above and below the notes */
const PAD = 4
const MIN_SPAN = 23

type Tool = 'select' | 'draw'
type DragKind = 'move' | 'resize' | 'velocity'

interface DragState {
  kind: DragKind
  noteIds: string[]
  startX: number
  startY: number
  origin: Map<string, Note>
  moved: boolean
}

interface Range {
  low: number
  high: number
}

function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12)
}

/** Show the stretch of the scale the lane actually uses, plus a little room. */
function computeRange(notes: Note[]): Range {
  const pitches = notes.filter((n) => !n.drum).map((n) => n.pitch)
  if (!pitches.length) return { low: 55, high: 79 }
  let low = Math.min(...pitches) - PAD
  let high = Math.max(...pitches) + PAD
  while (high - low < MIN_SPAN) {
    high += 1
    if (high - low < MIN_SPAN) low -= 1
  }
  return { low: Math.max(ABS_LOW, low), high: Math.min(ABS_HIGH, high) }
}

export function PianoRoll({ loop }: { loop: Loop }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const scrubRef = useRef(false)
  const scrubbedRef = useRef(new Set<string>())
  const hoveredRef = useRef<string | null>(null)

  const [tool, setTool] = useState<Tool>('select')
  const [pxPerBeat, setPxPerBeat] = useState(64)
  const [rowHeight, setRowHeight] = useState(17)
  const [follow, setFollow] = useState(true)
  const [hoverSound, setHoverSound] = useState(true)
  const [picking, setPicking] = useState(false)
  const [range, setRange] = useState<Range>(() => computeRange(loop.notes))

  const grid = useStore((s) => s.grid)
  const scaleRoot = useStore((s) => s.scaleRoot)
  const scaleId = useStore((s) => s.scaleId)
  const isPlaying = useStore((s) => s.isPlaying)
  const playhead = useStore((s) => s.playhead)
  const selectedNoteIds = useStore((s) => s.selectedNoteIds)
  const patch = useStore((s) => s.patch)
  const setNotes = useStore((s) => s.setNotes)
  const updateLoop = useStore((s) => s.updateLoop)
  const removeNotes = useStore((s) => s.removeNotes)

  const isDrum = loop.kind === 'drum' || loop.instrument === 'drums'
  const meta = instrumentMeta(loop.instrument)
  const rows = isDrum ? DRUM_VOICES.length : range.high - range.low + 1
  const laneHeight = isDrum ? 30 : rowHeight
  const totalBeats = loop.bars * 4
  const contentWidth = totalBeats * pxPerBeat
  const contentHeight = rows * laneHeight

  // A new lane brings its own register with it.
  useEffect(() => {
    setRange(computeRange(loop.notes))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loop.id])

  const sound = useCallback(
    (note: Note) => {
      if (isDrum) engine().previewDrum(loop.id, note.drum ?? 'kick', note.velocity)
      else engine().preview(loop.id, note.pitch + loop.transpose, 0.5, note.velocity)
    },
    [isDrum, loop.id, loop.transpose],
  )

  const rowForNote = useCallback(
    (note: Note) => {
      if (isDrum) return DRUM_VOICES.findIndex((v) => v.id === (note.drum ?? 'kick'))
      return range.high - Math.round(note.pitch)
    },
    [isDrum, range.high],
  )

  const noteForRow = useCallback(
    (row: number): { pitch: number; drum?: DrumVoice } => {
      if (isDrum) {
        const clamped = Math.max(0, Math.min(DRUM_VOICES.length - 1, row))
        return { pitch: 36, drum: DRUM_VOICES[clamped].id }
      }
      return { pitch: Math.max(range.low, Math.min(range.high, range.high - row)) }
    },
    [isDrum, range.high, range.low],
  )

  const drawPlayhead = useCallback(
    (beats: number) => {
      if (!playheadRef.current) return
      playheadRef.current.style.opacity = '1'
      playheadRef.current.style.transform = `translateX(${(beats % totalBeats) * pxPerBeat}px)`
    },
    [pxPerBeat, totalBeats],
  )

  // While the transport runs the playhead is driven straight off it, not React
  // state, so it stays smooth no matter what else re-renders.
  useEffect(() => {
    if (!isPlaying) {
      drawPlayhead(playhead)
      return
    }
    let frame = 0
    const tick = () => {
      const beats = engine().position()
      drawPlayhead(beats)
      const el = scrollRef.current
      if (el && follow) {
        const x = (beats % totalBeats) * pxPerBeat
        const view = el.clientWidth - GUTTER
        if (x < el.scrollLeft - 20 || x > el.scrollLeft + view - 140) {
          el.scrollLeft = Math.max(0, x - view * 0.3)
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying, pxPerBeat, totalBeats, follow, playhead, drawPlayhead])

  const beatFromClientX = useCallback(
    (clientX: number) => {
      const rect = gridRef.current?.getBoundingClientRect()
      if (!rect) return 0
      return Math.max(0, Math.min(totalBeats, (clientX - rect.left) / pxPerBeat))
    },
    [pxPerBeat, totalBeats],
  )

  /** Sound whatever the playhead just moved onto, so scrubbing is audible. */
  const scrubTo = useCallback(
    (beats: number) => {
      patch({ playhead: beats })
      engine().seek(beats)
      drawPlayhead(beats)
      const covered = new Set(
        loop.notes.filter((n) => beats >= n.start && beats < n.start + n.duration).map((n) => n.id),
      )
      for (const note of loop.notes) {
        if (covered.has(note.id) && !scrubbedRef.current.has(note.id)) sound(note)
      }
      scrubbedRef.current = covered
    },
    [drawPlayhead, loop.notes, patch, sound],
  )

  const beginScrub = (event: React.PointerEvent) => {
    event.preventDefault()
    scrubRef.current = true
    scrubbedRef.current = new Set()
    void engine().start()
    scrubTo(beatFromClientX(event.clientX))
  }

  const beginDrag = (event: React.PointerEvent, note: Note, kind: DragKind) => {
    event.stopPropagation()
    event.preventDefault()

    const ids = selectedNoteIds.includes(note.id)
      ? selectedNoteIds
      : event.shiftKey
        ? [...selectedNoteIds, note.id]
        : [note.id]
    patch({ selectedNoteIds: ids })

    // Clicking a note should play it — that is the whole point of a note.
    void engine().start()
    sound(note)

    const origin = new Map<string, Note>()
    for (const n of loop.notes) if (ids.includes(n.id)) origin.set(n.id, { ...n })

    dragRef.current = { kind, noteIds: ids, startX: event.clientX, startY: event.clientY, origin, moved: false }
  }

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (scrubRef.current) {
        scrubTo(beatFromClientX(event.clientX))
        return
      }
      const drag = dragRef.current
      if (!drag) return
      const dx = (event.clientX - drag.startX) / pxPerBeat
      const dy = event.clientY - drag.startY
      if (Math.abs(event.clientX - drag.startX) > 2 || Math.abs(dy) > 2) drag.moved = true
      if (!drag.moved) return

      const rowShift = Math.round(dy / laneHeight)
      const snap = grid > 0 && !event.altKey

      const next = loop.notes.map((note) => {
        const from = drag.origin.get(note.id)
        if (!from) return note

        if (drag.kind === 'resize') {
          const raw = Math.max(0.05, from.duration + dx)
          return { ...note, duration: snap ? Math.max(grid, quantize(raw, grid)) : raw }
        }
        if (drag.kind === 'velocity') {
          return { ...note, velocity: Math.max(0.05, Math.min(1, from.velocity - dy / 120)) }
        }

        const rawStart = Math.max(0, from.start + dx)
        const start = snap ? Math.max(0, quantize(rawStart, grid)) : rawStart
        if (isDrum) {
          const row = Math.max(
            0,
            Math.min(
              DRUM_VOICES.length - 1,
              DRUM_VOICES.findIndex((v) => v.id === (from.drum ?? 'kick')) + rowShift,
            ),
          )
          return { ...note, start, drum: DRUM_VOICES[row].id }
        }
        // Clamp to what is on screen; releasing at the edge widens the scale.
        return {
          ...note,
          start,
          pitch: Math.max(range.low, Math.min(range.high, Math.round(from.pitch) - rowShift)),
        }
      })
      setNotes(loop.id, next)
    }

    const onUp = () => {
      if (scrubRef.current) {
        scrubRef.current = false
        scrubbedRef.current = new Set()
        return
      }
      const drag = dragRef.current
      dragRef.current = null
      if (!drag?.moved) return

      const current = useStore.getState().loops.find((l) => l.id === loop.id)
      if (!current) return
      if (drag.noteIds.length === 1) {
        const note = current.notes.find((n) => n.id === drag.noteIds[0])
        if (note) sound(note)
      }
      // Let go at the top or bottom and the visible scale grows to match.
      if (!isDrum) setRange(computeRange(current.notes))
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [beatFromClientX, grid, isDrum, laneHeight, loop.id, loop.notes, pxPerBeat, range.high, range.low, scrubTo, setNotes, sound])

  const onGridPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return
    if (tool !== 'draw') {
      patch({ selectedNoteIds: [] })
      return
    }
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return
    const beat = beatFromClientX(event.clientX)
    const row = Math.floor((event.clientY - rect.top) / laneHeight)
    const start = grid > 0 ? quantize(beat, grid) : beat
    const { pitch, drum } = noteForRow(row)
    const note: Note = {
      id: uid('n'),
      start: Math.max(0, start),
      duration: Math.max(grid || 0.25, 0.25),
      pitch,
      velocity: 0.8,
      ...(drum ? { drum } : {}),
    }
    setNotes(loop.id, [...loop.notes, note])
    patch({ selectedNoteIds: [note.id] })
    void engine().start()
    sound(note)
  }

  // Keyboard editing: pitch, timing and deletion on the current selection.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable) return
      if (!selectedNoteIds.length) return

      const step = event.shiftKey ? 12 : 1
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault()
        const dir = event.key === 'ArrowUp' ? 1 : -1
        const notes = loop.notes.map((n) =>
          selectedNoteIds.includes(n.id)
            ? isDrum
              ? {
                  ...n,
                  drum: DRUM_VOICES[
                    Math.max(
                      0,
                      Math.min(
                        DRUM_VOICES.length - 1,
                        DRUM_VOICES.findIndex((v) => v.id === (n.drum ?? 'kick')) - dir,
                      ),
                    )
                  ].id,
                }
              : { ...n, pitch: Math.max(ABS_LOW, Math.min(ABS_HIGH, n.pitch + dir * step)) }
            : n,
        )
        setNotes(loop.id, notes)
        if (!isDrum) setRange(computeRange(notes))
        const first = notes.find((n) => n.id === selectedNoteIds[0])
        if (first) sound(first)
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const delta = (event.key === 'ArrowRight' ? 1 : -1) * (grid || 0.25)
        setNotes(
          loop.id,
          loop.notes.map((n) =>
            selectedNoteIds.includes(n.id) ? { ...n, start: Math.max(0, n.start + delta) } : n,
          ),
        )
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        removeNotes(loop.id, selectedNoteIds)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [grid, isDrum, loop.id, loop.notes, removeNotes, selectedNoteIds, setNotes, sound])

  const barLines = useMemo(() => Array.from({ length: loop.bars }, (_, i) => i), [loop.bars])
  const beatLines = useMemo(() => Array.from({ length: totalBeats + 1 }, (_, i) => i), [totalBeats])
  const subLines = useMemo(() => {
    if (!grid || grid >= 1) return []
    return Array.from({ length: Math.floor(totalBeats / grid) + 1 }, (_, i) => i * grid).filter(
      (b) => b % 1 !== 0,
    )
  }, [grid, totalBeats])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-700 bg-ink-900 px-3 py-2">
        <button
          type="button"
          onClick={() => setPicking(true)}
          title="Instrument dieser Spur ändern"
          className="flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1 text-[11px] font-medium text-ink-100 hover:border-accent hover:text-accent"
        >
          <span className="text-sm">{meta.emoji}</span>
          {meta.label}
          <span className="text-ink-500">▾</span>
        </button>

        <div className="flex overflow-hidden rounded-lg border border-ink-600">
          {(['select', 'draw'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTool(t)}
              className={clsx(
                'px-2.5 py-1 text-[11px] font-medium',
                tool === t ? 'bg-accent text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-700',
              )}
            >
              {t === 'select' ? 'Auswählen' : 'Zeichnen'}
            </button>
          ))}
        </div>

        <Button
          size="sm"
          active={hoverSound}
          onClick={() => setHoverSound(!hoverSound)}
          title="Töne beim Drüberfahren hören"
        >
          🔈 Hörprobe
        </Button>

        <span className="font-mono text-[10px] text-ink-400">Zoom</span>
        <input
          type="range"
          min={20}
          max={190}
          value={pxPerBeat}
          onChange={(e) => setPxPerBeat(Number(e.target.value))}
          className="w-20 cursor-pointer"
        />
        {!isDrum && (
          <input
            type="range"
            min={11}
            max={30}
            value={rowHeight}
            onChange={(e) => setRowHeight(Number(e.target.value))}
            title="Zeilenhöhe"
            className="w-14 cursor-pointer"
          />
        )}
        <Button size="sm" active={follow} onClick={() => setFollow(!follow)} title="Ansicht folgt dem Playhead">
          Mitlaufen
        </Button>

        <div className="ml-auto flex items-center gap-2">
          {selectedNoteIds.length > 0 && !isDrum && (
            <>
              <Button
                size="sm"
                onClick={() => {
                  const notes = loop.notes.map((n) =>
                    selectedNoteIds.includes(n.id) && n.sourcePitch !== undefined
                      ? { ...n, pitch: Math.round(n.sourcePitch) }
                      : n,
                  )
                  setNotes(loop.id, notes)
                  setRange(computeRange(notes))
                }}
                title="Zurück auf die gesummte Tonhöhe"
              >
                Original
              </Button>
            </>
          )}
          {selectedNoteIds.length > 0 && (
            <Button size="sm" variant="danger" onClick={() => removeNotes(loop.id, selectedNoteIds)}>
              {selectedNoteIds.length} löschen
            </Button>
          )}
          <span className="font-mono text-[10px] text-ink-400">{loop.notes.length} Noten</span>
        </div>
      </div>

      <div ref={scrollRef} className="scroll-thin relative min-h-0 flex-1 overflow-auto bg-ink-950">
        <div className="relative" style={{ width: GUTTER + contentWidth, height: RULER + contentHeight }}>
          <div className="sticky top-0 z-30 flex" style={{ height: RULER }}>
            <div
              className="sticky left-0 z-40 flex items-center justify-end border-r border-b border-ink-700 bg-ink-900 pr-1.5 text-[9px] tracking-wide text-ink-500 uppercase"
              style={{ width: GUTTER }}
            >
              Takt
            </div>
            <div
              onPointerDown={beginScrub}
              className="relative cursor-ew-resize border-b border-ink-700 bg-ink-900"
              style={{ width: contentWidth }}
              title="Klicken oder ziehen, um die Abspiellinie zu bewegen"
            >
              {barLines.map((bar) => (
                <div
                  key={bar}
                  className="absolute top-0 flex h-full items-center border-l border-ink-600 pl-1.5 font-mono text-[10px] text-ink-300"
                  style={{ left: bar * 4 * pxPerBeat, width: 4 * pxPerBeat }}
                >
                  {bar + 1}
                </div>
              ))}
            </div>
          </div>

          <div className="flex" style={{ height: contentHeight }}>
            <div
              className="sticky left-0 z-20 shrink-0 border-r border-ink-700 bg-ink-900"
              style={{ width: GUTTER }}
            >
              {isDrum
                ? DRUM_VOICES.map((voice) => (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => {
                        void engine().start()
                        engine().previewDrum(loop.id, voice.id, 0.9)
                      }}
                      className="flex w-full items-center border-b border-ink-800 px-2 text-left text-[10px] font-medium text-ink-300 hover:bg-ink-800 hover:text-ink-100"
                      style={{ height: laneHeight }}
                    >
                      {voice.label}
                    </button>
                  ))
                : Array.from({ length: rows }, (_, i) => {
                    const midi = range.high - i
                    const black = isBlackKey(midi)
                    return (
                      <button
                        key={midi}
                        type="button"
                        onClick={() => {
                          void engine().start()
                          engine().preview(loop.id, midi + loop.transpose, 0.5, 0.8)
                        }}
                        onPointerEnter={(e) => {
                          if (!hoverSound || e.buttons) return
                          void engine().start()
                          engine().preview(loop.id, midi + loop.transpose, 0.35, 0.55)
                        }}
                        className={clsx(
                          'flex w-full items-center justify-end border-b pr-1.5 text-[9px] font-medium',
                          black
                            ? 'border-ink-900 bg-ink-800 text-ink-400 hover:bg-accent/30'
                            : 'border-ink-800 bg-ink-700/40 text-ink-300 hover:bg-accent/30',
                        )}
                        style={{ height: laneHeight }}
                      >
                        {(midi % 12 === 0 || laneHeight >= 16) && midiToName(midi)}
                      </button>
                    )
                  })}
            </div>

            <div
              ref={gridRef}
              onPointerDown={onGridPointerDown}
              className={clsx('relative', tool === 'draw' ? 'cursor-crosshair' : 'cursor-default')}
              style={{ width: contentWidth, height: contentHeight }}
            >
              {!isDrum &&
                Array.from({ length: rows }, (_, i) => {
                  const midi = range.high - i
                  return (
                    <div
                      key={midi}
                      className={clsx(
                        'absolute left-0 w-full border-b border-ink-900/80',
                        isBlackKey(midi) ? 'bg-ink-900/60' : 'bg-ink-850/40',
                        !isInScale(midi, scaleRoot, scaleId) && 'opacity-60',
                        midi % 12 === 0 && 'border-b-ink-700',
                      )}
                      style={{ top: i * laneHeight, height: laneHeight }}
                    />
                  )
                })}
              {isDrum &&
                DRUM_VOICES.map((voice, i) => (
                  <div
                    key={voice.id}
                    className={clsx(
                      'absolute left-0 w-full border-b border-ink-800',
                      i % 2 === 0 ? 'bg-ink-900/50' : 'bg-ink-850/40',
                    )}
                    style={{ top: i * laneHeight, height: laneHeight }}
                  />
                ))}

              {subLines.map((beat) => (
                <div
                  key={`s${beat}`}
                  className="absolute top-0 h-full w-px bg-ink-800/60"
                  style={{ left: beat * pxPerBeat }}
                />
              ))}
              {beatLines.map((beat) => (
                <div
                  key={`b${beat}`}
                  className={clsx('absolute top-0 h-full w-px', beat % 4 === 0 ? 'bg-ink-600' : 'bg-ink-800')}
                  style={{ left: beat * pxPerBeat }}
                />
              ))}

              {loop.notes.map((note) => {
                const row = rowForNote(note)
                if (row < 0 || row >= rows) return null
                const selected = selectedNoteIds.includes(note.id)
                const width = Math.max(6, note.duration * pxPerBeat)
                const drifted = note.sourcePitch !== undefined ? note.sourcePitch - note.pitch : 0
                return (
                  <div
                    key={note.id}
                    onPointerDown={(e) => beginDrag(e, note, e.metaKey || e.ctrlKey ? 'velocity' : 'move')}
                    onPointerEnter={() => {
                      if (!hoverSound || dragRef.current || scrubRef.current) return
                      if (hoveredRef.current === note.id) return
                      hoveredRef.current = note.id
                      void engine().start()
                      sound(note)
                    }}
                    onPointerLeave={() => {
                      if (hoveredRef.current === note.id) hoveredRef.current = null
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      removeNotes(loop.id, [note.id])
                    }}
                    title={
                      isDrum
                        ? `${note.drum} · ${Math.round(note.velocity * 100)}%`
                        : `${midiToName(note.pitch)}${
                            note.sourcePitch !== undefined
                              ? ` · gesummt ${midiToName(note.sourcePitch)} (${drifted > 0 ? '+' : ''}${(drifted * 100).toFixed(0)} Cent)`
                              : ''
                          }`
                    }
                    className={clsx(
                      'group absolute cursor-grab touch-none rounded-[3px] border active:cursor-grabbing',
                      selected ? 'z-10 border-white shadow-lg' : 'border-black/40',
                    )}
                    style={{
                      left: note.start * pxPerBeat,
                      top: row * laneHeight + 1,
                      width,
                      height: laneHeight - 2,
                      background: loop.color,
                      opacity: 0.35 + note.velocity * 0.65,
                      boxShadow: selected ? `0 0 0 1px ${loop.color}, 0 4px 14px -4px ${loop.color}` : undefined,
                    }}
                  >
                    {!isDrum && Math.abs(drifted) > 0.08 && laneHeight >= 12 && (
                      <span
                        className="pointer-events-none absolute left-0 h-px w-full bg-white/70"
                        style={{
                          top: Math.max(0, Math.min(laneHeight - 3, (laneHeight - 2) / 2 - drifted * laneHeight)),
                        }}
                      />
                    )}
                    {width > 34 && laneHeight >= 14 && (
                      <span className="pointer-events-none absolute inset-0 flex items-center truncate px-1 text-[9px] font-semibold text-black/70">
                        {isDrum ? DRUM_VOICES.find((v) => v.id === note.drum)?.label : midiToName(note.pitch)}
                      </span>
                    )}
                    <span
                      onPointerDown={(e) => beginDrag(e, note, 'resize')}
                      className="absolute top-0 right-0 h-full w-2 cursor-ew-resize rounded-r-[3px] bg-black/0 group-hover:bg-black/25"
                    />
                  </div>
                )
              })}

              <div
                ref={playheadRef}
                onPointerDown={beginScrub}
                className="absolute top-0 z-20 h-full w-px cursor-ew-resize bg-white"
                style={{ boxShadow: '0 0 10px 1px rgba(255,255,255,0.7)' }}
              >
                <span className="absolute -top-0.5 -left-[5px] h-2.5 w-2.5 rounded-full bg-white shadow" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {picking && (
        <InstrumentPicker
          value={loop.instrument}
          onChange={(instrument) =>
            updateLoop(loop.id, {
              instrument,
              kind: instrument === 'drums' ? 'drum' : loop.kind === 'vocal' ? 'vocal' : 'melodic',
            })
          }
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  )
}
