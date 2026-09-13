'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from './clsx'
import { Button } from './ui'
import { engine } from '@/lib/audio/engine'
import { MELODIC_PRESETS, preset, prepareInstrument, searchPresets } from '@/lib/audio/instruments'
import { FAMILY_ORDER, type Family, type Preset } from '@/lib/audio/presets'
import { demoFor } from '@/lib/audio/demos'
import { onSamplesChanged, samplesLoading, samplesReady } from '@/lib/audio/samples'
import { style as findStyle, styleInstruments } from '@/lib/audio/styles'
import { midiToName } from '@/lib/music'
import type { InstrumentId } from '@/lib/types'

type Tab = 'Empfohlen' | Family

export function InstrumentPicker({
  value,
  styleId = 'synthwave',
  transpose = 0,
  onChange,
  onTranspose,
  onClose,
}: {
  value: InstrumentId
  styleId?: string
  transpose?: number
  onChange: (id: InstrumentId) => void
  onTranspose?: (semitones: number) => void
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('Empfohlen')
  const [query, setQuery] = useState('')
  const [playing, setPlaying] = useState(false)
  const [, force] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => onSamplesChanged(() => force((n) => n + 1)), [])
  useEffect(() => () => engine().stopDemo(), [])

  // Space toggles the example. Captured at the window so the studio's own
  // space handler does not also fire while this dialog is open.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
      event.preventDefault()
      event.stopPropagation()
      toggleDemoRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const style = findStyle(styleId)
  const demo = demoFor(styleId)

  const list: Preset[] = useMemo(() => {
    if (query.trim()) return searchPresets(query)
    if (tab === 'Empfohlen') return styleInstruments(styleId).map(preset)
    return MELODIC_PRESETS.filter((p) => p.family === tab)
  }, [query, styleId, tab])

  const startDemo = async (lead: InstrumentId) => {
    await engine().start()
    await Promise.all(
      [lead, style.chords, style.bass].map((id) => prepareInstrument(id)),
    )
    engine().playDemo(demo, { lead, chords: style.chords, bass: style.bass }, style.bpm)
    setPlaying(true)
  }

  const toggleDemo = () => {
    if (engine().demoPlaying) {
      engine().stopDemo()
      setPlaying(false)
    } else {
      void startDemo(value)
    }
  }
  const toggleDemoRef = useRef(toggleDemo)
  toggleDemoRef.current = toggleDemo

  /** Picking an instrument swaps it straight into the running groove. */
  const choose = (id: InstrumentId) => {
    onChange(id)
    void prepareInstrument(id).then(() => {
      if (engine().demoPlaying) engine().setDemoRole('lead', id)
      else void startDemo(id)
    })
    setPlaying(true)
  }

  const tabs: Tab[] = ['Empfohlen', ...FAMILY_ORDER.filter((f) => f !== 'Schlagzeug')]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/80 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={() => {
        engine().stopDemo()
        onClose()
      }}
    >
      <div
        className="panel flex max-h-[88vh] w-full max-w-3xl flex-col rounded-t-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-wrap items-center gap-3 border-b border-ink-700 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-ink-100">Instrument wählen</h2>
            <p className="mt-0.5 text-[11px] text-ink-400">
              Läuft als {style.emoji} {style.label}-Beispiel bei {style.bpm} BPM — antippen tauscht
              den Klang sofort.
            </p>
          </div>
          <Button size="sm" variant={playing ? 'accent' : 'ghost'} onClick={toggleDemo}>
            {playing ? '⏸ Beispiel stoppen' : '▶ Beispiel hören'}
            <span className="ml-1 hidden text-[9px] opacity-60 sm:inline">Leertaste</span>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              engine().stopDemo()
              onClose()
            }}
          >
            Fertig
          </Button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-ink-800 px-3 py-2">
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen — z.B. Harfe, Blues, tief, Barock …"
            className="min-w-[12rem] flex-1 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-xs text-ink-100 placeholder:text-ink-500 focus:border-accent focus:outline-none"
          />
          {query && (
            <Button size="sm" onClick={() => setQuery('')}>
              Zurücksetzen
            </Button>
          )}
        </div>

        {!query && (
          <div className="scroll-thin flex gap-1 overflow-x-auto border-b border-ink-800 px-3 py-2">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={clsx(
                  'shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors',
                  tab === t ? 'bg-accent text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-700',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        <div className="scroll-thin grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3">
          {list.map((spec) => {
            const real = spec.voice === 'sampler' && !!spec.sample
            const loading = real && spec.sample ? samplesLoading(spec.sample) : false
            const ready = real && spec.sample ? samplesReady(spec.sample) : true
            return (
              <button
                key={spec.id}
                type="button"
                onClick={() => choose(spec.id)}
                className={clsx(
                  'rounded-xl border px-2.5 py-2.5 text-left transition-colors',
                  value === spec.id
                    ? 'border-accent bg-accent/15'
                    : 'border-ink-700 bg-ink-850 hover:border-ink-500',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg">{spec.emoji}</span>
                  {real ? (
                    <span
                      className={clsx(
                        'rounded px-1 py-0.5 text-[9px] font-medium',
                        loading
                          ? 'bg-amber-400/15 text-amber-300'
                          : ready
                            ? 'bg-mint/15 text-mint'
                            : 'bg-ink-800 text-ink-400',
                      )}
                    >
                      {loading ? 'lädt' : 'echt'}
                    </span>
                  ) : (
                    <span className="rounded bg-ink-800 px-1 py-0.5 text-[9px] text-ink-400">
                      Synth
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] font-semibold text-ink-100">{spec.label}</div>
                <div className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-ink-400">
                  {spec.hint}
                </div>
              </button>
            )
          })}
          {!list.length && (
            <p className="col-span-full py-8 text-center text-[11px] text-ink-400">
              Nichts gefunden. Versuch es mit „Gitarre", „Glocken", „Jazz" oder „tief".
            </p>
          )}
        </div>

        {onTranspose && (
          <div className="flex items-center gap-3 border-t border-ink-800 px-4 py-2.5">
            <span className="text-[10px] font-semibold tracking-[0.12em] text-ink-400 uppercase">
              Tonhöhe
            </span>
            <Button size="sm" onClick={() => onTranspose(Math.max(-24, transpose - 12))}>
              ▼ Oktave
            </Button>
            <input
              type="range"
              min={-24}
              max={24}
              value={transpose}
              onChange={(e) => onTranspose(Number(e.target.value))}
              className="min-w-0 flex-1 cursor-pointer"
            />
            <Button size="sm" onClick={() => onTranspose(Math.min(24, transpose + 12))}>
              ▲ Oktave
            </Button>
            <span className="w-20 text-right font-mono text-[10px] text-ink-300">
              {transpose === 0 ? 'original' : `${transpose > 0 ? '+' : ''}${transpose} HT`}
            </span>
          </div>
        )}

        <footer className="border-t border-ink-800 px-4 py-2">
          <p className="text-[10px] leading-relaxed text-ink-500">
            „echt" sind echte Aufnahmen von Musikerinnen und Musikern, „Synth" sind elektronisch
            erzeugte Klänge. Tonumfang von {midiToName(preset(value).low)} bis{' '}
            {midiToName(preset(value).high)}.
          </p>
        </footer>
      </div>
    </div>
  )
}
