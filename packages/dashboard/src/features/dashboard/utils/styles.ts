import { tv } from 'tailwind-variants'

export const surfaceStyles = tv({
  base: 'rounded-[20px] border shadow-[var(--dashboard-shadow)]',
  variants: {
    tone: {
      default: 'border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel)]',
      strong: 'border-[color:var(--dashboard-border-strong)] bg-[color:var(--dashboard-panel-strong)]',
      muted: 'border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)]',
    },
    padding: {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      header: 'px-4 py-4 md:px-5',
    },
  },
  defaultVariants: {
    tone: 'default',
    padding: 'md',
  },
})

export const iconFrameStyles = tv({
  base: 'flex items-center justify-center rounded-xl bg-[color:var(--dashboard-accent-soft)] text-[color:var(--dashboard-accent)]',
  variants: {
    size: {
      sm: 'h-8 w-8',
      md: 'h-9 w-9',
      lg: 'h-10 w-10',
    },
  },
  defaultVariants: {
    size: 'md',
  },
})

export const metricCardStyles = tv({
  base: 'rounded-xl border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] px-4 py-3',
})

export const pillButtonStyles = tv({
  base: 'inline-flex items-center gap-2 rounded-full border transition',
  variants: {
    kind: {
      nav: 'px-3.5 py-1.5 text-sm',
      theme: 'px-3 py-1.5 text-xs font-medium',
      badge: 'px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]',
    },
    active: {
      true: 'border-[color:var(--dashboard-accent)] bg-[color:var(--dashboard-accent-soft)] text-[color:var(--dashboard-text)]',
      false: 'border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel-muted)] text-[color:var(--dashboard-text-soft)] hover:border-[color:var(--dashboard-border-strong)] hover:text-[color:var(--dashboard-text)]',
    },
  },
  defaultVariants: {
    kind: 'nav',
    active: false,
  },
})

export const sectionNoteStyles = tv({
  base: 'rounded-[20px] border border-[color:var(--dashboard-border)] bg-[color:var(--dashboard-panel)] px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-[color:var(--dashboard-text-soft)] shadow-[var(--dashboard-shadow)]',
})
