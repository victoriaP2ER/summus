'use client'

import { useEffect, useRef, useState } from 'react'
import { clsx } from './clsx'
import { Button } from './ui'
import { Meter } from './ui'
import { useCapture } from './useCapture'
import { useMicLevel } from './useMicLevel'
import { engine } from '@/lib/audio/engine'
import { preset } from '@/lib/audio/instruments'
import { style as findStyle } from '@/lib/audio/styles'
import { useStore } from '@/lib/store'
import type { CaptureMode } from '@/lib/types'

const MODES: { id: CaptureMode; label: string; emoji: string; hint: string }[] = [
  { id: 'hum', label: 'Melodie summen', emoji: '🎵', hint: 'wird zu einem Instrument' },
  { id: 'beatbox', label: 'Beat sprechen', emoji: '🥁', hint: 'wird zum Schlagzeug' },
  { id: 'vocal', label: 'Singen', emoji: '🎤', hint: 'mit Autotune auf den Takt' },
]

const HINT_KEY = 'summus.secondLaneHint'

/**
 * Always-present record button. Recording is the main verb of this app, so it
 * should never be more than one click away, whatever else is on screen.
 */
export function QuickRecord({ styleId }: { styleId: string }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<CaptureMode>('hum')
  const [hintDismissed, setHintDismissed] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      setHintDismissed(localStorage.getItem(HINT_KEY) === 'done')
    } catch {
      setHintDismissed(false)
    }
  }, [])
  const { state, counter, error, result, capture, importTake, stop, clear } = useCapture()
  const store = useStore()
  const { level } = useMicLevel(state !== 'idle')

  const busy = state !== 'idle'
  const bars = Math.max(2, Math.min(16, store.loops[0]?.bars ?? 4))

  const start = (next: CaptureMode) => {
    setMode(next)
    const instrument = next === 'hum' ? findStyle(styleId).lead : 'drums'
    void capture({ mode: next, instrument, bars, overdub: store.loops.length > 0 })
  }

  const importFile = async (file: File) => {
    setMode('hum')
    await engine().start()
    await importTake(file, findStyle(styleId).lead, bars)
  }

  return (
    <div className="pointer-events-none fixed right-5 bottom-20 z-40 flex flex-col items-end gap-2 lg:bottom-6">
      {result && (
        <div className="pointer-events-auto max-w-xs rounded-xl border border-mint/40 bg-ink-900 p-3 shadow-2xl">
          <p className="text-xs font-semibold text-mint">✓ {result.summary}</p>
          <p className="mt-0.5 text-[10px] text-ink-400">Liegt als neue Spur bereit.</p>
          <div className="mt-2 flex gap-1.5">
            {Math.abs(result.detectedBpm - store.bpm) > 2 && (
              <Button size="sm" onClick={() => store.patch({ bpm: result.detectedBpm })}>
                {result.detectedBpm} BPM übernehmen
              </Button>
            )}
            <Button
              size="sm"
              variant="danger"
              onClick={() => {
                for (const id of result.loopIds) store.removeLoop(id)
                clear()
              }}
            >
              Rückgängig
            </Button>
            <Button size="sm" onClick={clear}>
              OK
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="pointer-events-auto max-w-xs rounded-xl border border-rose-500/40 bg-ink-900 px-3 py-2 text-[11px] leading-relaxed text-rose-300 shadow-2xl">
          {error}
        </p>
      )}

      {/* After the first lane exists, the next question is always "how do I add
          another one" — so point at the answer, once. */}
      {!open && !busy && !result && !hintDismissed && store.loops.length >= 1 && (
        <div className="pointer-events-auto max-w-[15rem] rounded-xl border border-accent/40 bg-ink-900 p-3 shadow-2xl">
          <p className="text-[11px] leading-relaxed text-ink-200">
            Noch ein Instrument? Hier drunter nimmst du eine <strong>zweite Spur</strong> auf — das
            Vorhandene läuft dabei mit.
          </p>
          <button
            type="button"
            onClick={() => {
              setHintDismissed(true)
              try {
                localStorage.setItem(HINT_KEY, 'done')
              } catch {
                /* private mode — the hint just comes back next time */
              }
            }}
            className="mt-1.5 text-[10px] text-ink-400 underline-offset-2 hover:text-ink-200 hover:underline"
          >
            Verstanden
          </button>
        </div>
      )}

      {open && !busy && (
        <div className="pointer-events-auto w-60 space-y-1.5 rounded-xl border border-ink-700 bg-ink-900 p-2 shadow-2xl">
          <p className="px-1 pb-0.5 text-[10px] font-semibold tracking-[0.12em] text-ink-400 uppercase">
            Neue Spur aufnehmen
          </p>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setOpen(false)
                start(m.id)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-2 text-left hover:border-accent"
            >
              <span className="text-lg">{m.emoji}</span>
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold text-ink-100">{m.label}</span>
                <span className="block truncate text-[10px] text-ink-400">{m.hint}</span>
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              fileRef.current?.click()
            }}
            className="flex w-full items-center gap-2.5 rounded-lg border border-ink-700 bg-ink-850 px-2.5 py-2 text-left hover:border-accent"
          >
            <span className="text-lg">📁</span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold text-ink-100">Audiodatei laden</span>
              <span className="block truncate text-[10px] text-ink-400">
                eine fertige Aufnahme analysieren
              </span>
            </span>
          </button>
          <p className="px-1 pt-0.5 text-[10px] text-ink-500">
            {bars} Takte · {store.countInBars > 0 ? `${store.countInBars} Takt Einzähler` : 'ohne Einzähler'}
            {store.loops.length > 0 && ' · Playback läuft mit'}
          </p>
        </div>
      )}

      {busy && (
        <div className="pointer-events-auto w-48 space-y-1.5 rounded-xl border border-ink-700 bg-ink-900 p-2.5 shadow-2xl">
          <Meter level={level} />
          <p className="text-center text-[10px] text-ink-300">
            {state === 'working' ? 'Ich höre rein …' : preset(findStyle(styleId).lead).label}
          </p>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void importFile(file)
        }}
      />

      <button
        type="button"
        onClick={() => {
          if (busy) {
            if (state !== 'working') stop()
            return
          }
          void engine().start()
          setOpen(!open)
        }}
        title={busy ? 'Aufnahme beenden' : 'Aufnehmen'}
        className={clsx(
          'pointer-events-auto flex items-center gap-2 rounded-full px-5 py-3.5 font-semibold shadow-2xl transition-all',
          state === 'running'
            ? 'bg-rose-500 text-white'
            : state === 'countin'
              ? 'bg-amber-400 text-ink-950'
              : state === 'working'
                ? 'bg-ink-700 text-ink-200'
                : 'bg-gradient-to-b from-accent to-accent-strong text-ink-950 hover:brightness-110',
        )}
      >
        {state === 'countin' ? (
          <span className="font-mono text-lg tabular-nums">{counter}</span>
        ) : state === 'running' ? (
          <>
            <span className="h-3 w-3 animate-pulse rounded-full bg-white" />
            <span className="text-xs">{counter} · Stopp</span>
          </>
        ) : state === 'working' ? (
          <>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ink-300 border-t-transparent" />
            <span className="text-xs">Analysiere</span>
          </>
        ) : (
          <>
            <span className="h-3.5 w-3.5 rounded-full bg-rose-500" />
            <span className="text-sm">{open ? 'Schließen' : '+ Spur aufnehmen'}</span>
          </>
        )}
      </button>
    </div>
  )
}
