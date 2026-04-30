import { tv } from 'tailwind-variants'

export const surfaceStyles = tv({
  base: 'flex flex-col rounded-lg border shadow-(--dashboard-shadow)',
  variants: {
    tone: {
      default: 'border-(--dashboard-border) bg-(--dashboard-panel)',
      strong: 'border-(--dashboard-border-strong) bg-(--dashboard-panel-strong)',
      muted: 'border-(--dashboard-border) bg-(--dashboard-panel-muted)',
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
  base: 'flex items-center justify-center rounded-md bg-(--dashboard-accent-soft) text-(--dashboard-accent)',
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

export const mutedPanelStyles = tv({
  base: 'rounded-md border border-(--dashboard-border) bg-(--dashboard-panel-muted)',
  variants: {
    padding: {
      sm: 'px-4 py-3',
      md: 'p-4',
    },
    interactive: {
      true: 'transition hover:border-(--dashboard-border-strong) hover:bg-(--dashboard-panel)',
      false: '',
    },
  },
  defaultVariants: {
    padding: 'md',
    interactive: false,
  },
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
      true: 'border-(--dashboard-accent) bg-(--dashboard-accent-soft) text-(--dashboard-text)',
      false: 'border-(--dashboard-border) bg-(--dashboard-panel-muted) text-(--dashboard-text-soft) hover:border-(--dashboard-border-strong) hover:text-(--dashboard-text)',
    },
  },
  defaultVariants: {
    kind: 'nav',
    active: false,
  },
})

export const runtimeBadgeStyles = tv({
  base: 'rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em]',
  variants: {
    tone: {
      neutral: 'border-(--dashboard-border) bg-(--dashboard-panel-muted) text-(--dashboard-text-soft)',
      info: 'border-(--dashboard-border-strong) bg-(--dashboard-accent-soft) text-(--dashboard-accent)',
      success: 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/12 dark:text-emerald-300',
      warning: 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/12 dark:text-amber-300',
      error: 'border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/12 dark:text-rose-300',
    },
  },
  defaultVariants: {
    tone: 'neutral',
  },
})

export const sectionNoteStyles = tv({
  base: 'rounded-lg border border-(--dashboard-border) bg-(--dashboard-panel) px-4 py-3 text-[11px] uppercase tracking-[0.24em] text-(--dashboard-text-soft) shadow-(--dashboard-shadow)',
})
