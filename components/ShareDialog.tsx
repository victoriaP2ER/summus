'use client'

import { useState } from 'react'
import { clsx } from './clsx'
import { Button } from './ui'
import { engine } from '@/lib/audio/engine'
import { audioBufferToMp3, audioBufferToWav, downloadBlob, renderSong, safeFilename } from '@/lib/audio/export'
import { encodeShare, vocalLaneCount } from '@/lib/library'
import { useStore } from '@/lib/store'

type Job = 'idle' | 'wav' | 'mp3' | 'link'

export function ShareDialog({ onClose }: { onClose: () => void }) {
  const [job, setJob] = useState<Job>('idle')
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const store = useStore()

  const bars = store.songBars()
  const vocals = vocalLaneCount(store.loops)
  const seconds = (bars * 4 * 60) / store.bpm

  const render = async (format: 'wav' | 'mp3') => {
    setError('')
    setJob(format)
    try {
      await engine().start()
      const buffer = await renderSong(store.loops, store.clips, { bpm: store.bpm, bars })
      const blob = format === 'wav' ? audioBufferToWav(buffer) : await audioBufferToMp3(buffer)
      downloadBlob(blob, `${safeFilename(store.name)}.${format}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export fehlgeschlagen')
    } finally {
      setJob('idle')
    }
  }

  const makeLink = async () => {
    setError('')
    setJob('link')
    try {
      const token = await encodeShare({
        v: 1,
        name: store.name,
        bpm: store.bpm,
        scaleRoot: store.scaleRoot,
        scaleId: store.scaleId,
        grid: store.grid,
        loops: store.loops,
        clips: store.clips,
      })
      setLink(`${window.location.origin}/studio?s=${token}`)
    } catch {
      setError('Der Link konnte nicht erzeugt werden.')
    } finally {
      setJob('idle')
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Kopieren hat nicht geklappt — markier den Link und kopier ihn von Hand.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 p-5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="panel w-full max-w-md space-y-4 rounded-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-ink-100">Teilen & Export</h2>
            <p className="mt-0.5 font-mono text-[11px] text-ink-400">
              {bars} Takte · {Math.floor(seconds / 60)}:{String(Math.round(seconds % 60)).padStart(2, '0')} min ·{' '}
              {store.loops.length} Lanes
            </p>
          </div>
          <Button size="sm" onClick={onClose}>
            Schließen
          </Button>
        </div>

        <section className="space-y-2 rounded-xl border border-ink-700 bg-ink-950/60 p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">
            Als Audiodatei
          </h3>
          <p className="text-[11px] leading-relaxed text-ink-400">
            Der ganze Song wird gerendert und landet in deinem Download-Ordner.
          </p>
          <div className="flex gap-2">
            <Button
              size="md"
              variant="accent"
              className="flex-1"
              disabled={job !== 'idle' || !store.loops.length}
              onClick={() => render('mp3')}
            >
              {job === 'mp3' ? 'Rendere …' : 'MP3 laden'}
            </Button>
            <Button
              size="md"
              className="flex-1"
              disabled={job !== 'idle' || !store.loops.length}
              onClick={() => render('wav')}
            >
              {job === 'wav' ? 'Rendere …' : 'WAV laden'}
            </Button>
          </div>
        </section>

        <section className="space-y-2 rounded-xl border border-ink-700 bg-ink-950/60 p-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">
            Als Link
          </h3>
          <p className="text-[11px] leading-relaxed text-ink-400">
            Der komplette Song steckt im Link selbst — kein Server, keine Anmeldung. Wer ihn öffnet,
            kann mithören und weiterbauen.
          </p>
          {vocals > 0 && (
            <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-1.5 text-[10px] leading-relaxed text-amber-300">
              {vocals === 1 ? 'Eine Gesangsspur ist' : `${vocals} Gesangsspuren sind`} nicht dabei:
              echte Aufnahmen sind zu groß für einen Link. Nimm dafür den MP3-Export.
            </p>
          )}
          {link ? (
            <div className="space-y-2">
              <input
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                className="w-full rounded-lg border border-ink-600 bg-ink-900 px-2 py-1.5 font-mono text-[10px] text-ink-200"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="accent" className="flex-1" onClick={copy}>
                  {copied ? '✓ Kopiert' : 'Link kopieren'}
                </Button>
                <span
                  className={clsx(
                    'flex items-center px-1 font-mono text-[10px]',
                    link.length > 8000 ? 'text-amber-300' : 'text-ink-500',
                  )}
                >
                  {(link.length / 1024).toFixed(1)} kB
                </span>
              </div>
              {link.length > 8000 && (
                <p className="text-[10px] leading-relaxed text-amber-300">
                  Der Link ist sehr lang — manche Chat-Apps kürzen ihn. Im Zweifel lieber die
                  MP3 verschicken.
                </p>
              )}
            </div>
          ) : (
            <Button
              size="md"
              className="w-full"
              disabled={job !== 'idle' || !store.loops.length}
              onClick={makeLink}
            >
              {job === 'link' ? 'Baue Link …' : 'Link erzeugen'}
            </Button>
          )}
        </section>

        {error && (
          <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
