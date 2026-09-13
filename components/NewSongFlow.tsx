'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clsx } from './clsx'
import { Button, Meter } from './ui'
import { Logo } from './Logo'
import { StyleArt } from './StyleArt'
import { InstrumentPicker } from './InstrumentPicker'
import { useMicLevel } from './useMicLevel'
import { engine } from '@/lib/audio/engine'
import { preset, prepareInstrument } from '@/lib/audio/instruments'
import { micErrorMessage } from '@/lib/audio/recorder'
import { STYLES, style as findStyle, styleInstruments, styleSet } from '@/lib/audio/styles'
import { grooves, grooveToLoops } from '@/lib/audio/grooves'
import { buildAccompaniment } from '@/lib/audio/accompany'
import { takeToDrumNotes, takeToNotes } from '@/lib/audio/convert'
import { detectTempo, tidyBpm } from '@/lib/audio/tempo'
import { LOOP_COLORS } from '@/lib/music'
import { useStore } from '@/lib/store'
import type { InstrumentId } from '@/lib/types'

type Step = 'mic' | 'start' | 'melody' | 'style' | 'instrument' | 'beat'
type Mode = 'melodyFirst' | 'beatFirst'

const LABELS: Record<Step, string> = {
  mic: 'Mikrofon',
  start: 'Start',
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
  const [mode, setMode] = useState<Mode>('melodyFirst')
  const [micReady, setMicReady] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [counter, setCounter] = useState('')
  const [recording, setRecording] = useState<'idle' | 'countin' | 'running' | 'working'>('idle')
  const [melodyId, setMelodyId] = useState<string | null>(null)
  const [bandIds, setBandIds] = useState<string[]>([])
  const [grooveId, setGrooveId] = useState('basis')
  // A ref, not state: the click handler must see the value the previous click
  // wrote, not the one captured when the component last rendered.
  const variation = useRef(0)
  const [picking, setPicking] = useState(false)

  const store = useStore()
  const { level, peak } = useMicLevel(micReady && (step === 'mic' || recording !== 'idle'))
  const melody = store.loops.find((l) => l.id === melodyId) ?? null
  const order: Step[] =
    mode === 'beatFirst'
      ? ['mic', 'start', 'style', 'melody', 'instrument']
      : ['mic', 'start', 'melody', 'style', 'instrument', 'beat']

  useEffect(() => {
    if (recording === 'idle' || recording === 'working') return
    let frame = 0
    const tick = () => {
      const window_ = engine().recordWindow
      if (window_) {
        const now = engine().now()
        const beat = 60 / store.bpm
        if (now < window_.transportStart) {
          setCounter(String(Math.max(1, Math.ceil((window_.transportStart - now) / beat))))
          setRecording('countin')
        } else {
          const into = (now - window_.transportStart) / beat
          setCounter(`Takt ${Math.min(Math.floor(into / 4) + 1, window_.bars)} von ${window_.bars}`)
          setRecording('running')
        }
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [recording, store.bpm])

  /** Play everything there is, from the top. */
  const playAll = useCallback(() => {
    setTimeout(() => {
      void (async () => {
        const next = useStore.getState()
        await engine().start()
        await engine().prepare(next.loops)
        engine().setBpm(next.bpm)
        engine().metronomeEnabled = false
        engine().playSong(next.loops, next.clips, next.songBars())
        next.patch({ isPlaying: true, playMode: 'song', metronome: false, playhead: 0 })
      })()
    }, 150)
  }, [])

  const stopAll = useCallback(() => {
    engine().stop()
    useStore.getState().patch({ isPlaying: false })
  }, [])

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

  // ---------------------------------------------------------------- melody

  const captureMelody = async () => {
    setError('')
    setRecording('countin')
    const bars = mode === 'beatFirst' ? Math.max(4, store.loops[0]?.bars ?? 4) : 4
    try {
      await engine().record(
        {
          countInBars: 1,
          bars,
          overdub: mode === 'beatFirst',
          metronome: mode === 'melodyFirst',
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
            const loop = store.addLoop({
              name: 'Melodie',
              instrument: findStyle(styleId).lead,
              bars,
              notes,
              color: LOOP_COLORS[0],
            })
            setMelodyId(loop.id)
            if (mode === 'melodyFirst' && tempo.confidence > 0.35) {
              store.patch({ bpm: tidyBpm(tempo.bpm) })
            }
            setRecording('idle')
            if (mode === 'beatFirst') {
              playAll()
              setStep('instrument')
            } else {
              setStep('style')
            }
          },
        },
        store.loops,
        store.clips,
        bars,
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
      const bpm = mode === 'beatFirst' ? store.bpm : tidyBpm(tempo.bpm)
      const notes = takeToNotes(buffer, {
        bpm,
        grid: 0.25,
        snapScale: true,
        scaleRoot: store.scaleRoot,
        scaleId: store.scaleId,
      })
      const bars = Math.max(4, Math.ceil(((notes.at(-1)?.start ?? 12) + 1) / 4))
      const loop = store.addLoop({
        name: 'Melodie',
        instrument: findStyle(styleId).lead,
        bars,
        notes,
        color: LOOP_COLORS[0],
      })
      setMelodyId(loop.id)
      if (mode === 'melodyFirst') store.patch({ bpm })
      if (mode === 'beatFirst') {
        playAll()
        setStep('instrument')
      } else {
        setStep('style')
      }
    } catch {
      setError('Das Beispiel konnte nicht geladen werden.')
    } finally {
      setRecording('idle')
    }
  }

  // ----------------------------------------------------------------- style

  /**
   * Picking a direction is the moment the song appears: the melody keeps its
   * notes and gets a bass, chords and drums built around the harmony it
   * implies — or, when the beat comes first, a ready-made groove to sing over.
   */
  const applyStyle = (id: string, feel?: string) => {
    // Clicking the same direction again asks for a different take on it. Groove
    // and line-up advance at different rates, so the combinations do not simply
    // repeat every third click, and the melody is re-written every time.
    const list = grooves(id)
    const next = id === styleId && bandIds.length ? variation.current + 1 : 0
    variation.current = next
    const nextFeel = feel ?? list[next % list.length]?.id ?? 'basis'
    const setIndex = Math.floor(next / list.length)

    onStyleChange(id)
    setGrooveId(nextFeel)
    const chosen = { ...findStyle(id), ...styleSet(id, setIndex) }
    stopAll()

    const state = useStore.getState()
    for (const loopId of bandIds) state.removeLoop(loopId)
    setBandIds([])

    state.patch({ bpm: chosen.bpm, scaleId: chosen.scaleId })

    if (mode === 'beatFirst') {
      const fresh = useStore.getState()
      for (const l of fresh.loops) fresh.removeLoop(l.id)
      // A new seed each time, so clicking around never gives the same tune twice.
      const groove = grooveToLoops(id, nextFeel, 4, 60, next + 1, setIndex)
      useStore.getState().addLoops(groove)
      setBandIds(groove.map((l) => l.id))
      playAll()
      return
    }

    if (!melodyId) return
    const current = useStore.getState()
    const lane = current.loops.find((l) => l.id === melodyId)
    if (!lane) return
    current.updateLoop(lane.id, { instrument: chosen.lead })
    const band = buildAccompaniment(
      { ...lane, instrument: chosen.lead },
      id,
      chosen.scaleId,
      1,
      nextFeel,
      setIndex,
    )
    if (band.length) {
      useStore.getState().addLoops(band)
      setBandIds(band.map((l) => l.id))
    }
    playAll()
  }

  const applyInstrument = (id: InstrumentId) => {
    if (!melodyId) return
    store.updateLoop(melodyId, { instrument: id })
    void prepareInstrument(id)
  }

  // ------------------------------------------------------------------ beat

  const captureBeat = async () => {
    setError('')
    setRecording('countin')
    try {
      await engine().record(
        {
          countInBars: 1,
          bars: melody?.bars ?? 4,
          overdub: true,
          metronome: false,
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
            store.addLoop({
              name: 'Eigener Beat',
              kind: 'drum',
              instrument: 'drums',
              bars: melody?.bars ?? 4,
              notes,
              color: LOOP_COLORS[5],
            })
            setRecording('idle')
            playAll()
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
    stopAll()
    store.patch({ metronome: true })
    onFinish()
  }

  const busyRecording = recording !== 'idle'
  const currentIndex = order.indexOf(step)

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ink-950/98 backdrop-blur">
      <header className="flex items-center justify-between border-b border-ink-800 px-5 py-3">
        <Logo size="sm" />
        <div className="hidden items-center gap-1.5 sm:flex">
          {order.map((s, i) => (
            <span
              key={s}
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
              {LABELS[s]}
            </span>
          ))}
        </div>
        <Button size="sm" onClick={finish}>
          {store.loops.length ? 'Zum Studio' : 'Abbrechen'}
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
                <Button variant="accent" size="lg" className="w-full" onClick={() => setStep('start')}>
                  Weiter
                </Button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setStep('start')}
              className="text-[11px] text-ink-400 underline-offset-2 hover:text-ink-200 hover:underline"
            >
              Ohne Mikrofon fortfahren
            </button>
          </StepShell>
        )}

        {step === 'start' && (
          <StepShell
            title="Womit fängst du an?"
            lead="Beides führt zum selben Ziel — such dir aus, was dir leichter fällt."
          >
            <div className="grid w-full gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setMode('melodyFirst')
                  setStep('melody')
                }}
                className="rounded-2xl border border-ink-700 bg-ink-850 p-5 text-left transition-colors hover:border-accent"
              >
                <span className="text-3xl">🎵</span>
                <h3 className="mt-2 text-sm font-bold text-ink-100">Erst die Melodie</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
                  Du summst drauflos. Danach suchst du eine Richtung aus und hörst sofort, wie deine
                  Melodie mit Bass, Akkorden und Schlagzeug in diesem Stil klingt.
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('beatFirst')
                  setStep('style')
                }}
                className="rounded-2xl border border-ink-700 bg-ink-850 p-5 text-left transition-colors hover:border-accent"
              >
                <span className="text-3xl">🥁</span>
                <h3 className="mt-2 text-sm font-bold text-ink-100">Erst der Beat</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
                  Du suchst dir einen fertigen Groove aus, lässt ihn laufen und singst deine Melodie
                  einfach darüber. Zum Mitwippen und Ausprobieren.
                </p>
              </button>
            </div>
          </StepShell>
        )}

        {step === 'melody' && (
          <StepShell
            title={mode === 'beatFirst' ? 'Jetzt sing drüber' : 'Jetzt summ eine Melodie'}
            lead={
              mode === 'beatFirst'
                ? 'Der Groove läuft mit. Ein Takt wird eingezählt, dann summ einfach über das, was du hörst.'
                : 'Du hörst vier Klicks zum Einzählen. Danach hast du vier Takte Zeit — summ einfach drauflos, Töne aushalten hilft.'
            }
          >
            <RecordCircle
              state={recording}
              counter={counter}
              label="Aufnahme starten"
              onStart={() => {
                stopAll()
                void captureMelody()
              }}
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
            title={mode === 'beatFirst' ? 'Such dir einen Groove aus' : 'In welche Richtung soll es gehen?'}
            lead={
              mode === 'beatFirst'
                ? 'Antippen legt den Beat als fertige Spuren an und spielt ihn sofort — du kannst gleich darüber singen.'
                : 'Antippen baut aus deiner Melodie einen ganzen Song: Bass, Akkorde und Schlagzeug in diesem Stil, passend zu den Tönen, die du gesummt hast.'
            }
          >
            <div className="grid w-full grid-cols-2 gap-2.5 sm:grid-cols-3">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => applyStyle(s.id)}
                  className={clsx(
                    'overflow-hidden rounded-xl border text-left transition-all',
                    styleId === s.id && bandIds.length
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

            {bandIds.length > 0 && (
              <>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {grooves(styleId).map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      title={g.hint}
                      onClick={() => applyStyle(styleId, g.id)}
                      className={clsx(
                        'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors',
                        grooveId === g.id
                          ? 'border-accent bg-accent/15 text-accent'
                          : 'border-ink-700 bg-ink-850 text-ink-300 hover:border-ink-500',
                      )}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                <p className="rounded-lg border border-mint/40 bg-mint/10 px-3 py-2 text-[11px] text-mint">
                  ✓ {mode === 'beatFirst' ? 'Groove läuft' : 'Dein Song läuft'} — {findStyle(styleId).label} bei{' '}
                  {findStyle(styleId).bpm} BPM
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="lg" onClick={() => (store.isPlaying ? stopAll() : playAll())}>
                    {store.isPlaying ? '⏸ Stopp' : '▶ Anhören'}
                  </Button>
                  <Button
                    size="lg"
                    onClick={() => applyStyle(styleId)}
                    title="Andere Besetzung, anderer Groove, neue Melodie"
                  >
                    🎲 Andere Version
                  </Button>
                  <Button
                    variant="accent"
                    size="lg"
                    onClick={() => setStep(mode === 'beatFirst' ? 'melody' : 'instrument')}
                  >
                    Weiter
                  </Button>
                </div>
              </>
            )}
          </StepShell>
        )}

        {step === 'instrument' && melody && (
          <StepShell
            title="Welcher Klang für deine Melodie?"
            lead="Der ganze Song läuft weiter — klick dich durch, das Instrument wechselt sofort."
          >
            <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
              {styleInstruments(styleId)
                .slice(0, 12)
                .map((id) => {
                  const spec = preset(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => applyInstrument(id)}
                      className={clsx(
                        'rounded-xl border px-2.5 py-2.5 text-left transition-colors',
                        melody.instrument === id
                          ? 'border-accent bg-accent/15'
                          : 'border-ink-700 bg-ink-850 hover:border-ink-500',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg">{spec.emoji}</span>
                        {spec.voice === 'sampler' && (
                          <span className="rounded bg-mint/15 px-1 py-0.5 text-[9px] text-mint">
                            echt
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

            <button
              type="button"
              onClick={() => setPicking(true)}
              className="text-[11px] text-ink-300 underline-offset-2 hover:text-accent hover:underline"
            >
              Alle Instrumente durchsuchen
            </button>

            <div className="flex flex-wrap justify-center gap-2">
              <Button size="lg" onClick={() => (store.isPlaying ? stopAll() : playAll())}>
                {store.isPlaying ? '⏸ Stopp' : '▶ Anhören'}
              </Button>
              <Button
                variant="accent"
                size="lg"
                onClick={() => (mode === 'beatFirst' ? finish() : setStep('beat'))}
              >
                Weiter
              </Button>
            </div>

            {picking && (
              <InstrumentPicker
                value={melody.instrument}
                styleId={styleId}
                transpose={melody.transpose}
                onChange={applyInstrument}
                onTranspose={(t) => melodyId && store.updateLoop(melodyId, { transpose: t })}
                onClose={() => setPicking(false)}
              />
            )}
          </StepShell>
        )}

        {step === 'beat' && (
          <StepShell
            title="Magst du einen eigenen Beat dazu?"
            lead={
              'Mach einfach "Bum – Tss – Bum – Tss" ins Mikrofon. Der Song läuft dabei mit, du kannst dich also daran orientieren.'
            }
          >
            <RecordCircle
              state={recording}
              counter={counter}
              label="Beat einsprechen"
              onStart={() => {
                stopAll()
                void captureBeat()
              }}
              onStop={() => engine().cancelRecord()}
            />
            {!busyRecording && (
              <Button variant="accent" size="lg" onClick={finish}>
                Fertig — ins Studio
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
        <span className="mt-1 text-[10px] tracking-[0.2em] text-amber-300/80 uppercase">gleich</span>
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
