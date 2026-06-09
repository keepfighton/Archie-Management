import { ReactNode, useState, useEffect } from 'react'
import { formatNumber, parseNumber } from '@/utils/format'
import { X, Search, ChevronLeft, ChevronRight, Inbox, Building2, Globe, Home } from 'lucide-react'
import clsx from 'clsx'

// ─── ClockIn Helpers ─────────────────────────────────
export type WorkMode = 'WFO' | 'WFA' | 'WFH'

export const WORK_MODE_CONFIG: Record<WorkMode, { label: string; icon: typeof Building2; color: string; desc: string }> = {
  WFO: { label: 'WFO', icon: Building2, color: 'bg-blue-100 text-blue-700',    desc: 'Work From Office — lokasi dicek dalam radius 3 KM dari kantor' },
  WFA: { label: 'WFA', icon: Globe,     color: 'bg-purple-100 text-purple-700', desc: 'Work From Anywhere — absen dari mana saja' },
  WFH: { label: 'WFH', icon: Home,      color: 'bg-green-100 text-green-700',   desc: 'Work From Home — absen dari rumah' },
}

export function getLocationWithFallback(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Browser tidak mendukung geolocation')); return }
    navigator.geolocation.getCurrentPosition(resolve,
      () => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false, timeout: 15000, maximumAge: 60000,
        })
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    )
  })
}

