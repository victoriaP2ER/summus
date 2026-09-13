'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { clsx } from './clsx'
import { Button } from './ui'
import { LogoMark } from './Logo'
import { engine } from '@/lib/audio/engine'
import { GRID_OPTIONS, NOTE_NAMES, SCALES } from '@/lib/music'
import { selectedLoop, useStore } from '@/lib/store'

export function TopBar({ onShare }: { onShare: () => void }) {
  const store = useStore()
  const { bpm, scaleRoot, scaleId, grid, playMode, isPlaying, isRecording, metronome, snapScale, advanced, patch } =
    store
  const loop = selectedLoop(store)
  const [position, setPosition] = useState('1.1')
  const tapTimes = useRef<number[]>([])

  useEffect(() => {
    engine().setBpm(bpm)
  }, [bpm])

  useEffect(() => {
    engine().metronomeEnabled = metronome
  }, [metronome])

  useEffect(() => {
    if (!isPlaying) {
      setPosition('1.1')
      return
    }
    let frame = 0
    const tick = () => {
      const beats = engine().position()
      setPosition(`${Math.floor(beats / 4) + 1}.${Math.floor(beats % 4) + 1}`)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [isPlaying])

  const play = async () => {
    await engine().start()
    await engine().prepare(store.loops)
    patch({ audioReady: true })
    engine().metronomeEnabled = metronome
    engine().setBpm(bpm)
    const from = store.playhead
    if (playMode === 'loop' && loop) engine().playLoop(loop, store.loops, from)
    else engine().playSong(store.loops, store.clips, store.songBars(), from)
    patch({ isPlaying: true })
  }

  /** Pause leaves the playhead where it is so it can be dragged and scrubbed. */
  const pause = () => {
    const at = engine().position()
    engine().pause()
    patch({ isPlaying: false, playhead: at })
  }

  const rewind = () => {
    engine().stop()
    patch({ isPlaying: false, playhead: 0 })
  }

  const tap = () => {
    const now = performance.now()
    const times = tapTimes.current.filter((t) => now - t < 2400)
    times.push(now)
    tapTimes.current = times
    if (times.length < 2) return
    const gaps: number[] = []
    for (let i = 1; i < times.length; i++) gaps.push(times[i] - times[i - 1])
    const average = gaps.reduce((s, g) => s + g, 0) / gaps.length
    const next = Math.round(60000 / average)
    if (next >= 40 && next <= 240) patch({ bpm: next })
  }

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-ink-700 bg-ink-900 px-3 py-2.5">
      <Link href="/" title="Zur Übersicht" className="shrink-0">
        <LogoMark size={26} />
      </Link>

      <input
        value={store.name}
        onChange={(e) => patch({ name: e.target.value })}
        aria-label="Name des Songs"
        className="w-28 min-w-0 shrink rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-sm font-semibold text-ink-100 hover:border-ink-600 focus:border-accent focus:bg-ink-800 focus:outline-none sm:w-40"
      />

      <div className="h-5 w-px bg-ink-700" />

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={rewind}
          disabled={isRecording || !store.loops.length}
          title="Zurück an den Anfang"
          className="flex h-9 w-8 items-center justify-center rounded-lg border border-ink-600 bg-ink-800 text-ink-300 transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
        >
          <span className="text-[11px]">⏮</span>
        </button>

        <button
          type="button"
          onClick={isPlaying ? pause : play}
          disabled={isRecording || !store.loops.length}
          title={isPlaying ? 'Pause — die Linie bleibt stehen' : 'Abspielen (Leertaste)'}
          className={clsx(
            'flex h-9 w-9 items-center justify-center rounded-lg border transition-colors disabled:opacity-40',
            isPlaying
              ? 'border-accent bg-accent text-ink-950'
              : 'border-ink-600 bg-ink-800 text-ink-100 hover:border-accent hover:text-accent',
          )}
        >
          {isPlaying ? (
            <span className="flex gap-[3px]">
              <span className="block h-3 w-[3px] rounded-[1px] bg-current" />
              <span className="block h-3 w-[3px] rounded-[1px] bg-current" />
            </span>
          ) : (
            <span className="ml-0.5 block h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-current" />
          )}
        </button>

        {store.loops.length > 1 && (
          <div className="flex overflow-hidden rounded-lg border border-ink-600">
            <button
              type="button"
              onClick={() => patch({ playMode: 'loop' })}
              title="Nur die ausgewählte Lane wiederholen"
              className={clsx(
                'px-2.5 py-1.5 text-[11px] font-medium',
                playMode === 'loop' ? 'bg-accent text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-700',
              )}
            >
              Loop
            </button>
            <button
              type="button"
              onClick={() => patch({ playMode: 'song' })}
              title="Den ganzen Song abspielen"
              className={clsx(
                'px-2.5 py-1.5 text-[11px] font-medium',
                playMode === 'song' ? 'bg-accent text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-700',
              )}
            >
              Song
            </button>
          </div>
        )}

        <span className="min-w-[3.25rem] rounded-lg border border-ink-700 bg-ink-950 px-2 py-1.5 text-center font-mono text-xs tabular-nums text-accent">
          {position}
        </span>
      </div>

      <label className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">Tempo</span>
        <input
          type="number"
          min={40}
          max={240}
          value={bpm}
          onChange={(e) => patch({ bpm: Math.max(40, Math.min(240, Number(e.target.value) || 100)) })}
          className="w-15 rounded-lg border border-ink-600 bg-ink-800 px-2 py-1.5 text-center font-mono text-xs text-ink-100 focus:border-accent focus:outline-none"
        />
      </label>
      <Button size="sm" onClick={tap} title="Mehrfach im Takt klicken, um das Tempo zu setzen">
        Tap
      </Button>

      <Button size="sm" active={metronome} onClick={() => patch({ metronome: !metronome })}>
        Metronom
      </Button>

      {advanced && (
        <>
          <label className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
              Tonart
            </span>
            <select
              value={scaleRoot}
              onChange={(e) => patch({ scaleRoot: Number(e.target.value) })}
              className="rounded-lg border border-ink-600 bg-ink-800 px-1.5 py-1.5 text-xs text-ink-100 focus:border-accent focus:outline-none"
            >
              {NOTE_NAMES.map((name, i) => (
                <option key={name} value={i}>
                  {name}
                </option>
              ))}
            </select>
            <select
              value={scaleId}
              onChange={(e) => patch({ scaleId: e.target.value })}
              className="rounded-lg border border-ink-600 bg-ink-800 px-1.5 py-1.5 text-xs text-ink-100 focus:border-accent focus:outline-none"
            >
              {SCALES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-400">
              Raster
            </span>
            <select
              value={String(grid)}
              onChange={(e) => patch({ grid: Number(e.target.value) })}
              className="rounded-lg border border-ink-600 bg-ink-800 px-1.5 py-1.5 text-xs text-ink-100 focus:border-accent focus:outline-none"
            >
              {GRID_OPTIONS.map((g) => (
                <option key={g.id} value={String(g.beats)}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>

          <Button
            size="sm"
            active={snapScale}
            onClick={() => patch({ snapScale: !snapScale })}
            title="Erkannte Töne in die Tonart einrasten"
          >
            Tonart-Snap
          </Button>
        </>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          size="sm"
          active={advanced}
          onClick={() => patch({ advanced: !advanced })}
          title="Mehr Regler: Tonart, Raster, MIDI, Latenz"
        >
          {advanced ? 'Profi-Modus an' : 'Mehr Einstellungen'}
        </Button>
        <Button size="sm" variant="accent" onClick={onShare} disabled={!store.loops.length}>
          Teilen & Export
        </Button>
      </div>
    </header>
  )
}
