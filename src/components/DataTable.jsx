import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, LayoutGrid, Table2 } from 'lucide-react'
import { Tabs } from './ui'

function savedView(key) {
  try {
    return localStorage.getItem(`${key}-view`)
  } catch {
    return null
  }
}

/** Remembers how someone likes to see a list. 'auto' means a table on big screens, cards on phones */
export function useViewMode(key, fallback = 'cards') {
  const [view, setView] = useState(() => savedView(key) || (fallback === 'auto' ? (window.matchMedia('(min-width: 768px)').matches ? 'table' : 'cards') : fallback))
  const pick = (next) => {
    setView(next)
    try {
      localStorage.setItem(`${key}-view`, next)
    } catch {
      /* ignore */
    }
  }
  return [view, pick]
}

const DEFAULT_VIEWS = [{ key: 'cards', label: 'Cards', icon: LayoutGrid }, { key: 'table', label: 'Table', icon: Table2 }]

export function ViewToggle({ value, onChange, views = DEFAULT_VIEWS }) {
  return <Tabs label="View" tabs={views} value={value} onChange={onChange} />
}

const lower = (v) => (typeof v === 'string' ? v.toLowerCase() : v)
const isEmpty = (v) => v == null || v === ''

function compare(a, b) {
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b, 'en-IN', { numeric: true })
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * A table whose column headers sort on click. Each column:
 * { key, label, value: (row) => what to sort by, render: (row) => what to show, align, className }
 * A column with no `value` isn't sortable, which suits action buttons.
 */
export function DataTable({ columns, rows, rowKey = (r) => r.id, defaultSort = null, onRowClick, minWidth, bare = false }) {
  const [sort, setSort] = useState(defaultSort)
  const sorted = useMemo(() => {
    const column = sort && columns.find((c) => c.key === sort.key)
    if (!column?.value) return rows
    return [...rows].sort((x, y) => {
      const a = lower(column.value(x))
      const b = lower(column.value(y))
      // Empty values stay at the bottom whichever way it's sorted
      if (isEmpty(a) || isEmpty(b)) return isEmpty(a) ? (isEmpty(b) ? 0 : 1) : -1
      return compare(a, b) * sort.dir
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- columns are rebuilt every render
  }, [rows, sort])
  const Arrow = sort?.dir === -1 ? ArrowDown : ArrowUp

  return (
    <div className={`overflow-x-auto ${bare ? '' : 'card'}`}>
      <table className="w-full text-left text-sm" style={{ minWidth: minWidth ?? columns.length * 130 }}>
        <thead>
          <tr className="border-b border-ink/5 text-xs text-ink-500">
            {columns.map((c, i) => {
              const active = sort?.key === c.key
              const right = c.align === 'right'
              return (
                <th key={c.key} scope="col" aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : c.value ? 'none' : undefined} className={`p-0 font-semibold whitespace-nowrap ${i === 0 ? 'sticky left-0 z-10 bg-white' : ''}`}>
                  {c.value ? (
                    <button type="button" onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key ? -s.dir : 1 }))} className={`flex w-full items-center gap-1 px-4 py-3 hover:text-ink ${right ? 'justify-end' : ''} ${active ? 'text-ink' : ''}`}>
                      {c.label}
                      {active ? <Arrow className="size-3 shrink-0" /> : <ChevronsUpDown className="size-3 shrink-0 opacity-40" />}
                    </button>
                  ) : (
                    <span className={`block px-4 py-3 ${right ? 'text-right' : ''}`}>{c.label}</span>
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? (e) => !e.target.closest('a, button, select, input, label') && onRowClick(row) : undefined}
              className={`group border-b border-ink/5 last:border-0 ${onRowClick ? 'cursor-pointer' : ''}`}
            >
              {columns.map((c, i) => (
                <td key={c.key} className={`px-4 py-3 group-hover:bg-cream ${c.align === 'right' ? 'text-right' : ''} ${i === 0 ? 'sticky left-0 max-w-56 bg-white font-semibold' : ''} ${c.className || ''}`}>
                  {c.render ? c.render(row) : (c.value(row) ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
