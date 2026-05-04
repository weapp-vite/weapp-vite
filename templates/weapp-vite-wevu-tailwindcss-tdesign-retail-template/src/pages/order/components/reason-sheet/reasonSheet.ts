import type { ReasonSheetOption } from './index.vue'

interface ReasonSheetContext {
  selectComponent?: (selector: string) => ReasonSheetInstance | null
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

function getInstance(context?: ReasonSheetContext | null, selector = '#wr-reason-sheet') {
  let nextContext = context
  if (!nextContext) {
    const pages = getCurrentPages()
    nextContext = (pages.at(-1) ?? null) as ReasonSheetContext | null
  }
  const instance = nextContext?.selectComponent?.(selector) ?? null
  return instance
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
