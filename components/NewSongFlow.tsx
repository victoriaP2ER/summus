'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clsx } from './clsx'
import { Button, Meter } from './ui'
import { Logo } from './Logo'
import { StyleArt } from './StyleArt'
import { useMicLevel } from './useMicLevel'
import { engine } from '@/lib/audio/engine'
import { MELODIC_PRESETS, preset } from '@/lib/audio/instruments'
import { FAMILY_ORDER } from '@/lib/audio/presets'
import { micErrorMessage } from '@/lib/audio/recorder'
import { STYLES, style as findStyle } from '@/lib/audio/styles'
import { takeToDrumNotes, takeToNotes } from '@/lib/audio/convert'
import { detectTempo, tidyBpm } from '@/lib/audio/tempo'
import { LOOP_COLORS } from '@/lib/music'
import { useStore } from '@/lib/store'
import type { InstrumentId } from '@/lib/types'

type Step = 'mic' | 'melody' | 'style' | 'instrument' | 'beat'

const STEP_ORDER: Step[] = ['mic', 'melody', 'style', 'instrument', 'beat']
const STEP_LABELS: Record<Step, string> = {
  mic: 'Mikrofon',
  melody: 'Melodie',
  style: 'Richtung',
  instrument: 'Klang',
  beat: 'Beat',
}

