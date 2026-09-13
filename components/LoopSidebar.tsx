'use client'

import { useState } from 'react'
import { clsx } from './clsx'
import { Button, Field, Select, Slider } from './ui'
import { InstrumentPicker } from './InstrumentPicker'
import { INSTRUMENTS, instrumentMeta } from '@/lib/audio/instruments'
import { engine } from '@/lib/audio/engine'
import { LOOP_COLORS, midiToName } from '@/lib/music'
import { useStore } from '@/lib/store'
import type { InstrumentId, Loop } from '@/lib/types'

const INSTRUMENT_OPTIONS = INSTRUMENTS.map((i) => ({
  value: i.id,
  label: `${i.emoji}  ${i.label}  ·  ${i.family}`,
}))

export function LoopSidebar() {
  const loops = useStore((s) => s.loops)
  const selectedLoopId = useStore((s) => s.selectedLoopId)
  const selectLoop = useStore((s) => s.selectLoop)
  const addLoop = useStore((s) => s.addLoop)
  const updateLoop = useStore((s) => s.updateLoop)
  const [addingId, setAddingId] = useState<string | null>(null)

  /** Adding a spur starts with picking its sound — that is the decision. */
  const addWithInstrument = () => {
    const loop = addLoop({ name: `Spur ${loops.length + 1}`, bars: loops[0]?.bars ?? 4 })
    setAddingId(loop.id)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-ink-700 px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">Spuren</h2>
        <Button size="sm" onClick={addWithInstrument} title="Leere Spur mit eigenem Instrument anlegen">
          + Instrument
        </Button>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {loops.length === 0 && (
          <p className="px-3 py-6 text-center text-[11px] leading-relaxed text-ink-400">
            Noch keine Spur.
            <br />
            Summe etwas ein oder leg eine leere Spur an.
          </p>
        )}
        {loops.map((loop) => (
          <LaneRow
            key={loop.id}
            loop={loop}
            selected={loop.id === selectedLoopId}
            onSelect={() => selectLoop(loop.id)}
          />
        ))}
      </div>

      {addingId && (
        <InstrumentPicker
          value={loops.find((l) => l.id === addingId)?.instrument ?? 'piano'}
          onChange={(instrument) =>
            updateLoop(addingId, {
              instrument,
              kind: instrument === 'drums' ? 'drum' : 'melodic',
              name: instrumentMeta(instrument).label,
            })
          }
          onClose={() => setAddingId(null)}
        />
      )}
    </div>
  )
}

