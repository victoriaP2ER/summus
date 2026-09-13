'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clsx } from './clsx'
import { Button, Field, Meter, Select, Slider, Toggle } from './ui'
import { engine } from '@/lib/audio/engine'
import { INSTRUMENTS } from '@/lib/audio/instruments'
import { takeToDrumNotes, takeToNotes, takeToVocalSlices } from '@/lib/audio/convert'
import { detectTempo, tidyBpm, type TempoEstimate } from '@/lib/audio/tempo'
import { splitTake, SPLIT_MODES, DEFAULT_PALETTE, type SplitMode } from '@/lib/audio/songsplit'
import { createLoop, useStore } from '@/lib/store'
import { LOOP_COLORS, uid } from '@/lib/music'
import type { CaptureMode, InstrumentId } from '@/lib/types'

const MODES: { id: CaptureMode; label: string; emoji: string; hint: string }[] = [
  { id: 'hum', label: 'Summen', emoji: '🎵', hint: 'Melodie summen → Instrument' },
  { id: 'beatbox', label: 'Beatbox', emoji: '🥁', hint: 'Beat mit dem Mund → Drums' },
  { id: 'vocal', label: 'Gesang', emoji: '🎤', hint: 'Singen → Autotune auf den Takt' },
  { id: 'song', label: 'Song-Skizze', emoji: '🎼', hint: 'Alles auf einmal → ganze Band' },
]

const DEMOS = [{ file: 'beispiel-melodie.mp3', label: 'Beispielmelodie' }]

type Phase = 'idle' | 'arming' | 'countin' | 'recording' | 'analyzing' | 'done'

interface Outcome {
  tempo: TempoEstimate
  summary: string
  /** How much material came out — zero means the take had nothing usable in it */
  count: number
  /** Creates the lanes and returns their ids, so the whole thing can be undone */
  apply: () => string[]
}

interface Done {
  buffer: AudioBuffer
  tempo: TempoEstimate
  summary: string
  loopIds: string[]
}

