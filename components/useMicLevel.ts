'use client'

import { useEffect, useState } from 'react'
import { engine } from '@/lib/audio/engine'

/** Polls the input meter while `active`, so a level bar can show live signal. */
export function useMicLevel(active: boolean): { level: number; peak: number } {
  const [level, setLevel] = useState(0)
  const [peak, setPeak] = useState(0)

  useEffect(() => {
    if (!active) {
      setLevel(0)
      return
    }
    let frame = 0
    let highest = 0
    const tick = () => {
      const value = engine().micLevel()
      setLevel(value)
      if (value > highest) {
        highest = value
        setPeak(value)
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active])

  return { level, peak }
}
