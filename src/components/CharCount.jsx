/** "12 / 80", shown under a field. Turns amber near the limit and red at it. Pass the text (value) or just its length. */
export function CharCount({ value, length, max, className = '' }) {
  const n = length ?? String(value ?? '').length
  const tone = n >= max ? 'text-red-600' : n >= max * 0.9 ? 'text-amber-600' : 'text-ink-400'
  return <span className={`shrink-0 text-xs tabular-nums ${tone} ${className}`} aria-live="off">{n} / {max}</span>
}
