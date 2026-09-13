'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Logo } from '@/components/Logo'
import { StyleArt } from '@/components/StyleArt'
import { clsx } from '@/components/clsx'
import { instrumentMeta } from '@/lib/audio/instruments'
import { STYLES } from '@/lib/audio/styles'
import { deleteSong, listSongs, type SongSummary } from '@/lib/library'

const STEPS = [
  {
    emoji: '🎤',
    title: 'Summ eine Melodie',
    text: 'Ein kurzer Einzähler, dann summst du einfach drauflos. Keine Noten, keine Vorkenntnisse.',
  },
  {
    emoji: '🎻',
    title: 'Such dir einen Klang',
    text: 'Deine Melodie läuft sofort als Violine, Synth oder E-Piano — du klickst dich einfach durch.',
  },
  {
    emoji: '🥁',
    title: 'Beatboxe den Beat',
    text: '"Bum – Tss" ins Mikro wird zu Kick und Snare. Das Playback läuft dabei mit.',
  },
  {
    emoji: '🎚️',
    title: 'Bau deinen Song',
    text: 'Spuren übereinander legen, Blöcke verschieben, fertig. Als MP3 laden oder per Link teilen.',
  },
]

export default function LandingPage() {
  const [songs, setSongs] = useState<SongSummary[] | null>(null)

  useEffect(() => {
    void listSongs().then(setSongs)
  }, [])

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`„${name}" wirklich löschen? Das lässt sich nicht rückgängig machen.`)) return
    await deleteSong(id)
    setSongs(await listSongs())
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-800 px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Logo size="md" />
          <Link
            href="/studio?new=1"
            className="rounded-lg bg-gradient-to-b from-accent to-accent-strong px-4 py-2 text-sm font-semibold text-ink-950 shadow-lg shadow-accent/20 transition hover:brightness-110"
          >
            Neues Lied
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-14 px-5 py-12">
        <section className="text-center">
          <h1 className="text-4xl leading-tight font-bold text-ink-100 sm:text-5xl">
            Du kannst summen?
            <br />
            <span className="bg-gradient-to-br from-accent to-hot bg-clip-text text-transparent">
              Dann kannst du Musik machen.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ink-300">
            summus hört zu, während du summst, singst oder beatboxt — und überträgt die Tonhöhen auf
            echte Instrumente. Aus kurzen Schnipseln wird Spur für Spur ein ganzer Song. Ohne Noten,
            ohne Instrument, ohne Vorkenntnisse.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/studio?new=1"
              className="rounded-xl bg-gradient-to-b from-accent to-accent-strong px-6 py-3 text-base font-semibold text-ink-950 shadow-xl shadow-accent/25 transition hover:brightness-110"
            >
              Los geht's — Schritt für Schritt
            </Link>
            <Link
              href="/studio"
              className="rounded-xl border border-ink-600 px-5 py-3 text-sm text-ink-200 transition hover:border-ink-400 hover:text-ink-100"
            >
              Direkt ins Studio
            </Link>
          </div>
          <p className="mt-4 text-[11px] text-ink-500">
            Läuft komplett in deinem Browser. Deine Aufnahmen verlassen dein Gerät nicht.
          </p>
        </section>

        <section>
          <h2 className="mb-5 text-center text-[11px] font-semibold tracking-[0.18em] text-ink-400 uppercase">
            So funktioniert's
          </h2>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step.title} className="panel rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{step.emoji}</span>
                  <span className="font-mono text-[10px] text-ink-500">0{i + 1}</span>
                </div>
                <h3 className="mt-2 text-sm font-semibold text-ink-100">{step.title}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-ink-400">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-ink-100">Deine Lieder</h2>
          <p className="mb-4 text-[11px] text-ink-400">
            Alles liegt in diesem Browser gespeichert — auf einem anderen Gerät sind sie nicht da.
            Zum Mitnehmen: MP3 exportieren oder einen Link erzeugen.
          </p>

          {songs === null ? (
            <div className="panel rounded-xl px-4 py-8 text-center text-[11px] text-ink-400">
              Lade …
            </div>
          ) : songs.length === 0 ? (
            <div className="panel rounded-xl px-4 py-10 text-center">
              <p className="text-sm text-ink-300">Noch nichts aufgenommen.</p>
              <Link
                href="/studio?new=1"
                className="mt-4 inline-block rounded-lg border border-accent/50 bg-accent/10 px-4 py-2 text-xs font-medium text-accent hover:bg-accent/20"
              >
                Erstes Lied aufnehmen
              </Link>
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {songs.map((song) => (
                <li key={song.id} className="panel flex items-center gap-3 rounded-xl p-3">
                  <Link href={`/studio?song=${song.id}`} className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-ink-100">{song.name}</h3>
                    <p className="mt-0.5 font-mono text-[10px] text-ink-400">
                      {song.bpm} BPM · {song.bars} Takte · {song.laneCount} Spuren
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1">
                      {song.instruments.slice(0, 5).map((id) => (
                        <span
                          key={id}
                          title={instrumentMeta(id).label}
                          className="rounded bg-ink-800 px-1.5 py-0.5 text-[10px] text-ink-300"
                        >
                          {instrumentMeta(id).emoji} {instrumentMeta(id).label}
                        </span>
                      ))}
                    </p>
                  </Link>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Link
                      href={`/studio?song=${song.id}`}
                      className="rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1 text-center text-[11px] text-ink-200 hover:border-accent hover:text-accent"
                    >
                      Öffnen
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(song.id, song.name)}
                      className="rounded-lg border border-ink-700 px-2.5 py-1 text-[11px] text-ink-400 hover:border-rose-500/50 hover:text-rose-300"
                    >
                      Löschen
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-1 text-lg font-bold text-ink-100">Richtungen, die du wählen kannst</h2>
          <p className="mb-4 text-[11px] text-ink-400">
            Statt dich durch 30 Instrumente zu klicken, suchst du dir eine Stimmung aus — die
            passenden Klänge kommen mit.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {STYLES.map((style) => (
              <div
                key={style.id}
                className={clsx('overflow-hidden rounded-xl border border-ink-700')}
                title={style.hint}
              >
                <StyleArt style={style} className="h-14 w-full" />
                <div className="px-2 py-1.5 text-[10px] font-medium text-ink-200">
                  {style.emoji} {style.label}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-800 px-5 py-6 text-center">
        <p className="text-[11px] text-ink-500">
          summus — summen wird Musik. Alles passiert lokal in deinem Browser.
        </p>
      </footer>
    </div>
  )
}
