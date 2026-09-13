'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Studio } from '@/components/Studio'
import { Logo } from '@/components/Logo'
import { engine } from '@/lib/audio/engine'
import { decodeShare, loadSong } from '@/lib/library'
import { useStore } from '@/lib/store'

function StudioLoader() {
  const params = useSearchParams()
  const [ready, setReady] = useState(false)
  const [guided, setGuided] = useState(false)
  const loadProject = useStore((s) => s.loadProject)

  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      const songId = params.get('song')
      const shared = params.get('s')
      const isNew = params.get('new') === '1'

      if (songId) {
        const song = await loadSong(songId)
        if (song && !cancelled) {
          // Vocal takes are stored as WAV; decode them back into the engine so
          // the lanes still sing after a reload.
          for (const [bufferId, bytes] of Object.entries(song.audio ?? {})) {
            try {
              const buffer = await engine().decode(new Blob([bytes], { type: 'audio/wav' }))
              engine().buffers.set(bufferId, buffer)
            } catch {
              /* a take that will not decode simply stays silent */
            }
          }
          loadProject({
            songId: song.id,
            name: song.name,
            bpm: song.bpm,
            scaleRoot: song.scaleRoot,
            scaleId: song.scaleId,
            grid: song.grid,
            snapScale: song.snapScale,
            loops: song.loops,
            clips: song.clips,
            selectedLoopId: song.loops[0]?.id ?? null,
          })
          for (const loop of song.loops) {
            if (loop.kind === 'vocal') engine().renderVocal(loop, song.bpm)
          }
        }
      } else if (shared) {
        const payload = await decodeShare(shared)
        if (payload && !cancelled) {
          loadProject({
            songId: null,
            name: payload.name,
            bpm: payload.bpm,
            scaleRoot: payload.scaleRoot,
            scaleId: payload.scaleId,
            grid: payload.grid,
            loops: payload.loops,
            clips: payload.clips,
            selectedLoopId: payload.loops[0]?.id ?? null,
          })
        }
      } else if (isNew) {
        loadProject({ name: 'Neues Lied' })
        setGuided(true)
      }

      if (!cancelled) setReady(true)
    }

    void boot()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!ready) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <Logo size="lg" withTagline />
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  return <Studio startGuided={guided} />
}

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Logo size="lg" withTagline />
        </div>
      }
    >
      <StudioLoader />
    </Suspense>
  )
}
