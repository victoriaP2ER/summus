'use client'

import { create } from 'zustand'
import type { Clip, InstrumentId, Loop, LoopKind, Note, VocalTake } from './types'
import { LOOP_COLORS, uid } from './music'
import type { MicMode } from './audio/recorder'

export type PlayMode = 'loop' | 'song'
export type EditorTab = 'editor' | 'song'

interface ProjectState {
  /** Id in the song library; null until the song is first saved */
  songId: string | null
  name: string
  bpm: number
  scaleRoot: number
  scaleId: string
  grid: number
  quantiseAmount: number
  snapScale: boolean

  loops: Loop[]
  clips: Clip[]
  selectedLoopId: string | null
  selectedNoteIds: string[]

  playMode: PlayMode
  tab: EditorTab
  /** Playhead position in beats — kept while paused so it can be dragged */
  playhead: number
  isPlaying: boolean
  isRecording: boolean
  countInBars: number
  recordBars: number
  metronome: boolean
  overdub: boolean
  micMode: MicMode
  latencyMs: number

  audioReady: boolean
  status: string
  /** Hides the deeper editing tools until someone asks for them */
  advanced: boolean
}

interface ProjectActions {
  set: <K extends keyof ProjectState>(key: K, value: ProjectState[K]) => void
  patch: (partial: Partial<ProjectState>) => void

  addLoop: (partial?: Partial<Loop>) => Loop
  addLoops: (loops: Loop[], clips?: Clip[]) => void
  updateLoop: (id: string, partial: Partial<Loop>) => void
  removeLoop: (id: string) => void
  duplicateLoop: (id: string) => void
  selectLoop: (id: string | null) => void

  setNotes: (loopId: string, notes: Note[]) => void
  addNote: (loopId: string, note: Note) => void
  updateNote: (loopId: string, noteId: string, partial: Partial<Note>) => void
  updateNotes: (loopId: string, noteIds: string[], partial: Partial<Note>) => void
  removeNotes: (loopId: string, noteIds: string[]) => void
  setVocal: (loopId: string, vocal: VocalTake | undefined) => void

  addClip: (loopId: string, startBar: number, track?: number) => void
  updateClip: (id: string, partial: Partial<Clip>) => void
  removeClip: (id: string) => void

  songBars: () => number
  clear: () => void
  loadProject: (project: Partial<ProjectState>) => void
}

export type Store = ProjectState & ProjectActions

const initialState: ProjectState = {
  songId: null,
  name: 'Neuer Song',
  bpm: 100,
  scaleRoot: 0,
  scaleId: 'minor',
  grid: 0.25,
  quantiseAmount: 1,
  snapScale: true,

  loops: [],
  clips: [],
  selectedLoopId: null,
  selectedNoteIds: [],

  playMode: 'loop',
  tab: 'editor',
  playhead: 0,
  isPlaying: false,
  isRecording: false,
  countInBars: 1,
  recordBars: 4,
  metronome: true,
  overdub: true,
  micMode: 'headphones',
  latencyMs: 0,

  audioReady: false,
  status: '',
  advanced: false,
}

/** Where the arrangement currently ends, in bars. */
function songEndOf(loops: Loop[], clips: Clip[]): number {
  let end = 0
  for (const clip of clips) {
    const loop = loops.find((l) => l.id === clip.loopId)
    if (!loop) continue
    end = Math.max(end, clip.startBar + loop.bars * clip.repeats)
  }
  return end
}

export function createLoop(partial: Partial<Loop> = {}, index = 0): Loop {
  const kind: LoopKind = partial.kind ?? 'melodic'
  const instrument: InstrumentId = partial.instrument ?? (kind === 'drum' ? 'drums' : 'violin')
  return {
    id: uid('loop'),
    name: partial.name ?? `Loop ${index + 1}`,
    bars: partial.bars ?? 4,
    kind,
    instrument,
    notes: partial.notes ?? [],
    vocal: partial.vocal,
    color: partial.color ?? LOOP_COLORS[index % LOOP_COLORS.length],
    muted: partial.muted ?? false,
    solo: partial.solo ?? false,
    volume: partial.volume ?? 0,
    transpose: partial.transpose ?? 0,
  }
}

