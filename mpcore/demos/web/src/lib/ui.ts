import { tv } from 'tailwind-variants'

export const labelClass = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-(--sim-muted)'
export const mutedTextClass = 'text-[12px] leading-6 text-(--sim-muted)'
export const chipWrapClass = 'flex flex-wrap gap-2'
export const actionBlockClass = 'grid gap-2'
export const codeFrameClass = 'overflow-auto rounded-2xl border border-(--sim-border) bg-(--sim-code-bg)'

export const sectionCard = tv({
  slots: {
    base: 'grid min-h-0 gap-3 text-(--sim-text)',
    header: 'grid gap-1',
    title: 'm-0 text-[17px] font-semibold tracking-tight text-(--sim-text)',
    subtitle: labelClass,
    body: 'grid min-h-0 content-start gap-3',
  },
  variants: {
    tone: {
      embedded: {
        header: 'border-b border-(--sim-divider) pb-3',
      },
      standalone: {
        base: 'rounded-4.5 border border-(--sim-border) bg-(--sim-panel) p-3 shadow-(--sim-shadow)',
      },
    },
  },
  defaultVariants: {
    tone: 'embedded',
  },
})

export const toolbarSurface = tv({
  base: 'flex flex-col gap-2 border-b border-(--sim-divider) bg-(--sim-toolbar-bg) px-4 py-2.5 xl:flex-row xl:items-center xl:justify-between',
})

export const panelSurface = tv({
  slots: {
    base: 'grid min-h-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden border border-(--sim-border) bg-(--sim-panel-soft)',
    bar: 'flex overflow-x-auto border-b border-(--sim-divider) bg-(--sim-panel-strong) px-2',
    body: 'grid min-h-0 content-start overflow-auto p-3',
  },
})

export const pill = tv({
  base: 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors duration-150',
  variants: {
    tone: {
      neutral: 'border-(--sim-border) bg-(--sim-pill-bg) text-(--sim-muted) hover:bg-(--sim-pill-hover) hover:text-(--sim-text)',
      accent: 'border-(--sim-accent-border) bg-(--sim-accent-soft) text-(--sim-accent-strong)',
      subtle: 'border-(--sim-border) bg-transparent text-(--sim-text)',
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
  base: 'relative shrink-0 border-r border-(--sim-divider) px-4 py-2.5 text-[12px] font-medium tracking-[0.04em] transition-colors duration-150 first:border-l',
  variants: {
    active: {
      true: 'bg-(--sim-tab-active) text-(--sim-text) after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-[image:linear-gradient(90deg,#7cb6ff,var(--sim-accent))]',
      false: 'text-(--sim-muted) hover:bg-(--sim-tab-hover) hover:text-(--sim-text)',
    },
  },
  defaultVariants: {
    active: false,
  },
})

export const sceneButton = tv({
  base: 'grid min-w-55 gap-2 rounded-4.5 border px-4 py-3 text-left transition-colors duration-150 md:w-[calc(50%_-_4px)]',
  variants: {
    active: {
      true: 'border-(--sim-accent-border) bg-(--sim-accent-soft) text-(--sim-text) shadow-[inset_0_0_0_1px_var(--sim-accent-border)]',
      false: 'border-(--sim-border) bg-(--sim-pill-bg) text-(--sim-text) hover:bg-(--sim-pill-hover)',
    },
  },
  defaultVariants: {
    active: false,
  },
})

export const dropzoneCard = tv({
  base: 'relative grid gap-1 rounded-3 border border-dashed border-(--sim-border-strong) bg-(--sim-pill-bg) px-4 py-3 transition-colors duration-150 hover:bg-(--sim-pill-hover)',
})

export const alertCard = tv({
  base: 'rounded-5 border border-(--sim-danger-border) bg-(--sim-danger-bg) px-4 py-3 text-(--sim-danger-text) shadow-(--sim-shadow)',
})