interface ClockInModalProps {
  open: boolean
  onClose: () => void
  onConfirm: (mode: WorkMode) => void
}
export function ClockInModal({ open, onClose, onConfirm }: ClockInModalProps) {
  const [selected, setSelected] = useState<WorkMode | null>(null)

  useEffect(() => { if (open) setSelected(null) }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-1">Pilih Mode Kerja</h3>
        <p className="text-xs text-gray-400 mb-4">Pilih mode absen hari ini sebelum clock in</p>
        <div className="space-y-2 mb-5">
          {(Object.keys(WORK_MODE_CONFIG) as WorkMode[]).map(mode => {
            const cfg = WORK_MODE_CONFIG[mode]
            const Icon = cfg.icon
            return (
              <button key={mode} onClick={() => setSelected(mode)}
                className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all
                  ${selected === mode ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className={`mt-0.5 p-1.5 rounded-lg ${cfg.color}`}><Icon size={14} /></div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">{cfg.label}</p>
                  <p className="text-xs text-gray-400">{cfg.desc}</p>
                </div>
              </button>
            )
          })}
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary flex-1" onClick={onClose}>Batal</button>
          <button className="btn btn-primary flex-1" disabled={!selected} onClick={() => selected && onConfirm(selected)}>Clock In</button>
        </div>
      </div>
    </div>
  )
}

export const DEFAULT_PAGE_LIMIT = 30

export function rowNumber(page: number, index: number, limit = DEFAULT_PAGE_LIMIT) {
  return (page - 1) * limit + index + 1
}

// ─── Modal ───────────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}
export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return

    const { body } = document
    const previousOverflow = body.style.overflow

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-6xl' }
  const titleId = `modal-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={clsx('modal', widths[size])}
      >
        <div className="modal-header">
          <span id={titleId} className="font-semibold text-sm text-gray-900">{title}</span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

// ─── SearchInput ─────────────────────────────────────
interface SearchInputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}
export function SearchInput({ value, onChange, placeholder = 'Search...', className }: SearchInputProps) {
  return (
    <div className={clsx('relative w-full sm:w-auto', className)}>
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input input-sm h-10 w-full pl-9 sm:w-48 md:w-56"
      />
    </div>
  )
}

// ─── PageHeader ──────────────────────────────────────
interface PageHeaderProps {
  title: string
  actions?: ReactNode
}
export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <h1 className="page-title">{title}</h1>
      {actions && <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>}
    </div>
  )
}

// ─── Toolbar ─────────────────────────────────────────
interface ToolbarProps {
  left?: ReactNode
  right?: ReactNode
}
export function Toolbar({ left, right }: ToolbarProps) {
  return (
    <div className="mb-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap items-center gap-2">{left}</div>
      <div className="flex flex-wrap items-center gap-2 xl:justify-end">{right}</div>
    </div>
  )
}

// ─── Pagination ──────────────────────────────────────
interface PaginationProps {
  page: number
  total: number
  limit: number
  onChange: (page: number) => void
}
export function Pagination({ page, total, limit, onChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const start = (page - 1) * limit + 1
  const end = Math.min(page * limit, total)
  const visiblePages = Array.from(
    { length: Math.min(totalPages, 5) },
    (_, index) => {
      const offset = Math.min(Math.max(page - 3, 0), Math.max(totalPages - 5, 0))
      return offset + index + 1
    }
  )

  return (
    <div className="pagination">
      <span className="min-w-0 truncate">
        {total > 0 ? `${start}-${end} of ${total}` : '0 results'}
      </span>
      <div className="flex items-center gap-1">
        <button
          className="page-btn"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={12} />
        </button>
        {visiblePages.map(p => (
          <button
            key={p}
            className={clsx('page-btn', p === page && 'active')}
            onClick={() => onChange(p)}
          >
            {p}
          </button>
        ))}
        <button
          className="page-btn"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  )
}

// ─── StatusBadge ─────────────────────────────────────
const statusColors: Record<string, string> = {
  open: 'badge-blue',
  completed: 'badge-green',
  hold: 'badge-orange',
  cancelled: 'badge-red',
  todo: 'badge-orange',
  in_progress: 'badge-blue',
  done: 'badge-green',
  expired: 'badge-red',
  draft: 'badge-gray',
  not_paid: 'badge-orange',
  partially_paid: 'badge-yellow',
  fully_paid: 'badge-green',
  overdue: 'badge-red',
  won: 'badge-green',
  lost: 'badge-red',
  discussion: 'badge-blue',
  new: 'badge-gray',
  negotiation: 'badge-yellow',
  qualified: 'badge-purple',
  pending: 'badge-orange',
  approved: 'badge-green',
  rejected: 'badge-red',
}

export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  return <span className={clsx('badge', statusColors[status] || 'badge-gray')}>{label}</span>
}

// ─── Loading ─────────────────────────────────────────
export function Loading() {
  return (
    <div className="flex min-h-[12rem] flex-col items-center justify-center gap-3 text-center">
      <div className="h-9 w-9 rounded-full border-[3px] border-primary/20 border-t-primary animate-spin" />
      <div>
        <p className="text-sm font-medium text-gray-700">Loading content</p>
        <p className="text-xs text-gray-400">Please wait a moment…</p>
      </div>
    </div>
  )
}

// ─── EmptyState ──────────────────────────────────────
export function EmptyState({ message = 'No record found.' }: { message?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <Inbox size={18} />
      </div>
      <div className="space-y-1">
        <p className="font-medium text-gray-700">Nothing to show yet</p>
        <p>{message}</p>
      </div>
    </div>
  )
}

// ─── ConfirmDialog ───────────────────────────────────
interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message?: string
}
export function ConfirmDialog({ open, onClose, onConfirm, title = 'Confirm Delete', message = 'Are you sure you want to delete this item?' }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { onConfirm(); onClose() }}>Delete</button>
        </>
      }
    >
      <p className="text-sm text-gray-600">{message}</p>
    </Modal>
  )
}

// ─── FormField ───────────────────────────────────────
interface FormFieldProps {
  label: string
  required?: boolean
  children: ReactNode
  error?: string
  hint?: string
}
export function FormField({ label, required, children, error, hint }: FormFieldProps) {
  return (
    <div className="mb-3">
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-blue-500 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ─── Avatar ──────────────────────────────────────────
export function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'md' }) {
  const initials = name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const sizes = { sm: 'w-6 h-6 text-[9px]', md: 'w-8 h-8 text-xs' }
  return (
    <div className={clsx('rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-semibold flex-shrink-0', sizes[size])}>
      {initials}
    </div>
  )
}

// ─── ProgressBar ─────────────────────────────────────
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={clsx('progress-bar', className)}>
      <div className="progress-fill" style={{ width: `${Math.min(value, 100)}%` }} />
    </div>
  )
}

// ─── ViewTabs ────────────────────────────────────────
interface ViewTabsProps {
  tabs: { key: string; label: string }[]
  active: string
  onChange: (key: string) => void
}
export function ViewTabs({ tabs, active, onChange }: ViewTabsProps) {
  return (
    <div className="mb-4 overflow-x-auto border-b border-gray-200">
      <div className="flex min-w-max">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={clsx('view-tab', active === tab.key && 'active')}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── PriceInput ──────────────────────────────────────
interface PriceInputProps {
  value: number | string
  onChange: (num: number) => void
  placeholder?: string
  className?: string
}
export function PriceInput({ value, onChange, placeholder = '0', className }: PriceInputProps) {
  const [display, setDisplay] = useState(value !== 0 && value !== '' ? formatNumber(Number(value)) : '')

  useEffect(() => {
    setDisplay(value !== 0 && value !== '' ? formatNumber(Number(value)) : '')
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d,]/g, '')
    setDisplay(raw)
    onChange(parseNumber(raw))
  }

  const handleBlur = () => {
    const num = parseNumber(display)
    setDisplay(num > 0 ? formatNumber(num) : '')
    onChange(num)
  }

  return (
    <input
      className={className ?? 'input'}
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      inputMode="numeric"
    />
  )
}
