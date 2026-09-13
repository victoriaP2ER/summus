'use client'

import { clsx } from './clsx'
import type { ReactNode } from 'react'

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={clsx('panel rounded-xl', className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-ink-700 px-3 py-2">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-0.5 truncate text-[11px] text-ink-400">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-3">{children}</div>
    </section>
  )
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  size = 'md',
  active = false,
  disabled = false,
  title,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'ghost' | 'solid' | 'accent' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  active?: boolean
  disabled?: boolean
  title?: string
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        size === 'sm' && 'px-2 py-1 text-[11px]',
        size === 'md' && 'px-3 py-1.5 text-xs',
        size === 'lg' && 'px-4 py-2 text-sm',
        variant === 'ghost' &&
          !active &&
          'border border-ink-600 bg-ink-800 text-ink-200 hover:border-ink-500 hover:bg-ink-700',
        variant === 'ghost' && active && 'border border-accent bg-accent/15 text-accent',
        variant === 'solid' && 'bg-ink-700 text-ink-100 hover:bg-ink-600',
        variant === 'accent' &&
          'bg-gradient-to-b from-accent to-accent-strong text-ink-950 shadow-lg shadow-accent/20 hover:brightness-110',
        variant === 'danger' && 'border border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
          {label}
        </span>
        {hint && <span className="font-mono text-[10px] text-ink-300">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <select
      value={value}
      onChange={(e) => {
        const raw = e.target.value
        const match = options.find((o) => String(o.value) === raw)
        if (match) onChange(match.value)
      }}
      className={clsx(
        'w-full rounded-lg border border-ink-600 bg-ink-800 px-2 py-1.5 text-xs text-ink-100',
        'focus:border-accent focus:outline-none',
        className,
      )}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  className,
}: {
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  className?: string
}) {
  return (
    <input
      type="range"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(Number(e.target.value))}
      className={clsx('w-full cursor-pointer', className)}
    />
  )
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-3 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1.5 text-xs text-ink-200 hover:border-ink-500"
    >
      <span>{label}</span>
      <span
        className={clsx(
          'relative h-4 w-7 shrink-0 rounded-full transition-colors',
          checked ? 'bg-accent' : 'bg-ink-600',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-3 w-3 rounded-full bg-ink-950 transition-transform',
            checked ? 'translate-x-3.5' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  )
}

export function Meter({ level }: { level: number }) {
  const pct = Math.min(100, level * 140)
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-800">
      <div
        className="h-full rounded-full transition-[width] duration-75"
        style={{
          width: `${pct}%`,
          background:
            pct > 88
              ? 'linear-gradient(90deg,#34d399,#fbbf24,#f43f5e)'
              : 'linear-gradient(90deg,#34d399,#a855f7)',
        }}
      />
    </div>
  )
}
