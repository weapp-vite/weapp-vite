import { describe, expect, it, vi } from 'vitest'
import { runDialogSteps } from '../ide/githubIssuesDom/dialogs'

describe('dialog step snapshots', () => {
  it('reads the snapshot after the asynchronous tap has reached the DOM checkpoint', async () => {
    let state = 'idle'
    let eventHandled = Promise.resolve()
    const tap = vi.fn(async () => {
      eventHandled = new Promise<void>((resolve) => {
        setTimeout(() => {
          state = 'opening'
          resolve()
        }, 0)
      })
    })
    const page = { $$: vi.fn(async () => [{ tap }]) }
    const call = vi.fn(async () => ({ state }))
    const check = vi.fn(async () => {
      await eventHandled
      expect(state).toBe('opening')
    })

    const snapshots = await runDialogSteps(page, [
      { id: 'opened', method: '_runE2E', tap: '#open', status: 'opening', open: 1, settled: 0 },
    ], call, check)

    expect(snapshots.opened).toEqual({ state: 'opening' })
    expect(tap).toHaveBeenCalledTimes(1)
    expect(call).toHaveBeenCalledExactlyOnceWith('_runE2E')
    expect(check).toHaveBeenCalledExactlyOnceWith('opened')
  })

  it('calls each non-tap mutation once before its DOM checkpoint', async () => {
    const order: string[] = []
    let count = 0
    const page = { $$: vi.fn() }
    const call = vi.fn(async (method: string) => {
      order.push(method)
      count += 1
      return { count }
    })
    const check = vi.fn(async (id: string) => {
      order.push(id)
    })

    const snapshots = await runDialogSteps(page, [
      { id: 'opened', method: '_openDialogE2E', status: 'opening', open: 1, settled: 0 },
      { id: 'confirmed', method: '_confirmDialogE2E', status: 'confirmed', open: 1, settled: 1 },
    ], call, check)

    expect(snapshots).toEqual({ opened: { count: 1 }, confirmed: { count: 2 } })
    expect(order).toEqual(['_openDialogE2E', 'opened', '_confirmDialogE2E', 'confirmed'])
    expect(call).toHaveBeenCalledTimes(2)
    expect(page.$$).not.toHaveBeenCalled()
  })

  it.each([true, false])('propagates a failed DOM checkpoint with tap=%s', async (tapped) => {
    const tap = vi.fn(async () => {})
    const page = { $$: vi.fn(async () => [{ tap }]) }
    const call = vi.fn(async () => ({ state: 'opening' }))
    const error = new Error('dialog content did not render')
    const check = vi.fn(async () => {
      throw error
    })

    await expect(runDialogSteps(page, [
      { id: 'opened', method: '_runE2E', ...(tapped ? { tap: '#open' } : {}), status: 'opening', open: 1, settled: 0 },
      { id: 'confirmed', method: '_confirmDialogE2E', status: 'confirmed', open: 1, settled: 1 },
    ], call, check)).rejects.toBe(error)

    expect(call).toHaveBeenCalledTimes(tapped ? 0 : 1)
    expect(check).toHaveBeenCalledExactlyOnceWith('opened')
    expect(tap).toHaveBeenCalledTimes(tapped ? 1 : 0)
  })
})
