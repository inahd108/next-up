import { LoaderCircle, type LucideIcon } from 'lucide-react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover shadow-sm',
  secondary: 'bg-fill text-fg ring-1 ring-inset ring-line-strong hover:bg-fill-strong',
  ghost: 'text-fg-muted hover:text-fg hover:bg-fill',
  danger: 'text-danger hover:bg-danger-soft'
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-9 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-xl'
}

const ICON_SIZES: Record<Size, number> = { sm: 15, md: 16, lg: 18 }

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: LucideIcon
  loading?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading ? (
        <LoaderCircle size={ICON_SIZES[size]} className="animate-spin" />
      ) : (
        Icon && <Icon size={ICON_SIZES[size]} strokeWidth={2} />
      )}
      {children}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  size?: 'sm' | 'md'
}

export function IconButton({ icon: Icon, label, size = 'md', className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-fill hover:text-fg',
        size === 'sm' ? 'h-8 w-8' : 'h-9 w-9',
        className
      )}
      {...rest}
    >
      <Icon size={size === 'sm' ? 15 : 17} />
    </button>
  )
}

type ChipTone = 'neutral' | 'accent' | 'good' | 'warn'

const CHIP_TONES: Record<ChipTone, string> = {
  neutral: 'bg-fill text-fg-muted',
  accent: 'bg-accent-soft text-accent-text',
  good: 'bg-good-soft text-good',
  warn: 'bg-warn-soft text-warn'
}

export function Chip({
  children,
  tone = 'neutral',
  icon: Icon,
  className
}: {
  children: ReactNode
  tone?: ChipTone
  icon?: LucideIcon
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap',
        CHIP_TONES[tone],
        className
      )}
    >
      {Icon && <Icon size={13} />}
      {children}
    </span>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-fill p-1">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'h-7 rounded-md px-3 text-[13px] font-medium transition-colors',
              active ? 'bg-raised text-fg shadow-card' : 'text-fg-muted hover:text-fg'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function Switch({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-fill-strong'
      )}
    >
      <span
        className={cx(
          'inline-block h-4.5 w-4.5 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[19px]' : 'translate-x-[3px]'
        )}
      />
    </button>
  )
}

export function TextInput({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'h-10 w-full rounded-lg bg-sunken px-3 text-sm text-fg ring-1 ring-line-strong outline-none ring-inset placeholder:text-fg-subtle focus:ring-2 focus:ring-accent',
        className
      )}
      {...rest}
    />
  )
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <LoaderCircle size={size} className={cx('animate-spin', className)} />
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-fill px-1.5 font-sans text-[11px] font-medium text-fg-subtle ring-1 ring-line ring-inset">
      {children}
    </kbd>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl bg-raised ring-1 ring-line', className)}>{children}</div>
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
      {action}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  children
}: {
  icon: LucideIcon
  title: string
  body: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-fill text-fg-muted">
        <Icon size={22} />
      </div>
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-fg-muted">{body}</p>
      {children && <div className="mt-5 flex items-center gap-2">{children}</div>}
    </div>
  )
}
