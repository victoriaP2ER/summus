'use client'

/**
 * Lets the play/pause key on a Mac keyboard (and the media controls on other
 * systems) drive the transport.
 *
 * The Media Session API only routes those keys to a page the browser considers
 * to be playing media — and Web Audio alone does not count. A silent looping
 * audio element is the accepted way to register as a media source.
 */
let element: HTMLAudioElement | null = null
let installed = false

/** One second of silence, small enough to inline. */
const SILENCE =
  'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAgD4AAAB9AAACABAAZGF0YQ4AAAAAAAAAAAAAAAAAAAAAAA=='

export interface MediaKeyHandlers {
  onPlay: () => void
  onPause: () => void
  onStop?: () => void
  title?: string
}

export function installMediaKeys(handlers: MediaKeyHandlers): () => void {
  if (typeof window === 'undefined' || !('mediaSession' in navigator)) return () => {}

  if (!element) {
    element = new Audio(SILENCE)
    element.loop = true
    element.volume = 0.0001
    element.preload = 'auto'
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title: handlers.title ?? 'summus',
    artist: 'summus',
  })

  const safe = (action: MediaSessionAction, run: () => void) => {
    try {
      navigator.mediaSession.setActionHandler(action, run)
    } catch {
      // Not every browser supports every action; the rest still work.
    }
  }

  safe('play', handlers.onPlay)
  safe('pause', handlers.onPause)
  if (handlers.onStop) safe('stop', handlers.onStop)

  installed = true
  return () => {
    safe('play', () => {})
    safe('pause', () => {})
  }
}

/**
 * Tell the browser whether we are playing. The silent element has to actually
 * run, otherwise the media keys go to whatever else is playing on the machine.
 */
export function setMediaPlaying(playing: boolean): void {
  if (!installed || !element) return
  navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
  if (playing) {
    void element.play().catch(() => {
      /* needs a user gesture first; the next press works */
    })
  } else {
    element.pause()
  }
}
