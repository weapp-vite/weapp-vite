import { parseDocument } from 'htmlparser2'
import { afterEach, expect, it, vi } from 'vitest'
import { HeadlessTestingNodeHandle } from './nodeHandle'

afterEach(() => vi.useRealTimers())

it('timestamps native interactions with the host timer clock without inventing detail', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  const startedAt = Date.now()
  const callMethod = vi.fn()
  const root = new HeadlessTestingNodeHandle(parseDocument('<button id="native" bindtap="onTap">native</button>'), {
    callMethod,
    createPageHandle: () => ({ data: async () => ({}) }),
    createScopeHandle: () => null,
    ownerScopeId: () => null,
  })
  const button = await root.$('#native')
  await button!.tap()
  expect(callMethod).toHaveBeenLastCalledWith(null, 'onTap', expect.objectContaining({
    type: 'tap',
    detail: undefined,
    timeStamp: startedAt,
  }))
  vi.advanceTimersByTime(25)
  await button!.tap({ detail: { source: 'explicit' } })
  expect(callMethod).toHaveBeenLastCalledWith(null, 'onTap', expect.objectContaining({
    type: 'tap',
    detail: { source: 'explicit' },
    timeStamp: startedAt + 25,
  }))
})
