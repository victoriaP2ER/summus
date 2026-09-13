'use client'

export interface MidiNoteEvent {
  midi: number
  velocity: number
  /** AudioContext-ish timestamp in seconds */
  time: number
}

export interface MidiDevice {
  id: string
  name: string
}

type NoteHandler = (event: MidiNoteEvent) => void

/**
 * Web MIDI input. Keeps the browser plumbing in one place so the UI only sees
 * note-on / note-off.
 */
export class MidiInput {
  private access: MIDIAccess | null = null
  private attached: MIDIInput[] = []
  private onNoteOn: NoteHandler | null = null
  private onNoteOff: NoteHandler | null = null

  devices: MidiDevice[] = []
  enabledId: string | 'all' = 'all'
  supported = typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator

  async connect(): Promise<MidiDevice[]> {
    if (!this.supported) throw new Error('Web MIDI wird von diesem Browser nicht unterstützt')
    this.access = await navigator.requestMIDIAccess({ sysex: false })
    this.refresh()
    this.access.onstatechange = () => this.refresh()
    return this.devices
  }

  private refresh(): void {
    if (!this.access) return
    this.detach()
    this.devices = []
    this.access.inputs.forEach((input) => {
      this.devices.push({ id: input.id, name: input.name ?? 'MIDI-Gerät' })
      if (this.enabledId !== 'all' && this.enabledId !== input.id) return
      input.onmidimessage = (message) => this.handle(message)
      this.attached.push(input)
    })
  }

  private handle(message: MIDIMessageEvent): void {
    const data = message.data
    if (!data || data.length < 2) return
    const status = data[0] & 0xf0
    const midi = data[1]
    const velocity = (data[2] ?? 0) / 127
    const time = message.timeStamp / 1000

    if (status === 0x90 && velocity > 0) {
      this.onNoteOn?.({ midi, velocity, time })
    } else if (status === 0x80 || (status === 0x90 && velocity === 0)) {
      this.onNoteOff?.({ midi, velocity, time })
    }
  }

  select(id: string | 'all'): void {
    this.enabledId = id
    this.refresh()
  }

  on(noteOn: NoteHandler, noteOff: NoteHandler): void {
    this.onNoteOn = noteOn
    this.onNoteOff = noteOff
  }

  private detach(): void {
    for (const input of this.attached) input.onmidimessage = null
    this.attached = []
  }

  disconnect(): void {
    this.detach()
    if (this.access) this.access.onstatechange = null
    this.access = null
    this.devices = []
  }
}

/** Two octaves of the computer keyboard, so you can play without a controller. */
export const KEYBOARD_MAP: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, z: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, ö: 16, ä: 17,
  y: -12, x: -10, c: -8, v: -7, b: -5, n: -3, m: -1,
}

export function keyToMidi(key: string, baseOctave: number): number | null {
  const offset = KEYBOARD_MAP[key.toLowerCase()]
  if (offset === undefined) return null
  return baseOctave * 12 + offset
}
