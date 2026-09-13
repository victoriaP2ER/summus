'use client'

import { useEffect, useState } from 'react'
import { clsx } from './clsx'
import { Button } from './ui'
import { engine } from '@/lib/audio/engine'
import { MELODIC_PRESETS, preset, prepareInstrument } from '@/lib/audio/instruments'
import { FAMILY_ORDER, type Family } from '@/lib/audio/presets'
import { onSamplesChanged, samplesLoading, samplesReady } from '@/lib/audio/samples'
import { STYLES, style as findStyle } from '@/lib/audio/styles'
import type { InstrumentId } from '@/lib/types'

/** A short phrase so every instrument is judged on the same few notes. */
const DEMO_PHRASE = [0, 4, 7, 12, 7]

export function InstrumentPicker({
  value,
  styleId,
  onChange,
  onClose,
}: {
  value: InstrumentId
  styleId?: string
  onChange: (id: InstrumentId) => void
  onClose: () => void
}) {
  const [family, setFamily] = useState<Family | 'Empfohlen'>('Empfohlen')
  const [, force] = useState(0)

  useEffect(() => onSamplesChanged(() => force((n) => n + 1)), [])

  const recommended = styleId
    ? [findStyle(styleId).lead, findStyle(styleId).chords, ...findStyle(styleId).alternates]
    : STYLES.slice(0, 4).map((s) => s.lead)

  const list =
    family === 'Empfohlen'
      ? [...new Set(recommended)].map(preset)
      : MELODIC_PRESETS.filter((p) => p.family === family)

  const audition = async (id: InstrumentId) => {
    onChange(id)
    await engine().start()
    await prepareInstrument(id)
    // The lane may not exist in the engine yet; a scratch instrument is enough
    // to hear what the preset sounds like.
    const spec = preset(id)
    const root = Math.round((spec.low + spec.high) / 2 / 12) * 12
    const now = engine().now()
    for (let i = 0; i < DEMO_PHRASE.length; i++) {
      engine().auditionNote(id, root + DEMO_PHRASE[i], 0.45, now + 0.12 + i * 0.22, 0.8)
    }
  }

  const families: (Family | 'Empfohlen')[] = ['Empfohlen', ...FAMILY_ORDER.filter((f) => f !== 'Drums')]

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/80 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
    >
      <div
        className="panel flex max-h-[85vh] w-full max-w-2xl flex-col rounded-t-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-ink-700 px-4 py-3">
          <div>
            <h2 className="text-sm font-bold text-ink-100">Instrument wählen</h2>
            <p className="mt-0.5 text-[11px] text-ink-400">
              Antippen spielt eine kurze Probe — deine Lane übernimmt den Klang sofort.
            </p>
          </div>
          <Button size="sm" onClick={onClose}>
            Fertig
          </Button>
        </header>

        <div className="scroll-thin flex gap-1 overflow-x-auto border-b border-ink-800 px-3 py-2">
          {families.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFamily(f)}
              className={clsx(
                'shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors',
                family === f ? 'bg-accent text-ink-950' : 'bg-ink-800 text-ink-300 hover:bg-ink-700',
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="scroll-thin grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3">
          {list.map((spec) => {
            const real = spec.voice === 'sampler' && !!spec.sample
            const loading = real && spec.sample ? samplesLoading(spec.sample) : false
            const ready = real && spec.sample ? samplesReady(spec.sample) : true
            return (
              <button
                key={spec.id}
                type="button"
                onClick={() => void audition(spec.id)}
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
        </div>

        <footer className="border-t border-ink-800 px-4 py-2">
          <p className="text-[10px] leading-relaxed text-ink-500">
            „echt" sind echte Aufnahmen von Musikerinnen und Musikern, „Synth" sind elektronisch
            erzeugte Klänge.
          </p>
        </footer>
      </div>
    </div>
  )
}
