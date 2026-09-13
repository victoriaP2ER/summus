'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clsx } from './clsx'
import { Arrangement } from './Arrangement'
import { CapturePanel } from './CapturePanel'
import { LoopSidebar } from './LoopSidebar'
import { MidiPanel } from './MidiPanel'
import { NewSongFlow } from './NewSongFlow'
import { PianoRoll } from './PianoRoll'
import { QuickRecord } from './QuickRecord'
import { ShareDialog } from './ShareDialog'
import { TopBar } from './TopBar'
import { VocalEditor } from './VocalEditor'
import { engine } from '@/lib/audio/engine'
import { buildAccompaniment } from '@/lib/audio/accompany'
import { grooves, grooveToLoops } from '@/lib/audio/grooves'
import { installMediaKeys, setMediaPlaying } from '@/lib/audio/mediaKeys'
import { STYLES, style as findStyle } from '@/lib/audio/styles'
import { collectAudioAsync, saveSong } from '@/lib/library'
import { uid } from '@/lib/music'
import { selectedLoop, useStore } from '@/lib/store'

type MobileView = 'lanes' | 'editor' | 'more'

export function Studio({ startGuided = false }: { startGuided?: boolean }) {
  const store = useStore()
  const loop = selectedLoop(store)
  const { loops, clips, bpm, isPlaying, playMode, tab, advanced, patch } = store

  const [guided, setGuided] = useState(startGuided)
  const [sharing, setSharing] = useState(false)
  const [mobileView, setMobileView] = useState<MobileView>('editor')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [styleId, setStyleId] = useState('synthwave')
  const createdAt = useRef(Date.now())

  useEffect(() => {
    engine().setBpm(bpm)
  }, [bpm])

  // Browsers only let an AudioContext start inside a user gesture, and that
  // window closes as soon as we await anything. So unlock on the very first
  // interaction and every later action can just assume audio is live.
  useEffect(() => {
    const unlock = () => {
      void engine()
        .start()
        .then(() => patch({ audioReady: true }))
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the synth instances in step with the lane list, and pull down the
  // recordings any new instrument needs.
  useEffect(() => {
    if (!engine().isStarted) return
    engine().syncInstruments(loops)
    void engine().prepare(loops)
  }, [loops])

  // Edits made while the transport runs take effect on the next pass.
  useEffect(() => {
    if (!isPlaying) return
    const timer = window.setTimeout(() => {
      engine().reschedule(playMode, loops, clips, store.songBars(), loop)
    }, 150)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loops, clips, playMode, isPlaying, loop?.id])

  // Autosave — nothing here lives on a server, so losing the tab must not lose
  // the song.
  const save = useCallback(async () => {
    const state = useStore.getState()
    if (!state.loops.length) return
    const id = state.songId ?? uid('song')
    if (!state.songId) state.patch({ songId: id })
    try {
      const audio = await collectAudioAsync(state.loops, (bufferId) => engine().getBuffer(bufferId))
      await saveSong({
        id,
        name: state.name,
        bpm: state.bpm,
        scaleRoot: state.scaleRoot,
        scaleId: state.scaleId,
        grid: state.grid,
        snapScale: state.snapScale,
        loops: state.loops,
        clips: state.clips,
        createdAt: createdAt.current,
        updatedAt: Date.now(),
        audio,
      })
      setSavedAt(Date.now())
    } catch {
      /* storage can be full or blocked — the song still works in this session */
    }
  }, [])

  useEffect(() => {
    if (!loops.length) return
    const timer = window.setTimeout(() => void save(), 900)
    return () => window.clearTimeout(timer)
  }, [loops, clips, bpm, store.name, store.scaleId, store.scaleRoot, save])

  const resume = useCallback(() => {
    const state = useStore.getState()
    if (state.isRecording || !state.loops.length) return
    void (async () => {
      await engine().start()
      await engine().prepare(state.loops)
      engine().setBpm(state.bpm)
      engine().metronomeEnabled = state.metronome
      const active = selectedLoop(state)
      const from = state.playhead
      if (state.playMode === 'loop' && active) engine().playLoop(active, state.loops, from)
      else engine().playSong(state.loops, state.clips, state.songBars(), from)
      state.patch({ isPlaying: true, audioReady: true })
    })()
  }, [])

  const halt = useCallback(() => {
    const state = useStore.getState()
    if (!state.isPlaying) return
    const at = engine().position()
    engine().pause()
    state.patch({ isPlaying: false, playhead: at })
  }, [])

  // Space bar starts and stops, like every other music app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable) return
      if (event.code !== 'Space') return
      event.preventDefault()
      if (useStore.getState().isPlaying) halt()
      else resume()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [halt, resume])

  // The play/pause key on a Mac keyboard, and the media controls elsewhere.
  useEffect(() => {
    return installMediaKeys({
      title: useStore.getState().name,
      onPlay: resume,
      onPause: halt,
      onStop: () => {
        engine().stop()
        useStore.getState().patch({ isPlaying: false, playhead: 0 })
      },
    })
  }, [halt, resume])

  useEffect(() => {
    setMediaPlaying(isPlaying)
  }, [isPlaying])

  const hasLanes = loops.length > 0
  const showArrangement = loops.length > 1 || advanced
  const melodyLane = loops.find((l) => l.kind === 'melodic' && l.notes.length > 2)
  const canAddBand = !!melodyLane && !loops.some((l) => l.kind === 'drum')

  /** Everything playing, from the top — the state you want while jamming. */
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

  const addBand = useCallback(() => {
    const state = useStore.getState()
    const lane = state.loops.find((l) => l.kind === 'melodic' && l.notes.length > 2)
    if (!lane) return
    const band = buildAccompaniment(
      lane,
      styleId,
      state.scaleId,
      state.loops.length,
      'basis',
      Math.floor(Math.random() * 3),
    )
    if (!band.length) return
    state.addLoops(band)
    playAll()
  }, [playAll, styleId])

  const startFromGroove = useCallback(
    (style: string, grooveId: string) => {
      const state = useStore.getState()
      state.patch({ bpm: findStyle(style).bpm, scaleId: findStyle(style).scaleId })
      setStyleId(style)
      const roll = Math.floor(Math.random() * 3)
      state.addLoops(grooveToLoops(style, grooveId, 4, 60, Date.now() % 100000, roll))
      playAll()
    },
    [playAll],
  )

  const editor =
    tab === 'song' && showArrangement ? (
      <Arrangement />
    ) : loop ? (
      loop.kind === 'vocal' ? (
        <VocalEditor loop={loop} />
      ) : (
        <PianoRoll loop={loop} />
      )
    ) : (
      <EmptyStudio onGuided={() => setGuided(true)} onGroove={startFromGroove} />
    )

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar onShare={() => setSharing(true)} />

      <div className="flex min-h-0 flex-1">
        {hasLanes && (
          <aside
            className={clsx(
              'w-60 shrink-0 flex-col border-r border-ink-700 bg-ink-900 lg:flex',
              mobileView === 'lanes' ? 'flex flex-1 lg:flex-none' : 'hidden',
            )}
          >
            <div className="min-h-0 flex-1">
              <LoopSidebar />
            </div>
            {advanced && (
              <div className="border-t border-ink-700 p-3">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">
                  MIDI-Keyboard
                </h3>
                <MidiPanel />
              </div>
            )}
          </aside>
        )}

        <main
          className={clsx(
            'min-w-0 flex-1 flex-col bg-ink-950 lg:flex',
            mobileView === 'editor' || !hasLanes ? 'flex' : 'hidden',
          )}
        >
          {hasLanes && (
            <div className="flex items-center gap-1 border-b border-ink-700 bg-ink-900 px-3 py-1.5">
              <TabButton active={tab === 'editor'} onClick={() => patch({ tab: 'editor' })}>
                Spur bearbeiten
              </TabButton>
              {showArrangement && (
                <TabButton active={tab === 'song'} onClick={() => patch({ tab: 'song' })}>
                  Song-Aufbau
                </TabButton>
              )}
              {loop && tab === 'editor' && (
                <span className="ml-2 hidden truncate font-mono text-[10px] text-ink-400 sm:inline">
                  {loop.name} · {loop.bars} Takte · {loop.notes.length} Noten
                </span>
              )}
              <span className="ml-auto flex items-center gap-2">
                {canAddBand && (
                  <button
                    type="button"
                    onClick={addBand}
                    title="Bass, Akkorde und Schlagzeug passend zu deiner Melodie"
                    className="rounded-lg border border-accent/50 bg-accent/10 px-2.5 py-1 text-[11px] font-medium text-accent hover:bg-accent/20"
                  >
                    🎸 Band dazu
                  </button>
                )}
                <span className="font-mono text-[10px] text-ink-500">
                  {savedAt ? 'gespeichert' : ''}
                </span>
              </span>
            </div>
          )}
          <div className="min-h-0 flex-1">{editor}</div>
        </main>

        {advanced && (
          <aside
            className={clsx(
              'w-80 shrink-0 flex-col border-l border-ink-700 bg-ink-900 lg:flex',
              mobileView === 'more' ? 'flex flex-1 lg:flex-none' : 'hidden',
            )}
          >
            <CapturePanel />
          </aside>
        )}
      </div>

      {hasLanes && (
        <nav className="flex border-t border-ink-700 bg-ink-900 lg:hidden">
          {(
            [
              ['lanes', 'Spuren'],
              ['editor', 'Editor'],
              ...(advanced ? ([['more', 'Aufnehmen']] as const) : []),
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMobileView(id as MobileView)}
              className={clsx(
                'flex-1 py-2.5 text-xs font-medium',
                mobileView === id ? 'bg-accent/15 text-accent' : 'text-ink-300',
              )}
            >
              {label}
            </button>
          ))}
        </nav>
      )}

      <QuickRecord styleId={styleId} />

      {guided && (
        <NewSongFlow
          styleId={styleId}
          onStyleChange={setStyleId}
          onFinish={() => {
            setGuided(false)
            void save()
          }}
        />
      )}
      {sharing && <ShareDialog onClose={() => setSharing(false)} />}
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors',
        active ? 'bg-accent/15 text-accent' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
      )}
    >
      {children}
    </button>
  )
}