export function NewSongFlow({
  styleId,
  onStyleChange,
  onFinish,
}: {
  styleId: string
  onStyleChange: (id: string) => void
  onFinish: () => void
}) {
  const [step, setStep] = useState<Step>('mic')
  const [micReady, setMicReady] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [counter, setCounter] = useState('')
  const [recording, setRecording] = useState<'idle' | 'countin' | 'running' | 'working'>('idle')
  const [melodyId, setMelodyId] = useState<string | null>(null)
  const [beatId, setBeatId] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const startedPlayback = useRef(false)

  const store = useStore()
  const { level, peak } = useMicLevel(micReady && (step === 'mic' || recording !== 'idle'))

  const melody = store.loops.find((l) => l.id === melodyId) ?? null

  // Live readout while a take runs.
  useEffect(() => {
    if (recording === 'idle' || recording === 'working') return
    let frame = 0
    const tick = () => {
      const window = engine().recordWindow
      if (window) {
        const now = engine().now()
        const beat = 60 / store.bpm
        if (now < window.transportStart) {
          setCounter(String(Math.max(1, Math.ceil((window.transportStart - now) / beat))))
          setRecording('countin')
        } else {
          const into = (now - window.transportStart) / beat
          setCounter(`Takt ${Math.min(Math.floor(into / 4) + 1, window.bars)} von ${window.bars}`)
          setRecording('running')
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [recording, store.bpm])

  const openMic = async () => {
    setError('')
    setBusy(true)
    try {
      await engine().start()
      await engine().openMic(store.micMode)
      setMicReady(true)
    } catch (e) {
      setError(micErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const playMelody = useCallback(() => {
    const state = useStore.getState()
    const loop = state.loops.find((l) => l.id === melodyId)
    if (!loop) return
    engine().metronomeEnabled = false
    engine().setBpm(state.bpm)
    engine().playLoop(loop, state.loops)
    state.patch({ isPlaying: true, metronome: false })
  }, [melodyId])

  const recordMelody = async () => {
    setError('')
    setRecording('countin')
    try {
      await engine().record(
        {
          countInBars: 1,
          bars: 4,
          overdub: false,
          metronome: true,
          micMode: store.micMode,
          latencyMs: store.latencyMs,
          onFinished: (buffer) => {
            setRecording('working')
            if (!buffer) {
              setError('Es ist kein Ton angekommen. Prüf, ob das richtige Mikrofon aktiv ist.')
              setRecording('idle')
              return
            }
            const tempo = detectTempo(buffer)
            const notes = takeToNotes(buffer, {
              bpm: store.bpm,
              grid: 0.25,
              snapScale: true,
              scaleRoot: store.scaleRoot,
              scaleId: store.scaleId,
            })
            if (!notes.length) {
              setError(
                'Da war keine Melodie zu erkennen. Summ etwas lauter und halte die Töne kurz aus — dann klappt es.',
              )
              setRecording('idle')
              return
            }
            const chosen = findStyle(styleId)
            const loop = store.addLoop({
              name: 'Melodie',
              instrument: chosen.lead,
              bars: 4,
              notes,
              color: LOOP_COLORS[0],
            })
            setMelodyId(loop.id)
            if (tempo.confidence > 0.35) store.patch({ bpm: tidyBpm(tempo.bpm) })
            setRecording('idle')
            setStep('style')
          },
        },
        store.loops,
        store.clips,
        4,
      )
    } catch (e) {
      setError(micErrorMessage(e))
      setRecording('idle')
    }
  }

  const useExample = async () => {
    setError('')
    setRecording('working')
    try {
      await engine().start()
      const response = await fetch('/demo/beispiel-melodie.mp3')
      const buffer = await engine().decode(await response.blob())
      const tempo = detectTempo(buffer)
      const bpm = tidyBpm(tempo.bpm)
      const notes = takeToNotes(buffer, {
        bpm,
        grid: 0.25,
        snapScale: true,
        scaleRoot: store.scaleRoot,
        scaleId: store.scaleId,
      })
      const chosen = findStyle(styleId)
      const loop = store.addLoop({
        name: 'Melodie',
        instrument: chosen.lead,
        bars: Math.max(4, Math.ceil((notes.at(-1)?.start ?? 16) / 4)),
        notes,
        color: LOOP_COLORS[0],
      })
      setMelodyId(loop.id)
      store.patch({ bpm })
      setStep('style')
    } catch {
      setError('Das Beispiel konnte nicht geladen werden.')
    } finally {
      setRecording('idle')
    }
  }

  const applyStyle = (id: string) => {
    onStyleChange(id)
    const chosen = findStyle(id)
    store.patch({ bpm: chosen.bpm, scaleId: chosen.scaleId })
    if (melodyId) store.updateLoop(melodyId, { instrument: chosen.lead })
    if (beatId) store.updateLoop(beatId, { instrument: 'drums' })
    if (!startedPlayback.current) {
      startedPlayback.current = true
      setTimeout(playMelody, 120)
    }
  }

  const applyInstrument = (id: InstrumentId) => {
    if (melodyId) store.updateLoop(melodyId, { instrument: id })
    if (!store.isPlaying) playMelody()
  }

  const recordBeat = async () => {
    setError('')
    setRecording('countin')
    try {
      await engine().record(
        {
          countInBars: 1,
          bars: melody?.bars ?? 4,
          overdub: true,
          metronome: true,
          micMode: store.micMode,
          latencyMs: store.latencyMs,
          onFinished: (buffer) => {
            setRecording('working')
            if (!buffer) {
              setError('Es ist kein Ton angekommen.')
              setRecording('idle')
              return
            }
            const notes = takeToDrumNotes(buffer, { bpm: store.bpm, grid: 0.25, simplify: true })
            if (notes.length < 2) {
              setError('Da waren zu wenig Schläge. Versuch ein klares "Bum – Tss – Bum – Tss".')
              setRecording('idle')
              return
            }
            const loop = store.addLoop({
              name: 'Beat',
              kind: 'drum',
              instrument: 'drums',
              bars: melody?.bars ?? 4,
              notes,
              color: LOOP_COLORS[3],
            })
            setBeatId(loop.id)
            setRecording('idle')
            setTimeout(() => {
              const state = useStore.getState()
              engine().playSong(state.loops, state.clips, state.songBars())
              state.patch({ isPlaying: true, playMode: 'song' })
            }, 120)
          },
        },
        store.loops,
        store.clips,
        melody?.bars ?? 4,
      )
    } catch (e) {
      setError(micErrorMessage(e))
      setRecording('idle')
    }
  }

  const finish = () => {
    engine().stop()
    store.patch({ isPlaying: false, metronome: true })
    onFinish()
  }

  const busyRecording = recording !== 'idle'
  const currentIndex = STEP_ORDER.indexOf(step)

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ink-950/98 backdrop-blur">
      <header className="flex items-center justify-between border-b border-ink-800 px-5 py-3">
        <Logo size="sm" />
        <div className="hidden items-center gap-1.5 sm:flex">
          {STEP_ORDER.map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <span
                className={clsx(
                  'rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors',
                  i === currentIndex
                    ? 'bg-accent text-ink-950'
                    : i < currentIndex
                      ? 'bg-mint/20 text-mint'
                      : 'text-ink-500',
                )}
              >
                {i < currentIndex ? '✓ ' : ''}
                {STEP_LABELS[s]}
              </span>
              {i < STEP_ORDER.length - 1 && <span className="text-ink-700">·</span>}
            </div>
          ))}
        </div>
        <Button size="sm" onClick={finish}>
          {melodyId ? 'Zum Studio' : 'Abbrechen'}
        </Button>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 px-5 py-8">
        {step === 'mic' && (
          <StepShell
            title="Zuerst dein Mikrofon"
            lead="summus hört zu, während du summst — dafür brauchen wir einmal deine Erlaubnis. Nichts davon verlässt deinen Browser."
          >
            {!micReady ? (
              <Button variant="accent" size="lg" onClick={openMic} disabled={busy}>
                {busy ? 'Einen Moment …' : '🎤 Mikrofon erlauben'}
              </Button>
            ) : (
              <div className="w-full max-w-sm space-y-3">
                <Meter level={level} />
                <p
                  className={clsx(
                    'text-center text-sm transition-colors',
                    peak > 0.03 ? 'text-mint' : 'text-ink-300',
                  )}
                >
                  {peak > 0.03 ? '✓ Ich höre dich!' : 'Summ oder sprich mal kurz …'}
                </p>
                <p className="text-center text-[11px] text-ink-400">
                  Mit Kopfhörern wird es am saubersten — dann kommt das Playback nicht ins Mikro.
                </p>
                <Button
                  variant="accent"
                  size="lg"
                  className="w-full"
                  onClick={() => setStep('melody')}
                  disabled={peak <= 0.01}
                >
                  Weiter
                </Button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setStep('melody')}
              className="text-[11px] text-ink-400 underline-offset-2 hover:text-ink-200 hover:underline"
            >
              Ohne Mikrofon fortfahren
            </button>
          </StepShell>
        )}

        {step === 'melody' && (
          <StepShell
            title="Jetzt summ eine Melodie"
            lead="Du hörst vier Klicks zum Einzählen. Danach hast du vier Takte Zeit — summ einfach drauflos, Töne aushalten hilft."
          >
            <RecordCircle
              state={recording}
              counter={counter}
              label="Aufnahme starten"
              onStart={recordMelody}
              onStop={() => engine().cancelRecord()}
            />
            {!busyRecording && (
              <button
                type="button"
                onClick={useExample}
                className="text-[11px] text-ink-400 underline-offset-2 hover:text-ink-200 hover:underline"
              >
                Kein Mikrofon? Beispielmelodie benutzen
              </button>
            )}
          </StepShell>
        )}

        {step === 'style' && (
          <StepShell
            title="In welche Richtung soll es gehen?"
            lead="Such dir eine Stimmung aus — deine Melodie bleibt, nur der Klang drumherum ändert sich. Du hörst es sofort."
          >
            <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-3">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => applyStyle(s.id)}
                  className={clsx(
                    'group overflow-hidden rounded-xl border text-left transition-all',
                    styleId === s.id
                      ? 'border-accent ring-2 ring-accent/40'
                      : 'border-ink-700 hover:border-ink-500',
                  )}
                >
                  <StyleArt style={s} className="h-16 w-full" />
                  <div className="p-2">
                    <div className="text-[11px] font-semibold text-ink-100">
                      {s.emoji} {s.label}
                    </div>
                    <div className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-ink-400">
                      {s.hint}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <Button variant="accent" size="lg" onClick={() => setStep('instrument')}>
              Weiter
            </Button>
          </StepShell>
        )}

        {step === 'instrument' && melody && (
          <StepShell
            title="Welcher Klang gefällt dir?"
            lead="Klick dich durch — deine Melodie läuft weiter und wechselt sofort das Instrument."
          >
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3">
              {[findStyle(styleId).lead, ...findStyle(styleId).alternates].map((id) => {
                const spec = preset(id)
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => applyInstrument(id)}
                    className={clsx(
                      'rounded-xl border px-3 py-3 text-left transition-colors',
                      melody.instrument === id
                        ? 'border-accent bg-accent/15'
                        : 'border-ink-700 bg-ink-850 hover:border-ink-500',
                    )}
                  >
                    <div className="text-lg">{spec.emoji}</div>
                    <div className="mt-1 text-xs font-semibold text-ink-100">{spec.label}</div>
                    <div className="mt-0.5 text-[10px] leading-tight text-ink-400">{spec.hint}</div>
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="text-[11px] text-ink-300 underline-offset-2 hover:text-accent hover:underline"
            >
              {showAll ? 'Weniger anzeigen' : `Alle ${MELODIC_PRESETS.length} Instrumente anzeigen`}
            </button>

            {showAll && (
              <div className="w-full space-y-3">
                {FAMILY_ORDER.filter((f) => f !== 'Drums').map((family) => {
                  const list = MELODIC_PRESETS.filter((p) => p.family === family)
                  if (!list.length) return null
                  return (
                    <div key={family}>
                      <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                        {family}
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {list.map((spec) => (
                          <button
                            key={spec.id}
                            type="button"
                            onClick={() => applyInstrument(spec.id)}
                            title={spec.hint}
                            className={clsx(
                              'rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors',
                              melody.instrument === spec.id
                                ? 'border-accent bg-accent/15 text-accent'
                                : 'border-ink-700 bg-ink-850 text-ink-200 hover:border-ink-500',
                            )}
                          >
                            {spec.emoji} {spec.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="flex gap-2">
              <Button size="lg" onClick={() => (store.isPlaying ? engine().stop() : playMelody())}>
                {store.isPlaying ? '⏸ Stopp' : '▶ Anhören'}
              </Button>
              <Button variant="accent" size="lg" onClick={() => setStep('beat')}>
                Weiter
              </Button>
            </div>
          </StepShell>
        )}

        {step === 'beat' && (
          <StepShell
            title="Magst du einen Beat dazu?"
            lead={
              'Mach einfach "Bum – Tss – Bum – Tss" ins Mikrofon. Deine Melodie läuft dabei mit, du kannst dich also daran orientieren.'
            }
          >
            <RecordCircle
              state={recording}
              counter={counter}
              label="Beat einsprechen"
              onStart={recordBeat}
              onStop={() => engine().cancelRecord()}
            />
            {beatId && (
              <p className="rounded-lg border border-mint/40 bg-mint/10 px-3 py-2 text-[11px] text-mint">
                ✓ Beat liegt drauf — hörst du gerade.
              </p>
            )}
            {!busyRecording && (
              <Button variant="accent" size="lg" onClick={finish}>
                {beatId ? 'Fertig — ins Studio' : 'Ohne Beat weiter'}
              </Button>
            )}
          </StepShell>
        )}

        {error && (
          <p className="mx-auto mt-5 max-w-md rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-center text-[11px] leading-relaxed text-rose-300">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

function StepShell({
  title,
  lead,
  children,
}: {
  title: string
  lead: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold text-ink-100 sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">{lead}</p>
      </div>
      {children}
    </div>
  )
}

function RecordCircle({
  state,
  counter,
  label,
  onStart,
  onStop,
}: {
  state: 'idle' | 'countin' | 'running' | 'working'
  counter: string
  label: string
  onStart: () => void
  onStop: () => void
}) {
  if (state === 'working') {
    return (
      <div className="flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-full border border-accent/40 bg-accent/10">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <span className="text-[11px] text-accent">Ich höre rein …</span>
      </div>
    )
  }

  if (state === 'countin') {
    return (
      <div className="flex h-40 w-40 flex-col items-center justify-center rounded-full border-2 border-amber-400 bg-amber-400/10">
        <span className="font-mono text-6xl font-bold text-amber-300 tabular-nums">{counter}</span>
        <span className="mt-1 text-[10px] uppercase tracking-[0.2em] text-amber-300/80">
          gleich
        </span>
      </div>
    )
  }

  if (state === 'running') {
    return (
      <button
        type="button"
        onClick={onStop}
        className="flex h-40 w-40 flex-col items-center justify-center gap-2 rounded-full border-2 border-rose-500 bg-rose-500/15"
      >
        <span className="h-4 w-4 animate-pulse rounded-full bg-rose-500" />
        <span className="text-sm font-semibold text-rose-200">{counter}</span>
        <span className="text-[10px] text-rose-300/70">klicken zum Beenden</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onStart}
      className="group flex h-40 w-40 flex-col items-center justify-center gap-3 rounded-full border-2 border-ink-600 bg-ink-850 transition-all hover:border-rose-400 hover:bg-rose-500/10"
    >
      <span className="h-14 w-14 rounded-full bg-rose-500 shadow-xl shadow-rose-500/30 transition-transform group-hover:scale-110" />
      <span className="text-xs font-semibold text-ink-200">{label}</span>
    </button>
  )
}
