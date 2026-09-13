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

  // Space bar starts and stops, like every other music app.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable) return
      if (event.code !== 'Space') return
      event.preventDefault()
      const state = useStore.getState()
      if (state.isRecording || !state.loops.length) return
      if (state.isPlaying) {
        const at = engine().position()
        engine().pause()
        state.patch({ isPlaying: false, playhead: at })
        return
      }
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
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const hasLanes = loops.length > 0
  const showArrangement = loops.length > 1 || advanced

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
      <EmptyStudio onGuided={() => setGuided(true)} />
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
                Lane bearbeiten
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
              <span className="ml-auto font-mono text-[10px] text-ink-500">
                {savedAt ? 'gespeichert' : ''}
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
              ['lanes', 'Lanes'],
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

function EmptyStudio({ onGuided }: { onGuided: () => void }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h2 className="bg-gradient-to-br from-accent to-hot bg-clip-text text-2xl font-bold text-transparent">
          Summ einfach los.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-300">
          Drück unten rechts auf <strong className="text-ink-100">Aufnehmen</strong> und summ eine
          Melodie — summus macht daraus eine Spur, die du sofort hören kannst.
        </p>
        <button
          type="button"
          onClick={onGuided}
          className="mt-5 rounded-lg bg-gradient-to-b from-accent to-accent-strong px-4 py-2 text-sm font-semibold text-ink-950 shadow-lg shadow-accent/20 hover:brightness-110"
        >
          Lieber Schritt für Schritt
        </button>
      </div>
    </div>
  )
}
