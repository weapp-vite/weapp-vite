import type { ReasonSheetOption } from './types'

interface ReasonSheetContext {
  selectComponent?: (selector: string) => unknown
}

interface ReasonSheetInstance {
  bindHandlers: (handlers: {
    onCancel?: (reason?: unknown) => void
    onConfirm?: (indexes: number[]) => void
  }) => void
  open: (options: Omit<ReasonSheetOptions, 'context' | 'selector'>) => void
}

export interface ReasonSheetOptions {
  context?: ReasonSheetContext | null
  selector?: string
  show?: boolean
  title?: string
  options?: ReasonSheetOption[]
  multiple?: boolean
  showConfirmButton?: boolean
  showCancelButton?: boolean
  showCloseButton?: boolean
  confirmButtonText?: string
  cancelButtonText?: string
  emptyTip?: string
}

function isReasonSheetInstance(value: unknown): value is ReasonSheetInstance {
  return typeof value === 'object'
    && value !== null
    && 'bindHandlers' in value
    && typeof value.bindHandlers === 'function'
    && 'open' in value
    && typeof value.open === 'function'
}

function getInstance(context?: ReasonSheetContext | null, selector = '#wr-reason-sheet') {
  let nextContext = context
  if (!nextContext) {
    const pages = getCurrentPages()
    nextContext = pages[pages.length - 1] ?? null
  }
  const instance = nextContext?.selectComponent?.(selector) ?? null
  return isReasonSheetInstance(instance) ? instance : null
}

export default function reasonSheet(options: ReasonSheetOptions) {
  const { context, selector, ..._options } = options
  return new Promise<number[]>((resolve, reject) => {
    const instance = getInstance(context, selector)
    if (instance) {
      instance.bindHandlers({
        onCancel: () => reject(new Error('cancel')),
        onConfirm: indexes => resolve(indexes),
      })
      instance.open({
        ..._options,
      })
    }
    else {
      reject(new Error('reason-sheet instance not found'))
    }
  })
}
