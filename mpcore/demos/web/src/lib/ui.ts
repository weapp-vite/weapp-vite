import { tv } from 'tailwind-variants'

export const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sim-muted)]'
export const mutedTextClass = 'text-[12px] leading-6 text-[color:var(--sim-muted)]'
export const chipWrapClass = 'flex flex-wrap gap-2'
export const actionBlockClass = 'grid gap-2'
export const codeFrameClass = 'overflow-auto rounded-2xl border border-[color:var(--sim-border)] bg-[color:var(--sim-code-bg)]'

export const sectionCard = tv({
  slots: {
    base: 'grid min-h-0 gap-3 text-[color:var(--sim-text)]',
    header: 'grid gap-1',
    title: 'm-0 text-[17px] font-semibold tracking-tight text-[color:var(--sim-text)]',
    subtitle: labelClass,
    body: 'grid min-h-0 gap-3',
  },
  variants: {
    tone: {
      embedded: {
        header: 'border-b border-[color:var(--sim-divider)] pb-3',
      },
      standalone: {
        base: 'rounded-[24px] border border-[color:var(--sim-border)] bg-[color:var(--sim-panel)] p-4 shadow-[var(--sim-shadow)] backdrop-blur-xl',
      },
    },
  },
  defaultVariants: {
    tone: 'embedded',
  },
})

export const toolbarSurface = tv({
  base: 'flex flex-col gap-3 rounded-[20px] border border-[color:var(--sim-border)] bg-[color:var(--sim-toolbar-bg)] px-4 py-3 shadow-[var(--sim-shadow)] backdrop-blur-xl xl:flex-row xl:items-start xl:justify-between',
})

export const panelSurface = tv({
  slots: {
    base: 'grid min-h-0 overflow-hidden rounded-[24px] border border-[color:var(--sim-border)] bg-[color:var(--sim-panel-soft)] shadow-[var(--sim-shadow)]',
    bar: 'flex overflow-x-auto border-b border-[color:var(--sim-divider)] bg-[color:var(--sim-panel-strong)] px-2',
    body: 'min-h-0 overflow-auto p-4',
  },
})

export const pill = tv({
  base: 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors duration-150',
  variants: {
    tone: {
      neutral: 'border-[color:var(--sim-border)] bg-[color:var(--sim-pill-bg)] text-[color:var(--sim-muted)] hover:bg-[color:var(--sim-pill-hover)] hover:text-[color:var(--sim-text)]',
      accent: 'border-[color:var(--sim-accent-border)] bg-[color:var(--sim-accent-soft)] text-[color:var(--sim-accent-strong)]',
      subtle: 'border-[color:var(--sim-border)] bg-transparent text-[color:var(--sim-text)]',
    },
    interactive: {
      true: 'cursor-pointer',
      false: 'cursor-default',
    },
  },
  defaultVariants: {
    tone: 'neutral',
    interactive: true,
  },
})

export const tabButton = tv({
  base: 'relative shrink-0 border-r border-[color:var(--sim-divider)] px-4 py-2.5 text-[12px] font-medium tracking-[0.04em] transition-colors duration-150 first:border-l',
  variants: {
    active: {
      true: 'bg-[color:var(--sim-tab-active)] text-[color:var(--sim-text)] after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-[image:linear-gradient(90deg,#7cb6ff,var(--sim-accent))]',
      false: 'text-[color:var(--sim-muted)] hover:bg-[color:var(--sim-tab-hover)] hover:text-[color:var(--sim-text)]',
    },
  },
  defaultVariants: {
    active: false,
  },
})

export const sceneButton = tv({
  base: 'grid min-w-[220px] gap-2 rounded-[18px] border px-4 py-3 text-left transition-colors duration-150 md:w-[calc(50%_-_4px)]',
  variants: {
    active: {
      true: 'border-[color:var(--sim-accent-border)] bg-[color:var(--sim-accent-soft)] text-[color:var(--sim-text)] shadow-[inset_0_0_0_1px_var(--sim-accent-border)]',
      false: 'border-[color:var(--sim-border)] bg-[color:var(--sim-pill-bg)] text-[color:var(--sim-text)] hover:bg-[color:var(--sim-pill-hover)]',
    },
  },
  defaultVariants: {
    active: false,
  },
})

export const dropzoneCard = tv({
  base: 'relative grid gap-1 rounded-[18px] border border-dashed border-[color:var(--sim-border-strong)] bg-[color:var(--sim-pill-bg)] px-4 py-3 transition-colors duration-150 hover:bg-[color:var(--sim-pill-hover)]',
})

export const alertCard = tv({
  base: 'rounded-[20px] border border-[color:var(--sim-danger-border)] bg-[color:var(--sim-danger-bg)] px-4 py-3 text-[color:var(--sim-danger-text)] shadow-[var(--sim-shadow)]',
})
