import { createContext, useCallback, useContext, useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, CircleAlert, Eye, EyeOff, Info, LoaderCircle, X } from 'lucide-react'

const VARIANTS = {
  primary: 'bg-ink text-white hover:bg-ink-700',
  lime: 'bg-lime text-ink hover:brightness-95',
  outline: 'border border-ink/15 bg-white text-ink hover:border-ink/40',
  ghost: 'text-ink hover:bg-ink/5',
  soft: 'bg-cream text-ink hover:bg-cream-300',
  danger: 'bg-red-600 text-white hover:bg-red-700',
  dangerSoft: 'bg-red-50 text-red-700 hover:bg-red-100',
}
const SIZES = {
  sm: 'h-9 px-4 text-[13px] gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-13 px-7 text-[15px] gap-2',
  icon: 'size-10 justify-center',
}

export function Button({ variant = 'primary', size = 'md', to, href, arrow, loading, className = '', children, ...props }) {
  const cls = `inline-flex shrink-0 items-center justify-center rounded-full font-semibold whitespace-nowrap transition duration-200 disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className}`
  const content = (
    <>
      {loading && <LoaderCircle className="size-4 animate-spin" />}
      {children}
      {arrow && <ArrowUpRight className="size-4" />}
    </>
  )
  if (to) return <Link to={to} className={cls} {...props}>{content}</Link>
  if (href) return <a href={href} className={cls} {...props}>{content}</a>
  return (
    <button type="button" className={cls} disabled={loading || props.disabled} {...props}>
      {content}
    </button>
  )
}

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  )
}

export function Pill({ className = '', children }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full bg-lilac-100 px-3.5 py-1.5 text-[13px] font-semibold text-ink ${className}`}>{children}</span>
}

export function Badge({ tone = 'neutral', children }) {
  const tones = {
    neutral: 'bg-cream text-ink-600',
    green: 'bg-lime-200 text-ink',
    lime: 'bg-lime text-ink',
    red: 'bg-red-50 text-red-700',
    lilac: 'bg-lilac-100 text-ink',
    dark: 'bg-ink text-white',
  }
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>
}

/** The one switcher used for filters, categories and views. Scrolls sideways when it doesn't fit */
export function Tabs({ tabs, value, onChange, label }) {
  return (
    <div className="scrollbar-none flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-soft" role="group" aria-label={label}>
      {tabs.map((t) => (
        <button key={String(t.key)} type="button" aria-pressed={value === t.key} onClick={() => onChange(t.key)} className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition ${value === t.key ? 'bg-ink text-white' : 'text-ink-600 hover:text-ink'}`}>
          {t.icon && <t.icon className="size-4" />}
          {t.label}
          {t.count > 0 && <span className="opacity-60">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

/** The row of number tiles on top of a screen. Items are [label, value, classes] */
export function Stats({ items, loading = false }) {
  const cols = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' }[items.length] || 'lg:grid-cols-4'
  return (
    <div className={`grid grid-cols-2 gap-3 sm:gap-4 ${cols}`}>
      {items.map(([label, value, cls = 'bg-white']) => (
        <div key={label} className={`min-w-0 rounded-3xl p-4 shadow-soft sm:p-5 ${cls}`}>
          <p className={`truncate text-xs font-semibold ${cls.includes('text-white') ? 'text-white/60' : 'text-ink-500'}`}>{label}</p>
          <p className="mt-2 truncate font-display text-2xl font-bold sm:text-3xl">{loading ? '—' : value}</p>
        </div>
      ))}
    </div>
  )
}

/** Finds help for a field's label. Only the dashboard provides one, so public pages stay light */
export const FieldHelpContext = createContext(null)

function HelpRow({ tone, title, children }) {
  return (
    <div className={`rounded-2xl p-4 ${tone}`}>
      <p className="text-xs font-bold tracking-wide uppercase opacity-60">{title}</p>
      <p className="mt-1 text-sm leading-relaxed">{children}</p>
    </div>
  )
}

export function InfoButton({ label }) {
  const helpFor = useContext(FieldHelpContext)
  const [open, setOpen] = useState(false)
  const help = helpFor?.(label)
  if (!help) return null
  const name = label.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        className="inline-grid size-5 shrink-0 place-items-center rounded-full text-ink-400 hover:bg-cream hover:text-ink"
        aria-label={`How to use ${name}`}
      >
        <Info className="size-3.5" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={name}>
        <div className="grid gap-2.5">
          <HelpRow tone="bg-cream" title="What it is">{help.what}</HelpRow>
          <HelpRow tone="bg-lilac-100" title="How to use it">{help.how}</HelpRow>
          {help.good && <HelpRow tone="bg-lime-200" title="Good example">{help.good}</HelpRow>}
          {help.avoid && <HelpRow tone="bg-red-50" title="Avoid">{help.avoid}</HelpRow>}
        </div>
      </Modal>
    </>
  )
}

export function Field({ label, hint, error, children, className = '' }) {
  const id = useId()
  return (
    <div className={className}>
      {label && (
        <span className="mb-1.5 flex items-center gap-1">
          <label htmlFor={id} className="block text-sm font-medium text-ink-700">
            {label}
          </label>
          <InfoButton label={label} />
        </span>
      )}
      {typeof children === 'function' ? children(id) : children}
      {error ? <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : hint ? <p className="mt-1.5 text-xs text-ink-500">{hint}</p> : null}
    </div>
  )
}

