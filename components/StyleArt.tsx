'use client'

import type { Motif, Style } from '@/lib/audio/styles'

/**
 * A small piece of artwork per style, so a direction can be recognised at a
 * glance instead of read. Drawn inline so there are no image assets to load.
 */
export function StyleArt({ style, className }: { style: Style; className?: string }) {
  const [a, b] = style.colors
  const id = `art-${style.id}`
  return (
    <svg
      viewBox="0 0 120 72"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="presentation"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor={a} />
          <stop offset="100%" stopColor={b} />
        </linearGradient>
      </defs>
      <rect width="120" height="72" rx="8" fill={`url(#${id})`} />
      <Motifs motif={style.motif} />
    </svg>
  )
}

function Motifs({ motif }: { motif: Motif }) {
  const ink = 'rgba(7,7,12,0.55)'
  const light = 'rgba(255,255,255,0.75)'

  switch (motif) {
    case 'sun':
      return (
        <g>
          <circle cx="60" cy="40" r="22" fill={light} opacity="0.9" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x="30" y={38 + i * 7} width="60" height="3" fill={ink} />
          ))}
          <rect x="0" y="58" width="120" height="14" fill={ink} opacity="0.45" />
        </g>
      )
    case 'grid':
      return (
        <g stroke={light} strokeWidth="1.2" fill="none" opacity="0.85">
          <path d="M0 46 H120" />
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M${-30 + i * 45} 72 L${45 + i * 7.5} 46`} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <path key={i} d={`M0 ${50 + i * i * 2.2 + i * 3} H120`} />
          ))}
          <circle cx="60" cy="26" r="9" stroke={light} strokeWidth="2" />
        </g>
      )
    case 'disco':
      return (
        <g>
          <circle cx="60" cy="32" r="18" fill={light} opacity="0.9" />
          <g stroke={ink} strokeWidth="1.4">
            <path d="M42 32 H78 M60 14 V50 M47 19 L73 45 M73 19 L47 45" />
          </g>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={8 + i * 20} y="58" width="8" height={6 + (i % 3) * 6} fill={light} opacity="0.7" />
          ))}
        </g>
      )
    case 'bolt':
      return (
        <g>
          <path d="M66 8 L40 40 H56 L50 66 L82 30 H64 Z" fill={light} />
          <path d="M10 62 H110" stroke={ink} strokeWidth="4" />
        </g>
      )
    case 'arcs':
      return (
        <g fill="none" stroke={light} strokeWidth="2.4" opacity="0.9">
          <path d="M14 58 Q30 14 46 58" />
          <path d="M40 60 Q60 8 80 60" />
          <path d="M72 58 Q88 18 104 58" />
          <path d="M8 64 H112" stroke={ink} strokeWidth="3" />
        </g>
      )
    case 'film':
      return (
        <g>
          <rect x="8" y="14" width="104" height="44" rx="3" fill="none" stroke={light} strokeWidth="2" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <g key={i}>
              <rect x={13 + i * 17} y="18" width="7" height="5" fill={ink} />
              <rect x={13 + i * 17} y="49" width="7" height="5" fill={ink} />
            </g>
          ))}
          <path d="M50 28 L70 36 L50 44 Z" fill={light} />
        </g>
      )
    case 'waves':
      return (
        <g fill="none" stroke={light} strokeWidth="2.2" opacity="0.85">
          <path d="M0 28 Q15 16 30 28 T60 28 T90 28 T120 28" />
          <path d="M0 42 Q15 30 30 42 T60 42 T90 42 T120 42" />
          <path d="M0 56 Q15 44 30 56 T60 56 T90 56 T120 56" />
        </g>
      )
    case 'campfire':
      return (
        <g>
          <path d="M60 12 Q72 30 66 40 Q74 36 72 48 Q70 62 60 62 Q50 62 48 48 Q46 36 54 40 Q48 30 60 12 Z" fill={light} />
          <path d="M30 64 L90 56 M30 56 L90 64" stroke={ink} strokeWidth="4" strokeLinecap="round" />
        </g>
      )
    case 'sparkle':
      return (
        <g fill={light}>
          {[
            [60, 30, 14],
            [26, 20, 7],
            [94, 44, 8],
            [36, 54, 5],
          ].map(([x, y, r], i) => (
            <path
              key={i}
              d={`M${x} ${y - r} Q${x + r * 0.25} ${y - r * 0.25} ${x + r} ${y} Q${x + r * 0.25} ${y + r * 0.25} ${x} ${y + r} Q${x - r * 0.25} ${y + r * 0.25} ${x - r} ${y} Q${x - r * 0.25} ${y - r * 0.25} ${x} ${y - r} Z`}
            />
          ))}
        </g>
      )
    case 'horn':
      return (
        <g fill="none" stroke={light} strokeWidth="2.6" strokeLinecap="round">
          <path d="M34 52 V26 Q34 18 42 18 H62" />
          <path d="M62 10 L90 22 L62 34 Z" fill={light} stroke="none" />
          <circle cx="34" cy="56" r="7" fill={light} stroke="none" />
          <path d="M44 30 H58 M44 38 H58" />
        </g>
      )
    case 'pixel':
      return (
        <g fill={light}>
          {[
            [30, 22],
            [42, 22],
            [54, 22],
            [30, 34],
            [66, 34],
            [30, 46],
            [42, 46],
            [54, 46],
            [78, 22],
            [78, 46],
            [90, 34],
          ].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width="10" height="10" />
          ))}
        </g>
      )
    case 'bars':
      return (
        <g fill={light}>
          {[10, 26, 6, 34, 14, 30, 8, 22].map((h, i) => (
            <rect key={i} x={12 + i * 13} y={58 - h} width="8" height={h} rx="2" />
          ))}
          <rect x="0" y="60" width="120" height="12" fill={ink} opacity="0.4" />
        </g>
      )
    case 'leaf':
      return (
        <g>
          <path d="M60 62 C36 52 28 30 40 12 C62 16 76 34 72 56 Z" fill={light} opacity="0.9" />
          <path d="M40 12 C52 28 56 44 60 62" stroke={ink} strokeWidth="1.6" fill="none" />
          <path d="M6 64 H114" stroke={ink} strokeWidth="3" />
        </g>
      )
    case 'ring':
      return (
        <g fill="none" stroke={light} strokeWidth="1.6">
          {[10, 18, 26, 34].map((r, i) => (
            <circle key={i} cx="60" cy="36" r={r} opacity={1 - i * 0.2} />
          ))}
          <circle cx="60" cy="36" r="4" fill={light} stroke="none" />
        </g>
      )
    case 'crystal':
      return (
        <g>
          <path d="M60 8 L82 30 L60 64 L38 30 Z" fill={light} opacity="0.9" />
          <path d="M38 30 H82 M60 8 V64 M48 19 L72 41 M72 19 L48 41" stroke={ink} strokeWidth="1.4" fill="none" />
          <path d="M14 54 L18 46 L22 54 L18 62 Z" fill={light} opacity="0.6" />
          <path d="M98 50 L102 42 L106 50 L102 58 Z" fill={light} opacity="0.6" />
        </g>
      )
    case 'amp':
      return (
        <g>
          <rect x="16" y="10" width="88" height="52" rx="4" fill="none" stroke={light} strokeWidth="2.5" />
          <circle cx="48" cy="36" r="15" fill="none" stroke={light} strokeWidth="2" />
          <circle cx="48" cy="36" r="5" fill={light} />
          <rect x="72" y="18" width="26" height="5" rx="2.5" fill={ink} />
          <circle cx="78" cy="46" r="4" fill={light} />
          <circle cx="90" cy="46" r="4" fill={light} />
        </g>
      )
    case 'pulse':
      return (
        <g>
          <path
            d="M0 40 H22 L28 18 L36 62 L44 30 L50 48 L56 40 H74 L80 22 L88 56 L94 40 H120"
            fill="none"
            stroke={light}
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <rect x="0" y="62" width="120" height="10" fill={ink} opacity="0.4" />
        </g>
      )
    default:
      return null
  }
}