export const useStore = create<Store>((set, get) => ({
  ...initialState,

  set: (key, value) => set({ [key]: value } as Partial<ProjectState>),
  patch: (partial) => set(partial),

  addLoop: (partial = {}) => {
    const loop = createLoop(partial, get().loops.length)
    set((s) => {
      // A fresh loop runs under the whole song by default — record a two-bar
      // riff and it becomes the bed, until you drag it shorter.
      const end = songEndOf(s.loops, s.clips)
      const repeats = end > loop.bars ? Math.ceil(end / loop.bars) : 1
      return {
        loops: [...s.loops, loop],
        selectedLoopId: loop.id,
        clips: [
          ...s.clips,
          { id: uid('clip'), loopId: loop.id, startBar: 0, repeats, track: s.loops.length },
        ],
      }
    })
    return loop
  },

  addLoops: (loops, clips) =>
    set((s) => {
      const end = songEndOf(s.loops, s.clips)
      return {
        loops: [...s.loops, ...loops],
        clips: [
          ...s.clips,
          ...(clips ??
            loops.map((l, i) => ({
              id: uid('clip'),
              loopId: l.id,
              startBar: 0,
              repeats: end > l.bars ? Math.ceil(end / l.bars) : 1,
              track: s.loops.length + i,
            }))),
        ],
        selectedLoopId: loops[0]?.id ?? s.selectedLoopId,
      }
    }),

  updateLoop: (id, partial) =>
    set((s) => ({ loops: s.loops.map((l) => (l.id === id ? { ...l, ...partial } : l)) })),

  removeLoop: (id) =>
    set((s) => ({
      loops: s.loops.filter((l) => l.id !== id),
      clips: s.clips.filter((c) => c.loopId !== id),
      selectedLoopId: s.selectedLoopId === id ? (s.loops.find((l) => l.id !== id)?.id ?? null) : s.selectedLoopId,
    })),

  duplicateLoop: (id) =>
    set((s) => {
      const source = s.loops.find((l) => l.id === id)
      if (!source) return s
      const copy: Loop = {
        ...source,
        id: uid('loop'),
        name: `${source.name} Kopie`,
        notes: source.notes.map((n) => ({ ...n, id: uid('n') })),
        color: LOOP_COLORS[s.loops.length % LOOP_COLORS.length],
      }
      return {
        loops: [...s.loops, copy],
        clips: [
          ...s.clips,
          { id: uid('clip'), loopId: copy.id, startBar: 0, repeats: 1, track: s.loops.length },
        ],
        selectedLoopId: copy.id,
      }
    }),

  selectLoop: (id) => set({ selectedLoopId: id, selectedNoteIds: [] }),

  setNotes: (loopId, notes) =>
    set((s) => ({ loops: s.loops.map((l) => (l.id === loopId ? { ...l, notes } : l)) })),

  addNote: (loopId, note) =>
    set((s) => ({
      loops: s.loops.map((l) => (l.id === loopId ? { ...l, notes: [...l.notes, note] } : l)),
    })),

  updateNote: (loopId, noteId, partial) =>
    set((s) => ({
      loops: s.loops.map((l) =>
        l.id === loopId
          ? { ...l, notes: l.notes.map((n) => (n.id === noteId ? { ...n, ...partial } : n)) }
          : l,
      ),
    })),

  updateNotes: (loopId, noteIds, partial) =>
    set((s) => ({
      loops: s.loops.map((l) =>
        l.id === loopId
          ? { ...l, notes: l.notes.map((n) => (noteIds.includes(n.id) ? { ...n, ...partial } : n)) }
          : l,
      ),
    })),

  removeNotes: (loopId, noteIds) =>
    set((s) => ({
      loops: s.loops.map((l) =>
        l.id === loopId ? { ...l, notes: l.notes.filter((n) => !noteIds.includes(n.id)) } : l,
      ),
      selectedNoteIds: s.selectedNoteIds.filter((id) => !noteIds.includes(id)),
    })),

  setVocal: (loopId, vocal) =>
    set((s) => ({ loops: s.loops.map((l) => (l.id === loopId ? { ...l, vocal } : l)) })),

  addClip: (loopId, startBar, track) =>
    set((s) => ({
      clips: [
        ...s.clips,
        {
          id: uid('clip'),
          loopId,
          startBar,
          repeats: 1,
          track: track ?? s.clips.reduce((m, c) => Math.max(m, c.track + 1), 0),
        },
      ],
    })),

  updateClip: (id, partial) =>
    set((s) => ({ clips: s.clips.map((c) => (c.id === id ? { ...c, ...partial } : c)) })),

  removeClip: (id) => set((s) => ({ clips: s.clips.filter((c) => c.id !== id) })),

  songBars: () => {
    const { clips, loops } = get()
    let end = 4
    for (const clip of clips) {
      const loop = loops.find((l) => l.id === clip.loopId)
      if (!loop) continue
      end = Math.max(end, clip.startBar + loop.bars * clip.repeats)
    }
    return end
  },

  clear: () => set({ ...initialState, audioReady: get().audioReady }),

  loadProject: (project) =>
    set({
      ...initialState,
      audioReady: get().audioReady,
      advanced: get().advanced,
      ...project,
      isPlaying: false,
      isRecording: false,
      selectedNoteIds: [],
    }),
}))

export function selectedLoop(state: Store): Loop | null {
  return state.loops.find((l) => l.id === state.selectedLoopId) ?? null
}