function LaneRow({
  loop,
  selected,
  onSelect,
}: {
  loop: Loop
  selected: boolean
  onSelect: () => void
}) {
  const [open, setOpen] = useState(false)
  const updateLoop = useStore((s) => s.updateLoop)
  const removeLoop = useStore((s) => s.removeLoop)
  const duplicateLoop = useStore((s) => s.duplicateLoop)
  const loops = useStore((s) => s.loops)

  const meta = instrumentMeta(loop.instrument)
  const pitches = loop.notes.filter((n) => !n.drum).map((n) => n.pitch)
  const range =
    pitches.length > 0
      ? `${midiToName(Math.min(...pitches) + loop.transpose)}–${midiToName(Math.max(...pitches) + loop.transpose)}`
      : null

  const anySolo = loops.some((l) => l.solo)
  const dimmed = anySolo ? !loop.solo : loop.muted

  return (
    <div
      className={clsx(
        'border-b border-ink-800 transition-colors',
        selected ? 'bg-ink-800/70' : 'hover:bg-ink-850/60',
      )}
    >
      <div className="flex items-center gap-2 px-2 py-2">
        <button
          type="button"
          onClick={onSelect}
          className="h-8 w-1 shrink-0 rounded-full"
          style={{ background: loop.color, opacity: dimmed ? 0.3 : 1 }}
          title="Lane auswählen"
        />
        <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{meta.emoji}</span>
            <span
              className={clsx(
                'truncate text-xs font-medium',
                selected ? 'text-ink-100' : 'text-ink-200',
                dimmed && 'opacity-50',
              )}
            >
              {loop.name}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-ink-400">
            <span>{loop.bars} T</span>
            <span>·</span>
            <span>{loop.notes.length} N</span>
            {range && (
              <>
                <span>·</span>
                <span className="truncate">{range}</span>
              </>
            )}
            {loop.transpose !== 0 && (
              <>
                <span>·</span>
                <span className="text-accent">
                  {loop.transpose > 0 ? '+' : ''}
                  {loop.transpose}
                </span>
              </>
            )}
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <IconToggle
            label="M"
            active={loop.muted}
            title="Stummschalten"
            onClick={() => updateLoop(loop.id, { muted: !loop.muted })}
            tone="mute"
          />
          <IconToggle
            label="S"
            active={loop.solo}
            title="Solo"
            onClick={() => updateLoop(loop.id, { solo: !loop.solo })}
            tone="solo"
          />
          <button
            type="button"
            onClick={() => setOpen(!open)}
            title="Lane bearbeiten"
            className={clsx(
              'flex h-6 w-6 items-center justify-center rounded-md border text-[10px] transition-colors',
              open
                ? 'border-accent bg-accent/15 text-accent'
                : 'border-ink-600 bg-ink-800 text-ink-300 hover:border-ink-500',
            )}
          >
            {open ? '▴' : '▾'}
          </button>
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-ink-800 bg-ink-900/60 px-3 py-3">
          <Field label="Name">
            <input
              value={loop.name}
              onChange={(e) => updateLoop(loop.id, { name: e.target.value })}
              className="w-full rounded-lg border border-ink-600 bg-ink-800 px-2 py-1.5 text-xs text-ink-100 focus:border-accent focus:outline-none"
            />
          </Field>

          <Field label="Instrument" hint={meta.family}>
            <Select<InstrumentId>
              value={loop.instrument}
              options={INSTRUMENT_OPTIONS}
              onChange={(instrument) => {
                updateLoop(loop.id, {
                  instrument,
                  kind: instrument === 'drums' ? 'drum' : loop.kind === 'vocal' ? 'vocal' : 'melodic',
                })
              }}
            />
          </Field>

          {loop.instrument !== 'drums' && (
            <Field
              label="Tonhöhe"
              hint={`${loop.transpose > 0 ? '+' : ''}${loop.transpose} HT`}
            >
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={() => updateLoop(loop.id, { transpose: loop.transpose - 12 })}>
                  −12
                </Button>
                <Slider
                  value={loop.transpose}
                  min={-24}
                  max={24}
                  onChange={(transpose) => updateLoop(loop.id, { transpose })}
                />
                <Button size="sm" onClick={() => updateLoop(loop.id, { transpose: loop.transpose + 12 })}>
                  +12
                </Button>
              </div>
            </Field>
          )}

          <Field label="Lautstärke" hint={`${loop.volume > 0 ? '+' : ''}${loop.volume.toFixed(0)} dB`}>
            <Slider
              value={loop.volume}
              min={-36}
              max={6}
              onChange={(volume) => updateLoop(loop.id, { volume })}
            />
          </Field>

          <Field label="Länge" hint={`${loop.bars} Takte`}>
            <div className="flex gap-1">
              {[1, 2, 4, 8, 16].map((bars) => (
                <Button
                  key={bars}
                  size="sm"
                  active={loop.bars === bars}
                  onClick={() => updateLoop(loop.id, { bars })}
                  className="flex-1"
                >
                  {bars}
                </Button>
              ))}
            </div>
          </Field>

          <Field label="Farbe">
            <div className="flex flex-wrap gap-1.5">
              {LOOP_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => updateLoop(loop.id, { color })}
                  className={clsx(
                    'h-5 w-5 rounded-md border-2 transition-transform hover:scale-110',
                    loop.color === color ? 'border-white' : 'border-transparent',
                  )}
                  style={{ background: color }}
                />
              ))}
            </div>
          </Field>

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                const instrument = engine().instrumentFor(loop.id)
                if (!instrument) return
                if (instrument.isDrum) engine().previewDrum(loop.id, 'kick', 0.9)
                else engine().preview(loop.id, 60 + loop.transpose, 0.5, 0.8)
              }}
            >
              Anhören
            </Button>
            <Button size="sm" className="flex-1" onClick={() => duplicateLoop(loop.id)}>
              Duplizieren
            </Button>
            <Button size="sm" variant="danger" onClick={() => removeLoop(loop.id)}>
              Löschen
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function IconToggle({
  label,
  active,
  title,
  onClick,
  tone,
}: {
  label: string
  active: boolean
  title: string
  onClick: () => void
  tone: 'mute' | 'solo'
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={clsx(
        'flex h-6 w-6 items-center justify-center rounded-md border text-[10px] font-bold transition-colors',
        !active && 'border-ink-600 bg-ink-800 text-ink-400 hover:border-ink-500',
        active && tone === 'mute' && 'border-rose-400/60 bg-rose-500/20 text-rose-300',
        active && tone === 'solo' && 'border-amber-400/60 bg-amber-500/20 text-amber-300',
      )}
    >
      {label}
    </button>
  )
}
