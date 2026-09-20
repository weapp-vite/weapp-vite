import type { ReasonSheetOptions } from '../../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src/pages/order/components/reason-sheet/reasonSheet'
import { afterEach, describe, expect, it, vi } from 'vitest'
import reasonSheet from '../../../templates/weapp-vite-wevu-tailwindcss-tdesign-retail-template/src/pages/order/components/reason-sheet/reasonSheet'

describe('retail reason sheet component boundary', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the current page selector and preserves component method receivers', async () => {
    let handlers: { onConfirm?: (indexes: number[]) => void } = {}
    const instance = {
      bindHandlers(next: typeof handlers) {
        expect(this).toBe(instance)
        handlers = next
      },
      open(options: ReasonSheetOptions) {
        expect(this).toBe(instance)
        expect(options).toEqual({ title: '退款原因' })
        handlers.onConfirm?.([1, 2])
      },
    }
    const selectComponent = vi.fn(() => instance)
    vi.stubGlobal('getCurrentPages', () => [{ selectComponent }])

    await expect(reasonSheet({ title: '退款原因' })).resolves.toEqual([1, 2])
    expect(selectComponent).toHaveBeenCalledWith('#wr-reason-sheet')
  })

  it('rejects cancellation using an explicitly selected context', async () => {
    const selectComponent = vi.fn(() => ({
      bindHandlers(handlers: { onCancel?: () => void }) {
        handlers.onCancel?.()
      },
      open() {},
    }))

    await expect(reasonSheet({ context: { selectComponent }, selector: '#other' })).rejects.toThrow('cancel')
    expect(selectComponent).toHaveBeenCalledWith('#other')
  })

  it.each([
    null,
    {},
    { bindHandlers: true, open() {} },
    { bindHandlers() {}, open: true },
  ])('rejects missing or incompatible selected component %j', async (selected) => {
    vi.stubGlobal('getCurrentPages', () => [{ selectComponent: () => selected }])
    await expect(reasonSheet({})).rejects.toThrow('reason-sheet instance not found')
  })

  it('rejects when there is no current page', async () => {
    vi.stubGlobal('getCurrentPages', () => [])
    await expect(reasonSheet({})).rejects.toThrow('reason-sheet instance not found')
  })
})
