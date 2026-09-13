'use client'

import { clsx } from './clsx'

/**
 * The mark: an S drawn as five note lanes. The bars are deliberately uneven,
 * the way real notes sit on a grid rather than lining up perfectly.
 */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="summus"
    >
      <defs>
        <linearGradient id="summus-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#f472b6" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="#0b0b13" />
      <g fill="url(#summus-mark)">
        <rect x="13" y="10" width="35" height="6" rx="3" />
        <rect x="13" y="19.5" width="10" height="6" rx="3" />
        <rect x="13" y="29" width="31" height="6" rx="3" />
        <rect x="34" y="38.5" width="17" height="6" rx="3" />
        <rect x="13" y="48" width="38" height="6" rx="3" />
      </g>
    </svg>
  )
}

export function Logo({
  size = 'md',
  withTagline = false,
  className,
}: {
  size?: 'sm' | 'md' | 'lg'
  withTagline?: boolean
  className?: string
}) {
  const mark = size === 'lg' ? 44 : size === 'md' ? 30 : 22
  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <LogoMark size={mark} />
      <div className="leading-none">
        <span
          className={clsx(
            'block bg-gradient-to-br from-accent to-hot bg-clip-text font-bold tracking-tight text-transparent',
            size === 'lg' && 'text-3xl',
            size === 'md' && 'text-xl',
            size === 'sm' && 'text-base',
          )}
        >
          summus
        </span>
        {withTagline && (
          <span className="mt-1 block text-[11px] text-ink-400">summen wird Musik</span>
        )}
      </div>
    </div>
  )
}