export function Input({ label, hint, error, className = '', ...props }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id) => <input id={id} className="field" {...props} />}
    </Field>
  )
}

export function PasswordInput({ label, hint, error, className = '', ...props }) {
  const [show, setShow] = useState(false)
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id) => (
        <div className="relative">
          <input id={id} className="field pr-12" {...props} type={show ? 'text' : 'password'} />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute top-1/2 right-3 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-500 hover:bg-ink/5"
            aria-label={show ? 'Hide password' : 'Show password'}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      )}
    </Field>
  )
}

export function Textarea({ label, hint, error, className = '', ...props }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id) => <textarea id={id} className="field" {...props} />}
    </Field>
  )
}

export function Select({ label, hint, className = '', options, ...props }) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) => (
        <select id={id} className="field appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2315161A%22 stroke-width=%222.5%22><path d=%22M6 9l6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_1rem_center] bg-no-repeat pr-10" {...props}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

export function Toggle({ checked, onChange, label, description, disabled }) {
  return (
    <label className={`flex items-center justify-between gap-4 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="flex items-center gap-1 text-sm font-semibold">{label} <InfoButton label={label} /></span>}
          {description && <span className="block text-xs text-ink-500">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-ink' : 'bg-cream-300'}`}
      >
        <span className={`absolute top-1 size-5 rounded-full transition-all ${checked ? 'left-6 bg-lime' : 'left-1 bg-white shadow'}`} />
      </button>
    </label>
  )
}

export function Spinner({ className = '' }) {
  return <LoaderCircle className={`size-5 animate-spin text-ink-400 ${className}`} />
}

export function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Spinner className="size-7" />
    </div>
  )
}

export function Empty({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border-2 border-dashed border-ink/10 px-6 py-12 text-center">
      {Icon && (
        <span className="grid size-12 place-items-center rounded-full bg-lilac-100">
          <Icon className="size-5" />
        </span>
      )}
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-500">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, wide }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  // Portal: a parent with a transform or stacking context must never clip or cover the dialog
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <div className={`relative max-h-[92dvh] w-full animate-fade-up overflow-y-auto rounded-t-3xl bg-white p-5 shadow-lift sm:rounded-3xl sm:p-7 ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
          <button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-full bg-cream hover:bg-cream-300" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function Alert({ tone = 'error', children }) {
  const tones = { error: 'bg-red-50 text-red-700', info: 'bg-lilac-100 text-ink', success: 'bg-lime-200 text-ink' }
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium ${tones[tone]}`}>
      {tone === 'success' ? <Check className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function SectionTitle({ eyebrow, title, italic, children, className = '' }) {
  return (
    <div className={className}>
      {eyebrow && <p className="eyebrow text-ink-500">{eyebrow}</p>}
      <h2 className="display-lg mt-3">
        {title}
        {italic && (
          <>
            <br />
            <span className="display-italic">{italic}</span>
          </>
        )}
      </h2>
      {children && <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink-600">{children}</p>}
    </div>
  )
}

// ---------- Confirm and text dialogs ----------
let showDialog = null

/** Replaces window.confirm. Resolves true or false */
export function askConfirm({ title, message, confirmLabel = 'Confirm', danger = true }) {
  return new Promise((resolve) => (showDialog ? showDialog({ title, message, confirmLabel, danger, resolve }) : resolve(false)))
}

/** Replaces window.prompt. Resolves the typed text, or null when cancelled */
export function askText({ title, message, label, defaultValue = '', placeholder, confirmLabel = 'Save', danger = false }) {
  return new Promise((resolve) => (showDialog ? showDialog({ title, message, label, defaultValue, placeholder, confirmLabel, danger, text: true, resolve }) : resolve(null)))
}

function DialogHost() {
  const [dialog, setDialog] = useState(null)
  const [value, setValue] = useState('')
  useEffect(() => {
    showDialog = (d) => {
      setValue(d.defaultValue || '')
      setDialog(d)
    }
    return () => {
      showDialog = null
    }
  }, [])
  const finish = useCallback((result) => {
    setDialog((d) => {
      d?.resolve(result)
      return null
    })
  }, [])
  const cancel = useCallback(() => finish(dialog?.text ? null : false), [finish, dialog])
  if (!dialog) return null
  return (
    <Modal open onClose={cancel} title={dialog.title}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          finish(dialog.text ? value : true)
        }}
      >
        {dialog.message && <p className="text-sm leading-relaxed whitespace-pre-line text-ink-600">{dialog.message}</p>}
        {dialog.text && <div className="mt-4"><Input label={dialog.label} autoFocus placeholder={dialog.placeholder} value={value} onChange={(e) => setValue(e.target.value)} /></div>}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={cancel}>Cancel</Button>
          <Button type="submit" variant={dialog.danger ? 'dangerSoft' : undefined} autoFocus={!dialog.text}>{dialog.confirmLabel}</Button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- Toasts ----------
const ToastCtx = createContext(() => {})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const push = useCallback((message, tone = 'success') => {
    const id = Math.random()
    setToasts((t) => [...t, { id, message, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <DialogHost />
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[200] sm:bottom-4 flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex animate-fade-up items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-lift ${t.tone === 'error' ? 'bg-red-600 text-white' : 'bg-ink text-white'}`}>
            {t.tone === 'error' ? <CircleAlert className="size-4" /> : <Check className="size-4 text-lime" />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}
