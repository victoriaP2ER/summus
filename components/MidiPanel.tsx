'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clsx } from './clsx'
import { Button, Field, Select } from './ui'
import { engine } from '@/lib/audio/engine'
import { MidiInput, keyToMidi, type MidiDevice } from '@/lib/audio/midi'
import { midiToName, quantize, uid } from '@/lib/music'
import { selectedLoop, useStore } from '@/lib/store'
import type { Note } from '@/lib/types'

export function MidiPanel() {
  const midiRef = useRef<MidiInput | null>(null)
  const heldRef = useRef(new Map<number, { startBeat: number; velocity: number }>())
  const [devices, setDevices] = useState<MidiDevice[]>([])
  const [deviceId, setDeviceId] = useState<string>('all')
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [armed, setArmed] = useState(false)
  const [octave, setOctave] = useState(5)
  const [lastNote, setLastNote] = useState('')
  const [keyboardOn, setKeyboardOn] = useState(false)

  const store = useStore()
  const loop = selectedLoop(store)
  const grid = store.grid
  const isPlaying = store.isPlaying
  const setNotes = store.setNotes

  const loopRef = useRef(loop)
  loopRef.current = loop
  const armedRef = useRef(armed)
  armedRef.current = armed
  const playingRef = useRef(isPlaying)
  playingRef.current = isPlaying

  const noteOn = useCallback(
    (midi: number, velocity: number) => {
      const target = loopRef.current
      if (!target) return
      setLastNote(midiToName(midi))
      if (target.kind === 'drum' || target.instrument === 'drums') {
        engine().previewDrum(target.id, 'kick', velocity)
      } else {
        engine().instrumentFor(target.id)?.attack(midi + target.transpose, engine().now(), velocity)
      }
      if (armedRef.current && playingRef.current) {
        const beats = engine().position() % (target.bars * 4)
        heldRef.current.set(midi, { startBeat: beats, velocity })
      }
    },
    [],
  )

  const noteOff = useCallback(
    (midi: number) => {
      const target = loopRef.current
      if (!target) return
      engine().instrumentFor(target.id)?.release(midi + target.transpose, engine().now())

      const held = heldRef.current.get(midi)
      if (!held) return
      heldRef.current.delete(midi)
      if (!armedRef.current) return

      const total = target.bars * 4
      const end = engine().position() % total
      const duration = Math.max(grid || 0.125, (end - held.startBeat + total) % total)
      const start = grid > 0 ? quantize(held.startBeat, grid) : held.startBeat
      const note: Note = {
        id: uid('n'),
        start: Math.max(0, Math.min(total - 0.05, start)),
        duration: grid > 0 ? Math.max(grid, quantize(duration, grid)) : duration,
        pitch: midi,
        velocity: held.velocity,
      }
      const current = useStore.getState().loops.find((l) => l.id === target.id)
      if (current) setNotes(target.id, [...current.notes, note])
    },
    [grid, setNotes],
  )

  const connect = async () => {
    setError('')
    try {
      await engine().start()
      const input = midiRef.current ?? new MidiInput()
      midiRef.current = input
      const found = await input.connect()
      input.on(
        (event) => noteOn(event.midi, event.velocity || 0.8),
        (event) => noteOff(event.midi),
      )
      setDevices(found)
      setConnected(true)
      if (!found.length) setError('Kein MIDI-Gerät gefunden. Angeschlossen und eingeschaltet?')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'MIDI konnte nicht gestartet werden')
    }
  }

  useEffect(() => {
    if (!connected || !midiRef.current) return
    const input = midiRef.current
    input.on(
      (event) => noteOn(event.midi, event.velocity || 0.8),
      (event) => noteOff(event.midi),
    )
  }, [connected, noteOn, noteOff])

  // Computer keyboard as a stand-in controller.
  useEffect(() => {
    if (!keyboardOn) return
    const down = new Set<string>()
    const onDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable) return
      if (event.repeat || down.has(event.key)) return
      const midi = keyToMidi(event.key, octave)
      if (midi === null) return
      event.preventDefault()
      down.add(event.key)
      void engine().start().then(() => noteOn(midi, 0.85))
    }
    const onUp = (event: KeyboardEvent) => {
      if (!down.has(event.key)) return
      down.delete(event.key)
      const midi = keyToMidi(event.key, octave)
      if (midi !== null) noteOff(midi)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [keyboardOn, octave, noteOn, noteOff])

  useEffect(() => () => midiRef.current?.disconnect(), [])

  return (
    <div className="space-y-3">
      {!connected ? (
        <Button size="sm" className="w-full" onClick={connect}>
          MIDI-Keyboard verbinden
        </Button>
      ) : (
        <Field label="Gerät" hint={`${devices.length} gefunden`}>
          <Select
            value={deviceId}
            options={[
              { value: 'all', label: 'Alle Geräte' },
              ...devices.map((d) => ({ value: d.id, label: d.name })),
            ]}
            onChange={(id) => {
              setDeviceId(id)
              midiRef.current?.select(id)
            }}
          />
        </Field>
      )}

      <div className="flex gap-1.5">
        <Button
          size="sm"
          active={armed}
          onClick={() => setArmed(!armed)}
          className="flex-1"
          title="Gespielte Noten landen im ausgewählten Loop, solange die Wiedergabe läuft"
        >
          {armed ? '● Aufnahmebereit' : 'Aufnahme scharf'}
        </Button>
        <Button size="sm" active={keyboardOn} onClick={() => setKeyboardOn(!keyboardOn)} title="A S D F … als Klaviatur">
          ⌨︎ Tasten
        </Button>
      </div>

      {keyboardOn && (
        <Field label="Oktave" hint={`C${octave - 1}`}>
          <div className="flex gap-1">
            {[3, 4, 5, 6].map((o) => (
              <Button key={o} size="sm" active={octave === o} onClick={() => setOctave(o)} className="flex-1">
                {o - 1}
              </Button>
            ))}
          </div>
        </Field>
      )}

      <div className="flex items-center justify-between rounded-lg border border-ink-700 bg-ink-950 px-2.5 py-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-ink-400">Ziel-Spur</span>
        <span className={clsx('truncate text-[11px] font-medium', loop ? 'text-ink-100' : 'text-ink-500')}>
          {loop ? loop.name : 'keine ausgewählt'}
        </span>
      </div>

      {lastNote && (
        <p className="text-center font-mono text-[10px] text-accent">zuletzt gespielt: {lastNote}</p>
      )}

      {armed && !isPlaying && (
        <p className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-1.5 text-[10px] text-amber-300">
          Starte die Wiedergabe — dann werden deine Anschläge in die Spur geschrieben.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-[10px] text-rose-300">
          {error}
        </p>
      )}
    </div>
  )
}
