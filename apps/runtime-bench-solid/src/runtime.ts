import type { Accessor } from 'solid-js'
import { createRenderEffect, createRoot } from 'solid-js/dist/solid.js'

export interface SolidMiniProgramRoot {
  dispose: () => void
  flush: () => Promise<void>
  mount: (bindings: Record<string, Accessor<unknown>>) => void
}

export function createSolidMiniProgramRoot(adapter: {
  setData: (payload: Record<string, unknown>, callback?: () => void) => void
}): SolidMiniProgramRoot {
  let disposeOwner: (() => void) | undefined
  let disposed = false
  let scheduled = false
  let pending: Record<string, unknown> = {}
  let pendingFlush = Promise.resolve()

  function schedule(name: string, value: unknown) {
    if (disposed) {
      return
    }
    pending[name] = value
    if (scheduled) {
      return
    }
    scheduled = true
    pendingFlush = new Promise<void>((resolve) => {
      Promise.resolve().then(() => {
        scheduled = false
        const payload = pending
        pending = {}
        if (disposed || Object.keys(payload).length === 0) {
          resolve()
          return
        }
        adapter.setData(payload, resolve)
      })
    })
  }

  return {
    dispose() {
      disposed = true
      pending = {}
      disposeOwner?.()
      disposeOwner = undefined
    },
    flush() {
      return pendingFlush
    },
    mount(bindings) {
      if (disposeOwner) {
        throw new Error('Solid mini-program root 只能 mount 一次')
      }
      const initial: Record<string, unknown> = {}
      let mounting = true
      disposeOwner = createRoot((dispose) => {
        for (const [name, read] of Object.entries(bindings)) {
          createRenderEffect(() => {
            const value = read()
            if (mounting) {
              initial[name] = value
            }
            else {
              schedule(name, value)
            }
          })
        }
        mounting = false
        return dispose
      })
      adapter.setData(initial)
    },
  }
}