export function CapturePanel() {
  const [mode, setMode] = useState<CaptureMode>('hum')
  const [phase, setPhase] = useState<Phase>('idle')
  const [level, setLevel] = useState(0)
  const [counter, setCounter] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState<Done | null>(null)
  const [instrument, setInstrument] = useState<InstrumentId>('violin')
  const [splitMode, setSplitMode] = useState<SplitMode>('arrange')
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const store = useStore()
  const {
    bpm, grid, snapScale, scaleRoot, scaleId, countInBars, recordBars,
    metronome, overdub, micMode, latencyMs, patch, addLoop, addLoops, removeLoop,
  } = store

  // Live input meter plus the count-in / bar readout.
  useEffect(() => {
    if (phase === 'idle' || phase === 'analyzing' || phase === 'done') return
    let frame = 0
    const tick = () => {
      setLevel(engine().micLevel())
      const window = engine().recordWindow
      if (window) {
        const now = engine().now()
        const beatDur = 60 / bpm
        if (now < window.transportStart) {
          const left = Math.ceil((window.transportStart - now) / beatDur)
          setCounter(`${left}`)
          setPhase((p) => (p === 'recording' ? p : 'countin'))
        } else {
          const into = (now - window.transportStart) / beatDur
          const bar = Math.floor(into / 4) + 1
          const beat = Math.floor(into % 4) + 1
          setCounter(`${Math.min(bar, window.bars)}.${beat} / ${window.bars}`)
          setPhase('recording')
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [phase, bpm])

  const buildOutcome = useCallback(
    (buffer: AudioBuffer): Outcome => {
      const tempo = detectTempo(buffer)
      const offset = 0
      const convert = { bpm, offset, grid, snapScale, scaleRoot, scaleId }

      if (mode === 'beatbox') {
        const notes = takeToDrumNotes(buffer, { ...convert, simplify: true })
        const voices = [...new Set(notes.map((n) => n.drum))]
        return {
          tempo,
          count: notes.length,
          summary: `Beat mit ${notes.length} Schlägen · ${voices.join(', ')}`,
          apply: () => [
            addLoop({
              name: `Beat ${store.loops.length + 1}`,
              kind: 'drum',
              instrument: 'drums',
              bars: recordBars,
              notes,
              color: LOOP_COLORS[store.loops.length % LOOP_COLORS.length],
            }).id,
          ],
        }
      }

      if (mode === 'vocal') {
        const slices = takeToVocalSlices(buffer, convert)
        const bufferId = engine().storeBuffer(buffer)
        const vocal = { bufferId, slices, strength: 0.85, timeFix: 0.6, blend: 1 }
        return {
          tempo,
          count: slices.length,
          summary: `Gesangsspur mit ${slices.length} Silben`,
          apply: () => {
            const loop = addLoop({
              name: `Gesang ${store.loops.length + 1}`,
              kind: 'vocal',
              instrument: 'synthPad',
              bars: recordBars,
              notes: [],
              vocal,
            })
            engine().renderVocal({ ...loop, vocal }, bpm)
            return [loop.id]
          },
        }
      }

      if (mode === 'song') {
        const result = splitTake(buffer, {
          bpm,
          offset,
          grid,
          mode: splitMode,
          barsPerSection: 4,
          snapScale,
          scaleRoot,
          scaleId,
          includeDrums: true,
          palette: DEFAULT_PALETTE,
        })
        return {
          tempo: result.tempo,
          count: result.loops.length,
          summary: `${result.loops.length} Lanes (${result.loops
            .map((l) => l.name)
            .join(', ')}) · ${result.noteCount} Noten · ${result.bars} Takte`,
          apply: () => {
            const offsetTrack = store.loops.length
            addLoops(
              result.loops,
              result.clips.map((c) => ({ ...c, id: uid('clip'), track: c.track + offsetTrack })),
            )
            return result.loops.map((l) => l.id)
          },
        }
      }

      const notes = takeToNotes(buffer, convert)
      return {
        tempo,
        count: notes.length,
        summary: `Melodie mit ${notes.length} Noten`,
        apply: () => [
          addLoop({
            name: `Melodie ${store.loops.length + 1}`,
            instrument,
            bars: recordBars,
            notes,
            color: LOOP_COLORS[store.loops.length % LOOP_COLORS.length],
          }).id,
        ],
      }
    },
    [addLoop, addLoops, bpm, grid, instrument, mode, recordBars, scaleId, scaleRoot, snapScale, splitMode, store.loops.length],
  )

  const analyse = useCallback(
    async (buffer: AudioBuffer) => {
      setPhase('analyzing')
      // Let the spinner paint before the analysis blocks the main thread.
      await new Promise((r) => setTimeout(r, 30))
      try {
        const outcome = buildOutcome(buffer)
        if (outcome.count === 0) {
          setError(
            'In der Aufnahme war nichts zu erkennen. War das Mikrofon zu leise oder das falsche ausgewählt?',
          )
          setPhase('idle')
          return
        }
        // Recording should produce something you can hear straight away —
        // no extra confirmation step between singing and a playable lane.
        const loopIds = outcome.apply()
        setDone({ buffer, tempo: outcome.tempo, summary: outcome.summary, loopIds })
        setPhase('done')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Analyse fehlgeschlagen')
        setPhase('idle')
      }
    },
    [buildOutcome],
  )

  const startRecording = async () => {
    setError('')
    setDone(null)
    setPhase('arming')
    try {
      await engine().start()
      patch({ isRecording: true, isPlaying: false })
      await engine().record(
        {
          countInBars,
          bars: recordBars,
          overdub,
          metronome,
          micMode,
          latencyMs,
          onFinished: (buffer) => {
            patch({ isRecording: false })
            if (!buffer) {
              setError('Keine Aufnahme angekommen — ist das richtige Mikrofon ausgewählt?')
              setPhase('idle')
              return
            }
            void analyse(buffer)
          },
        },
        store.loops,
        store.clips,
        store.songBars(),
      )
    } catch (e) {
      patch({ isRecording: false })
      setPhase('idle')
      setError(
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Mikrofon-Zugriff wurde abgelehnt. Bitte im Browser erlauben.'
          : e instanceof Error
            ? e.message
            : 'Aufnahme fehlgeschlagen',
      )
    }
  }

  const stopRecording = () => {
    engine().cancelRecord()
    patch({ isRecording: false })
    setPhase('idle')
  }

  const loadFile = async (file: File | Blob) => {
    setError('')
    setPhase('analyzing')
    try {
      await engine().start()
      const buffer = await engine().decode(file)
      await analyse(buffer)
    } catch {
      setError('Diese Datei konnte nicht gelesen werden.')
      setPhase('idle')
    }
  }

  const loadDemo = async (name: string) => {
    setError('')
    setPhase('analyzing')
    try {
      // Kick the context off while we are still inside the click.
      await engine().start()
      const response = await fetch(`/demo/${name}`)
      await loadFile(await response.blob())
    } catch {
      setError('Demo konnte nicht geladen werden.')
      setPhase('idle')
    }
  }

  const busy = phase === 'arming' || phase === 'countin' || phase === 'recording'

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files[0]
        if (file) void loadFile(file)
      }}
      className={clsx(
        'flex h-full min-h-0 flex-col transition-colors',
        dragOver && 'bg-accent/10 ring-2 ring-accent ring-inset',
      )}
    >
      <div className="grid grid-cols-2 gap-1.5 border-b border-ink-700 p-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={busy}
            onClick={() => {
              setMode(m.id)
              setDone(null)
              setPhase('idle')
            }}
            className={clsx(
              'rounded-lg border px-2 py-2 text-left transition-colors disabled:opacity-40',
              mode === m.id
                ? 'border-accent bg-accent/15'
                : 'border-ink-600 bg-ink-800 hover:border-ink-500',
            )}
          >
            <div className="flex items-center gap-1.5">
              <span>{m.emoji}</span>
              <span
                className={clsx(
                  'text-[11px] font-semibold',
                  mode === m.id ? 'text-accent' : 'text-ink-200',
                )}
              >
                {m.label}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] leading-tight text-ink-400">{m.hint}</p>
          </button>
        ))}
      </div>

      <div className="scroll-thin min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {phase === 'done' && done ? (
          <DoneCard
            done={done}
            bpm={bpm}
            onClose={() => {
              setDone(null)
              setPhase('idle')
            }}
            onUndo={() => {
              for (const id of done.loopIds) removeLoop(id)
              setDone(null)
              setPhase('idle')
            }}
            onUseTempo={(value) => patch({ bpm: value })}
            onPlay={() => engine().playBuffer(done.buffer)}
          />
        ) : (
          <>
            <RecordButton
              phase={phase}
              counter={counter}
              onStart={startRecording}
              onStop={stopRecording}
            />

            <div className="space-y-1.5">
              <Meter level={level} />
              <p className="text-center font-mono text-[10px] text-ink-400">
                {busy ? engine().micLabel() || 'Mikrofon aktiv' : 'Eingangspegel'}
              </p>
            </div>

            {mode === 'hum' && (
              <Field label="Ziel-Instrument">
                <Select<InstrumentId>
                  value={instrument}
                  options={INSTRUMENTS.filter((i) => i.id !== 'drums').map((i) => ({
                    value: i.id,
                    label: `${i.emoji}  ${i.label}`,
                  }))}
                  onChange={setInstrument}
                />
              </Field>
            )}

            {mode === 'song' && (
              <Field label="Aufteilen nach" hint={SPLIT_MODES.find((s) => s.id === splitMode)?.hint}>
                <Select<SplitMode>
                  value={splitMode}
                  options={SPLIT_MODES.map((s) => ({ value: s.id, label: s.label }))}
                  onChange={setSplitMode}
                />
              </Field>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Field label="Takte">
                <div className="flex gap-1">
                  {[1, 2, 4, 8, 16].map((b) => (
                    <Button
                      key={b}
                      size="sm"
                      active={recordBars === b}
                      onClick={() => patch({ recordBars: b })}
                      className="flex-1 px-0"
                    >
                      {b}
                    </Button>
                  ))}
                </div>
              </Field>
              <Field label="Count-in">
                <div className="flex gap-1">
                  {[0, 1, 2].map((b) => (
                    <Button
                      key={b}
                      size="sm"
                      active={countInBars === b}
                      onClick={() => patch({ countInBars: b })}
                      className="flex-1 px-0"
                    >
                      {b === 0 ? 'aus' : `${b}`}
                    </Button>
                  ))}
                </div>
              </Field>
            </div>

            <div className="space-y-1.5">
              <Toggle checked={metronome} onChange={(v) => patch({ metronome: v })} label="Metronom" />
              <Toggle
                checked={overdub}
                onChange={(v) => patch({ overdub: v })}
                label="Playback mitlaufen lassen"
              />
            </div>

            <Field
              label="Mikrofon"
              hint={micMode === 'headphones' ? 'beste Qualität' : 'Echo-Filter an'}
            >
              <div className="flex gap-1">
                <Button
                  size="sm"
                  active={micMode === 'headphones'}
                  onClick={() => patch({ micMode: 'headphones' })}
                  className="flex-1"
                  title="Kopfhörer: keine Störfilter, sauberste Tonhöhen-Erkennung"
                >
                  🎧 Kopfhörer
                </Button>
                <Button
                  size="sm"
                  active={micMode === 'speakers'}
                  onClick={() => patch({ micMode: 'speakers' })}
                  className="flex-1"
                  title="Lautsprecher: filtert das Playback aus der Aufnahme"
                >
                  🔊 Lautsprecher
                </Button>
              </div>
            </Field>

            <Field label="Latenz-Ausgleich" hint={`${latencyMs} ms`}>
              <Slider
                value={latencyMs}
                min={-120}
                max={250}
                step={5}
                onChange={(v) => patch({ latencyMs: v })}
              />
            </Field>

            <div className="border-t border-ink-700 pt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                Oder Datei nutzen
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="audio/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) void loadFile(file)
                  e.target.value = ''
                }}
              />
              <Button size="sm" className="w-full" onClick={() => fileRef.current?.click()}>
                Audiodatei wählen — oder hierher ziehen
              </Button>
              <div className="mt-2 flex flex-wrap gap-1">
                {DEMOS.map((demo) => (
                  <Button key={demo.file} size="sm" onClick={() => loadDemo(demo.file)}>
                    {demo.label}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}

        {phase === 'analyzing' && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-3 text-xs text-accent">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            Analysiere Aufnahme …
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

function RecordButton({
  phase,
  counter,
  onStart,
  onStop,
}: {
  phase: Phase
  counter: string
  onStart: () => void
  onStop: () => void
}) {
  const busy = phase === 'arming' || phase === 'countin' || phase === 'recording'
  return (
    <button
      type="button"
      onClick={busy ? onStop : onStart}
      disabled={phase === 'analyzing'}
      className={clsx(
        'relative flex h-24 w-full flex-col items-center justify-center gap-1 rounded-xl border transition-all disabled:opacity-40',
        phase === 'recording'
          ? 'border-rose-500 bg-rose-500/15 text-rose-300'
          : phase === 'countin'
            ? 'border-amber-400 bg-amber-400/10 text-amber-300'
            : 'border-ink-600 bg-ink-800 text-ink-100 hover:border-accent hover:bg-accent/10',
      )}
    >
      {phase === 'countin' ? (
        <>
          <span className="font-mono text-3xl font-bold tabular-nums">{counter}</span>
          <span className="text-[10px] uppercase tracking-[0.2em]">Gleich geht's los</span>
        </>
      ) : phase === 'recording' ? (
        <>
          <span className="flex items-center gap-2 font-mono text-2xl font-bold tabular-nums">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" />
            {counter}
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em]">Takt · Zum Stoppen klicken</span>
        </>
      ) : phase === 'arming' ? (
        <span className="text-xs">Mikrofon wird geöffnet …</span>
      ) : (
        <>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500 shadow-lg shadow-rose-500/30" />
          <span className="text-xs font-semibold">Aufnehmen</span>
        </>
      )}
    </button>
  )
}

function DoneCard({
  done,
  bpm,
  onClose,
  onUndo,
  onUseTempo,
  onPlay,
}: {
  done: Done
  bpm: number
  onClose: () => void
  onUndo: () => void
  onUseTempo: (bpm: number) => void
  onPlay: () => void
}) {
  const detected = tidyBpm(done.tempo.bpm)
  const confident = done.tempo.confidence > 0.3
  return (
    <div className="space-y-3 rounded-xl border border-mint/40 bg-mint/10 p-3">
      <div>
        <h3 className="text-xs font-semibold text-mint">Fertig — ist als Lane da</h3>
        <p className="mt-1 text-[11px] text-ink-200">{done.summary}</p>
        <p className="mt-0.5 font-mono text-[10px] text-ink-400">
          aus {done.buffer.duration.toFixed(1)}s Aufnahme · Play drücken zum Anhören
        </p>
      </div>

      {Math.abs(detected - bpm) > 1 && (
        <div className="rounded-lg border border-ink-600 bg-ink-900/70 p-2">
          <p className="text-[11px] text-ink-200">
            Erkanntes Tempo: <span className="font-mono font-semibold text-accent">{detected} BPM</span>{' '}
            <span className="text-ink-400">
              ({confident ? 'sicher' : 'unsicher — bitte prüfen'})
            </span>
          </p>
          <div className="mt-1.5 flex gap-1">
            <Button size="sm" onClick={() => onUseTempo(detected)} className="flex-1">
              Übernehmen
            </Button>
            <Button size="sm" onClick={() => onUseTempo(Math.round(detected / 2))}>
              ÷2
            </Button>
            <Button size="sm" onClick={() => onUseTempo(Math.round(detected * 2))}>
              ×2
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={onPlay} title="Die rohe Aufnahme anhören">
          ▶ Original
        </Button>
        <Button size="sm" variant="accent" onClick={onClose} className="flex-1">
          Weiter aufnehmen
        </Button>
        <Button size="sm" variant="danger" onClick={onUndo} title="Angelegte Lanes wieder entfernen">
          Rückgängig
        </Button>
      </div>
    </div>
  )
}