function EmptyStudio({
  onGuided,
  onGroove,
}: {
  onGuided: () => void
  onGroove: (styleId: string, grooveId: string) => void
}) {
  const [jamStyle, setJamStyle] = useState<string | null>(null)

  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-lg text-center">
        <h2 className="bg-gradient-to-br from-accent to-hot bg-clip-text text-2xl font-bold text-transparent">
          Summ einfach los.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-300">
          Drück unten rechts auf <strong className="text-ink-100">+ Spur aufnehmen</strong> und summ
          eine Melodie — summus macht daraus eine Spur, die du sofort hören kannst.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onGuided}
            className="rounded-lg bg-gradient-to-b from-accent to-accent-strong px-4 py-2 text-sm font-semibold text-ink-950 shadow-lg shadow-accent/20 hover:brightness-110"
          >
            Lieber Schritt für Schritt
          </button>
          <button
            type="button"
            onClick={() => setJamStyle(jamStyle ? null : 'synthwave')}
            className="rounded-lg border border-ink-600 px-4 py-2 text-sm text-ink-200 hover:border-accent hover:text-accent"
          >
            Mit einem Groove starten
          </button>
        </div>

        {jamStyle && (
          <div className="mt-5 rounded-xl border border-ink-700 bg-ink-900/70 p-3 text-left">
            <p className="mb-2 text-[11px] text-ink-300">
              Such dir einen Beat aus — er landet als fertige Spuren im Song, und du summst
              einfach drüber.
            </p>
            <div className="scroll-thin mb-2 flex gap-1 overflow-x-auto pb-1">
              {STYLES.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => setJamStyle(style.id)}
                  className={clsx(
                    'shrink-0 rounded-lg px-2 py-1 text-[11px]',
                    jamStyle === style.id
                      ? 'bg-accent text-ink-950'
                      : 'bg-ink-800 text-ink-300 hover:bg-ink-700',
                  )}
                >
                  {style.emoji} {style.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {grooves(jamStyle).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  title={g.hint}
                  onClick={() => onGroove(jamStyle, g.id)}
                  className="rounded-lg border border-ink-600 bg-ink-850 px-2.5 py-1.5 text-[11px] text-ink-100 hover:border-accent hover:text-accent"
                >
                  ▶ {g.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
